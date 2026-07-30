using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using WinTracker.Models;

namespace WinTracker;

public class SyncService : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _serverUrl;
    private readonly string _deviceId;
    private readonly int _maxBufferedLogs;
    private readonly List<ActivityLog> _completed = [];
    private ActivityLog? _currentSession;
    private readonly object _lock = new();
    private long _droppedTotal;
    private int _syncing;
    private static readonly string BufferFilePath =
        Path.Combine(AppContext.BaseDirectory, "buffer.json");

    public SyncService(string serverUrl, string apiKey, string deviceId, int maxBufferedLogs = 5000, int httpTimeoutSeconds = 20)
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _deviceId = deviceId;
        _maxBufferedLogs = maxBufferedLogs;
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(httpTimeoutSeconds) };
        _http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);

        if (File.Exists(BufferFilePath))
        {
            try
            {
                var json = File.ReadAllText(BufferFilePath);
                var state = JsonSerializer.Deserialize<PersistedState>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (state != null)
                {
                    if (state.Completed != null) _completed.AddRange(state.Completed);
                    _currentSession = state.CurrentSession;
                    TrimToLimit();
                }
                File.Delete(BufferFilePath);
            }
            catch { /* ignore corrupt buffer */ }
        }
    }

    /// <summary>
    /// _completed が上限を超えていたら古いものから破棄する。呼び出し元で _lock を保持していること。
    /// </summary>
    private void TrimToLimit()
    {
        var overflow = _completed.Count - _maxBufferedLogs;
        if (overflow <= 0) return;
        _completed.RemoveRange(0, overflow);
        _droppedTotal += overflow;
    }

    /// <summary>
    /// ディスプレイがオフになったとき呼び出す。
    /// 現在のオープンセッションを終了してバッファに追加し、記録を停止する。
    /// </summary>
    public void OnDisplayOff()
    {
        lock (_lock)
        {
            if (_currentSession == null) return;
            _currentSession.EndedAt = DateTime.UtcNow.ToString("o");
            _completed.Add(_currentSession);
            TrimToLimit();
            _currentSession = null;  // ギャップ = 睡眠として DayTimeline が解釈する
        }
    }

    /// <summary>
    /// ディスプレイがオンになったとき呼び出す。
    /// 次の UpdateActivity 呼び出しで自動的に新セッションが開始される。
    /// </summary>
    public void OnDisplayOn() { /* 次回 UpdateActivity が新セッションを開始 */ }

    /// <summary>
    /// Called on each sample tick. Starts, extends, or ends sessions based on whether activity changed.
    /// </summary>
    public void UpdateActivity(ActivityLog snapshot)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow.ToString("o");

            if (_currentSession == null)
            {
                _currentSession = CreateSession(snapshot, now);
            }
            else if (IsSameActivity(snapshot, _currentSession))
            {
                _currentSession.IsMediaPlaying = snapshot.IsMediaPlaying;
            }
            else
            {
                _currentSession.EndedAt = now;
                _completed.Add(_currentSession);
                TrimToLimit();
                _currentSession = CreateSession(snapshot, now);
            }
        }
    }

    public int PendingCount
    {
        get { lock (_lock) { return _completed.Count; } }
    }

    public long DroppedCount
    {
        get { lock (_lock) { return _droppedTotal; } }
    }

    public async Task<bool> SyncAsync()
    {
        if (Interlocked.CompareExchange(ref _syncing, 1, 0) != 0) return false;
        try
        {
            List<ActivityLog> batch;
            int completedCount;
            long droppedAtStart;
            lock (_lock)
            {
                if (_completed.Count == 0 && _currentSession == null) return true;
                batch = new List<ActivityLog>(_completed);
                completedCount = _completed.Count;
                droppedAtStart = _droppedTotal;
                // Include the current open session so the server knows "what's happening now"
                if (_currentSession != null)
                    batch.Add(CopySession(_currentSession));
            }

            try
            {
                var payload = new { deviceId = _deviceId, logs = batch };
                var response = await _http.PostAsJsonAsync(
                    $"{_serverUrl}/api/v1/activity/bulk", payload);

                if (response.IsSuccessStatusCode)
                {
                    lock (_lock)
                    {
                        // 同期中に TrimToLimit で先頭が破棄されている可能性があるため、
                        // 破棄件数を差し引いた分だけ削除する(新しく追加されたログを誤って消さないため)。
                        var alreadyDropped = (int)(_droppedTotal - droppedAtStart);
                        var toRemove = Math.Clamp(completedCount - alreadyDropped, 0, _completed.Count);
                        _completed.RemoveRange(0, toRemove);
                    }
                    return true;
                }
            }
            catch { /* Network error — keep buffer for retry */ }

            return false;
        }
        finally
        {
            Interlocked.Exchange(ref _syncing, 0);
        }
    }

    public void FlushToDisk()
    {
        lock (_lock)
        {
            if (_completed.Count == 0 && _currentSession == null) return;
            try
            {
                var state = new PersistedState
                {
                    Completed = new List<ActivityLog>(_completed),
                    CurrentSession = _currentSession != null ? CopySession(_currentSession) : null,
                };
                File.WriteAllText(BufferFilePath, JsonSerializer.Serialize(state));
            }
            catch { /* best-effort */ }
        }
    }

    public void Dispose() => _http.Dispose();

    private ActivityLog CreateSession(ActivityLog snapshot, string startedAt) => new()
    {
        DeviceId = _deviceId,
        StartedAt = startedAt,
        EndedAt = null,
        ProcessName = snapshot.ProcessName,
        WindowTitle = snapshot.WindowTitle,
        BrowserUrl = snapshot.BrowserUrl,
        IsMediaPlaying = snapshot.IsMediaPlaying,
    };

    private static ActivityLog CopySession(ActivityLog s) => new()
    {
        DeviceId = s.DeviceId,
        StartedAt = s.StartedAt,
        EndedAt = s.EndedAt,
        ProcessName = s.ProcessName,
        WindowTitle = s.WindowTitle,
        BrowserUrl = s.BrowserUrl,
        IsMediaPlaying = s.IsMediaPlaying,
    };

    private static bool IsSameActivity(ActivityLog a, ActivityLog b) =>
        a.ProcessName == b.ProcessName &&
        a.WindowTitle == b.WindowTitle &&
        a.BrowserUrl == b.BrowserUrl;

    private class PersistedState
    {
        public List<ActivityLog>? Completed { get; set; }
        public ActivityLog? CurrentSession { get; set; }
    }
}
