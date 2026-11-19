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
    public int MaxBufferedLogs { get; set; } = 5000;
    public int HttpTimeoutSeconds { get; set; } = 20;
    public int BrowserUrlTimeoutMs { get; set; } = 1200;
    /// <summary>この秒数以上マウス・キーボード操作がなく、前面アプリがメディア再生中でもなければ作業なしとして区間を閉じる。</summary>
    public int IdleThresholdSeconds { get; set; } = 180;
    /// <summary>プロセス名 → 再生元 AppUserModelId に含まれる文字列(プロセス名で一致しないアプリ用)。`--diag` で確認できる。</summary>
    public Dictionary<string, string[]> MediaSourceAliases { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
