using System.Text.Json;
using WinTracker;
using WinTracker.Models;

internal static class Program
{
    private static NotifyIcon? _trayIcon;
    private static System.Windows.Forms.Timer? _sampleTimer;
    private static System.Windows.Forms.Timer? _syncTimer;
    private static SyncService? _syncService;
    private static RuleClassifier? _classifier;
    private static bool _paused;

    [STAThread]
    static void Main(string[] args)
    {
        if (args.Contains("--diag"))
        {
            DiagDump.Run();
            return;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        // Load settings
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        AppSettings settings;
        if (File.Exists(settingsPath))
        {
            var json = File.ReadAllText(settingsPath);
            settings = JsonSerializer.Deserialize<AppSettings>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AppSettings();
        }
        else
        {
            settings = new AppSettings();
        }

        // Load classification rules
        var rulesPath = Path.Combine(AppContext.BaseDirectory, "rules.json");
        _classifier = new RuleClassifier(rulesPath);

        // Init sync service
        _syncService = new SyncService(settings.ServerUrl, settings.ApiKey, settings.DeviceId);

        // Build tray icon
        var contextMenu = new ContextMenuStrip();
        var statusItem = new ToolStripMenuItem("記録中") { Enabled = false };
        contextMenu.Items.Add(statusItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        var syncNow = new ToolStripMenuItem("今すぐ同期");
        syncNow.Click += async (_, _) =>
        {
            var ok = await _syncService.SyncAsync();
            statusItem.Text = ok ? "同期完了" : "同期失敗";
        };
        contextMenu.Items.Add(syncNow);

        var pauseItem = new ToolStripMenuItem("一時停止");
        pauseItem.Click += (_, _) =>
        {
            _paused = !_paused;
            pauseItem.Text = _paused ? "再開" : "一時停止";
            statusItem.Text = _paused ? "一時停止中" : "記録中";
        };
        contextMenu.Items.Add(pauseItem);

        contextMenu.Items.Add(new ToolStripSeparator());

        var exitItem = new ToolStripMenuItem("終了");
        exitItem.Click += (_, _) =>
        {
            _syncService.FlushToDisk();
            Application.Exit();
        };
        contextMenu.Items.Add(exitItem);

        var icoPath = Path.Combine(AppContext.BaseDirectory, "app.ico");
        var icon = File.Exists(icoPath) ? new Icon(icoPath) : SystemIcons.Application;

        _trayIcon = new NotifyIcon
        {
            Icon = icon,
            Text = "WinTracker",
            Visible = true,
            ContextMenuStrip = contextMenu,
        };

        // Sample timer (foreground window capture)
        _sampleTimer = new System.Windows.Forms.Timer
        {
            Interval = settings.SampleIntervalSeconds * 1000,
        };
        _sampleTimer.Tick += (_, _) =>
        {
            if (_paused) return;
            var log = ActivityRecorder.Capture();
            if (log != null)
            {
                _syncService.UpdateActivity(log);
                statusItem.Text = $"記録中 ({_syncService.PendingCount})";
            }
        };
        _sampleTimer.Start();

        // Sync timer
        _syncTimer = new System.Windows.Forms.Timer
        {
            Interval = settings.SyncIntervalMinutes * 60 * 1000,
        };
        _syncTimer.Tick += async (_, _) =>
        {
            var ok = await _syncService.SyncAsync();
            if (ok) statusItem.Text = "記録中";
        };
        _syncTimer.Start();

        Application.ApplicationExit += (_, _) =>
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            _sampleTimer.Dispose();
            _syncTimer.Dispose();
            _syncService.Dispose();
        };

        Application.Run();
    }
}
