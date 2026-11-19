namespace WinTracker.Models;

public class ActivityLog
{
    public string DeviceId { get; set; } = "";
    public string StartedAt { get; set; } = "";
    public string? EndedAt { get; set; }
    public string ProcessName { get; set; } = "";
    public string WindowTitle { get; set; } = "";
    public string? BrowserUrl { get; set; }
    public bool IsMediaPlaying { get; set; }

    /// <summary>前面アプリ自身が再生中か(操作なし判定用、サーバーには送らない)。null は判定できなかった。</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public bool? IsForegroundMediaPlaying { get; set; }
}
