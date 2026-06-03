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
    [System.Text.Json.Serialization.JsonIgnore]
    public string RawDeviceId => _deviceId;
    public int SampleIntervalSeconds { get; set; } = 15;
    public int SyncIntervalMinutes { get; set; } = 5;
}
