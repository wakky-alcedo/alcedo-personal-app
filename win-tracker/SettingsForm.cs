using System.Text.Json;
using WinTracker.Models;

namespace WinTracker;

public class SettingsForm : Form
{
    private readonly string _settingsPath;
    private readonly TextBox _serverUrl;
    private readonly TextBox _apiKey;
    private readonly TextBox _deviceId;
    private readonly NumericUpDown _sampleInterval;
    private readonly NumericUpDown _syncInterval;

    public SettingsForm(string settingsPath, AppSettings current)
    {
        _settingsPath = settingsPath;

        Text = "WinTracker 設定";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(420, 252);

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(14, 14, 14, 8),
            RowCount = 6,
            ColumnCount = 2,
            AutoSize = true,
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        for (int i = 0; i < 5; i++)
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));

        _serverUrl = new TextBox { Text = current.ServerUrl, Dock = DockStyle.Fill };
        _apiKey    = new TextBox { Text = current.ApiKey,    Dock = DockStyle.Fill, UseSystemPasswordChar = false };
        _deviceId  = new TextBox
        {
            Text = current.RawDeviceId,
            PlaceholderText = $"{Environment.MachineName}（自動）",
            Dock = DockStyle.Fill,
        };
        _sampleInterval = new NumericUpDown { Minimum = 5,  Maximum = 300, Value = current.SampleIntervalSeconds, Width = 72 };
        _syncInterval   = new NumericUpDown { Minimum = 1,  Maximum = 60,  Value = current.SyncIntervalMinutes,   Width = 72 };

        AddRow(layout, 0, "サーバーURL",       _serverUrl);
        AddRow(layout, 1, "APIキー",           _apiKey);
        AddRow(layout, 2, "デバイス名",         _deviceId);
        AddRow(layout, 3, "サンプル間隔（秒）", _sampleInterval);
        AddRow(layout, 4, "同期間隔（分）",     _syncInterval);

        var btnPanel = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.RightToLeft,
            Dock = DockStyle.Fill,
            Padding = new Padding(0, 4, 0, 0),
        };
        var btnCancel = new Button { Text = "キャンセル", Width = 90, DialogResult = DialogResult.Cancel };
        var btnSave   = new Button { Text = "保存して再起動", Width = 120, DialogResult = DialogResult.OK };
        btnSave.Click += OnSave;
        btnPanel.Controls.AddRange([btnCancel, btnSave]);

        layout.Controls.Add(btnPanel, 0, 5);
        layout.SetColumnSpan(btnPanel, 2);

        Controls.Add(layout);
        AcceptButton = btnSave;
        CancelButton = btnCancel;
    }

    private static void AddRow(TableLayoutPanel table, int row, string label, Control control)
    {
        table.Controls.Add(new Label
        {
            Text = label,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
        }, 0, row);
        table.Controls.Add(control, 1, row);
    }

    private void OnSave(object? sender, EventArgs e)
    {
        var updated = new AppSettings
        {
            ServerUrl             = _serverUrl.Text.Trim(),
            ApiKey                = _apiKey.Text.Trim(),
            DeviceId              = _deviceId.Text.Trim(),
            SampleIntervalSeconds = (int)_sampleInterval.Value,
            SyncIntervalMinutes   = (int)_syncInterval.Value,
        };

        Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath)!);
        File.WriteAllText(_settingsPath,
            JsonSerializer.Serialize(updated, new JsonSerializerOptions { WriteIndented = true }));

        Application.Restart();
    }
}
