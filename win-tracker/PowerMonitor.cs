using System.Runtime.InteropServices;

namespace WinTracker;

/// <summary>
/// ディスプレイのオン/オフを WM_POWERBROADCAST で監視する。
/// 非表示の隠しウィンドウを使って電源設定通知を受け取る。
/// </summary>
public sealed class PowerMonitor : IDisposable
{
    // GUID_CONSOLE_DISPLAY_STATE – コンソールディスプレイの状態変化
    private static readonly Guid GUID_CONSOLE_DISPLAY_STATE =
        new("6fe69556-704a-47a0-8f24-c28d936fda47");

    private const int WM_POWERBROADCAST      = 0x0218;
    private const int PBT_POWERSETTINGCHANGE = 0x8013;
    // Data 値: 0x0=オフ, 0x1=オン, 0x2=調光
    private const byte DISPLAY_OFF = 0x0;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr RegisterPowerSettingNotification(
        IntPtr hRecipient, ref Guid PowerSettingGuid, int Flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterPowerSettingNotification(IntPtr Handle);

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct POWERBROADCAST_SETTING
    {
        public Guid  PowerSetting;
        public uint  DataLength;
        public byte  Data;
    }

    private readonly MessageSink _sink;
    private readonly IntPtr      _notifyHandle;

    /// <summary>true=ディスプレイオン, false=ディスプレイオフ</summary>
    public event Action<bool>? DisplayStateChanged;

    public PowerMonitor()
    {
        _sink = new MessageSink(OnMessage);
        var guid = GUID_CONSOLE_DISPLAY_STATE;
        _notifyHandle = RegisterPowerSettingNotification(_sink.Handle, ref guid, 0);
    }

    private void OnMessage(Message m)
    {
        if (m.Msg != WM_POWERBROADCAST) return;
        if (m.WParam.ToInt32() != PBT_POWERSETTINGCHANGE) return;

        var setting = Marshal.PtrToStructure<POWERBROADCAST_SETTING>(m.LParam);
        if (setting.PowerSetting != GUID_CONSOLE_DISPLAY_STATE) return;

        DisplayStateChanged?.Invoke(setting.Data != DISPLAY_OFF);
    }

    public void Dispose()
    {
        if (_notifyHandle != IntPtr.Zero)
            UnregisterPowerSettingNotification(_notifyHandle);
        _sink.Dispose();
    }

    // 電源メッセージを受け取るだけの不可視フォーム
    private sealed class MessageSink : Form
    {
        private readonly Action<Message> _handler;

        public MessageSink(Action<Message> handler)
        {
            _handler      = handler;
            ShowInTaskbar = false;
            Opacity       = 0;
            Visible       = false;
        }

        protected override void WndProc(ref Message m)
        {
            _handler(m);
            base.WndProc(ref m);
        }
    }
}
