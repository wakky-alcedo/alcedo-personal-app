namespace WinTracker.Models;

public class ActivityLog
{
    public string Timestamp { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string WindowTitle { get; set; } = "";
    public bool IsMediaPlaying { get; set; }
}
