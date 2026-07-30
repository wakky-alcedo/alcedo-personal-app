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
    private static PowerMonitor? _powerMonitor;
    private static bool _paused;
    private static bool _displayOff;

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

        // Load settings — AppData first (persists across updates), fallback to exe dir
        var appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "WinTracker");
        var appDataSettings = Path.Combine(appDataDir, "appsettings.json");
        var exeSettings = Path.Combine(AppContext.BaseDirectory, "appsettings.json");

        AppSettings settings;
        var settingsPath = File.Exists(appDataSettings) ? appDataSettings : exeSettings;
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

        // On first run, copy default settings to AppData so the user can edit them there
        if (!File.Exists(appDataSettings))
        {
            Directory.CreateDirectory(appDataDir);
            var defaultJson = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(appDataSettings, defaultJson);
        }

        // Load classification rules
        var rulesPath = Path.Combine(AppContext.BaseDirectory, "rules.json");
        _classifier = new RuleClassifier(rulesPath);

        // Init sync service
        _syncService = new SyncService(
            settings.ServerUrl, settings.ApiKey, settings.DeviceId,
            settings.MaxBufferedLogs, settings.HttpTimeoutSeconds);

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

        var settingsItem = new ToolStripMenuItem("設定");
        settingsItem.Click += (_, _) =>
        {
            using var form = new SettingsForm(appDataSettings, settings);
            if (form.ShowDialog() == DialogResult.OK)
                _syncService.FlushToDisk(); // flush before Application.Restart()
        };
        contextMenu.Items.Add(settingsItem);

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
            if (_paused || _displayOff) return;
            var log = ActivityRecorder.Capture(settings);
            if (log != null)
            {
                _syncService.UpdateActivity(log);
                statusItem.Text = _syncService.DroppedCount > 0
                    ? $"記録中 ({_syncService.PendingCount}, 破棄:{_syncService.DroppedCount})"
                    : $"記録中 ({_syncService.PendingCount})";
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

        // ディスプレイオン/オフの監視（statusItem 確定後に登録）
        _powerMonitor = new PowerMonitor();
        _powerMonitor.DisplayStateChanged += isOn =>
        {
            _displayOff = !isOn;
            if (!isOn)
            {
                _syncService.OnDisplayOff();
                statusItem.Text = "画面オフ（睡眠）";
            }
            else
            {
                _syncService.OnDisplayOn();
                statusItem.Text = "記録中";
            }
        };

        Application.ApplicationExit += (_, _) =>
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            _sampleTimer.Dispose();
            _syncTimer.Dispose();
            _syncService.Dispose();
            _powerMonitor?.Dispose();
        };

        Application.Run();
    }
}
