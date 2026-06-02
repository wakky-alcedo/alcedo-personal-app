namespace WinTracker.Models;

public class AppSettings
{
    public string ServerUrl { get; set; } = "http://localhost:8787";
    public string ApiKey { get; set; } = "dev-local-key";
    public int SampleIntervalSeconds { get; set; } = 15;
    public int SyncIntervalMinutes { get; set; } = 5;
}
