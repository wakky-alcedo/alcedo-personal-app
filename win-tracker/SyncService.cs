using System.Net.Http.Json;
using System.Text.Json;
using WinTracker.Models;

namespace WinTracker;

public class SyncService : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _serverUrl;
    private readonly string _apiKey;
    private readonly List<ActivityLog> _buffer = [];
    private readonly object _lock = new();
    private static readonly string BufferFilePath =
        Path.Combine(AppContext.BaseDirectory, "buffer.json");

    public SyncService(string serverUrl, string apiKey)
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _apiKey = apiKey;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("X-Api-Key", _apiKey);

        // Load any persisted buffer from a previous session
        if (File.Exists(BufferFilePath))
        {
            try
            {
                var json = File.ReadAllText(BufferFilePath);
                var loaded = JsonSerializer.Deserialize<List<ActivityLog>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (loaded != null) _buffer.AddRange(loaded);
                File.Delete(BufferFilePath);
            }
            catch { /* ignore corrupt buffer */ }
        }
    }

    public void Add(ActivityLog log)
    {
        lock (_lock)
        {
            _buffer.Add(log);
        }
    }

    public int PendingCount
    {
        get { lock (_lock) { return _buffer.Count; } }
    }

    public async Task<bool> SyncAsync()
    {
        List<ActivityLog> batch;
        lock (_lock)
        {
            if (_buffer.Count == 0) return true;
            batch = new List<ActivityLog>(_buffer);
        }

        try
        {
            var payload = new { logs = batch };
            var response = await _http.PostAsJsonAsync(
                $"{_serverUrl}/api/v1/activity/bulk", payload);

            if (response.IsSuccessStatusCode)
            {
                lock (_lock)
                {
                    // Remove only the items we sent (more may have been added)
                    _buffer.RemoveRange(0, Math.Min(batch.Count, _buffer.Count));
                }
                return true;
            }
        }
        catch
        {
            // Network error — keep buffer for retry
        }

        return false;
    }

    public void FlushToDisk()
    {
        lock (_lock)
        {
            if (_buffer.Count == 0) return;
            try
            {
                var json = JsonSerializer.Serialize(_buffer);
                File.WriteAllText(BufferFilePath, json);
            }
            catch { /* best-effort */ }
        }
    }

    public void Dispose()
    {
        _http.Dispose();
    }
}
