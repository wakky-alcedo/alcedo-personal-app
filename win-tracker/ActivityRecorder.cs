using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using WinTracker.Models;

namespace WinTracker;

public static class ActivityRecorder
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static ActivityLog? Capture()
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;

        var sb = new StringBuilder(512);
        GetWindowText(hwnd, sb, sb.Capacity);
        var windowTitle = sb.ToString();

        GetWindowThreadProcessId(hwnd, out var pid);
        string processName;
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            processName = proc.ProcessName;
        }
        catch
        {
            processName = "unknown";
        }

        // Skip if no meaningful window info
        if (string.IsNullOrWhiteSpace(windowTitle) && processName == "unknown")
            return null;

        return new ActivityLog
        {
            Timestamp = DateTime.UtcNow.ToString("o"),
            ProcessName = processName,
            WindowTitle = windowTitle,
            IsMediaPlaying = MediaDetector.IsPlaying(),
        };
    }
}
