namespace WinTracker.Models;

public class AppSettings
{
    public string ServerUrl { get; set; } = "http://localhost:8787";
    public string ApiKey { get; set; } = "dev-local-key";
    private string _deviceId = "";
    public string DeviceId
    {
        get => string.IsNullOrWhiteSpace(_deviceId) ? Environment.MachineName : _deviceId;
        set => _deviceId = value ?? "";
    }
    public int SampleIntervalSeconds { get; set; } = 15;
    public int SyncIntervalMinutes { get; set; } = 5;
}
