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

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessageTimeoutW(
        IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam,
        uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessageTimeoutW(
        IntPtr hWnd, uint Msg, IntPtr wParam, StringBuilder lParam,
        uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

    private const uint WM_GETTEXT = 0x000D;
    private const uint WM_GETTEXTLENGTH = 0x000E;
    private const uint SMTO_ABORTIFHUNG = 0x0002;

    private static int _mediaInFlight;

    public static ActivityLog? Capture(AppSettings settings)
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;

        // ウィンドウタイトル取得: GetWindowText → WM_GETTEXT フォールバック
        var windowTitle = GetTitle(hwnd);

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

        if (string.IsNullOrWhiteSpace(windowTitle) && processName == "unknown")
            return null;

        string? browserUrl = null;
        if (BrowserUrlReader.IsBrowser(processName))
        {
            var (url, title) = BrowserUrlReader.GetInfo(hwnd, processName, settings.BrowserUrlTimeoutMs);
            browserUrl = url;
            // UI Automation のタイトルが取れたら上書き
            if (!string.IsNullOrWhiteSpace(title) && title.Length > 2)
                windowTitle = title;
        }

        return new ActivityLog
        {
            ProcessName = processName,
            WindowTitle = windowTitle,
            BrowserUrl = browserUrl,
            IsMediaPlaying = IsMediaPlayingBounded(settings.BrowserUrlTimeoutMs),
        };
    }

    /// <summary>
    /// MediaDetector.IsPlaying() はタイムアウトなしの同期WinRT呼び出しのため、
    /// BrowserUrlReader と同様に同時実行数を1件に制限した上でタイムアウトを課す。
    /// </summary>
    private static bool IsMediaPlayingBounded(int timeoutMs)
    {
        if (Interlocked.CompareExchange(ref _mediaInFlight, 1, 0) != 0) return false;

        try
        {
            var task = Task.Run(() =>
            {
                try { return MediaDetector.IsPlaying(); }
                finally { Interlocked.Exchange(ref _mediaInFlight, 0); }
            });
            return task.Wait(TimeSpan.FromMilliseconds(timeoutMs)) && task.Result;
        }
        catch
        {
            Interlocked.Exchange(ref _mediaInFlight, 0);
            return false;
        }
    }

    /// <summary>
    /// GetWindowText で取得し、結果が短すぎる場合は WM_GETTEXT で再取得する。
    /// </summary>
    private static string GetTitle(IntPtr hwnd)
    {
        var sb = new StringBuilder(1024);
        GetWindowText(hwnd, sb, sb.Capacity);
        var title = sb.ToString();

        // 3文字以下（♪ など）の場合、WM_GETTEXT を試す
        if (title.Length <= 3)
        {
            var wmTitle = GetTitleViaWmGetText(hwnd);
            if (wmTitle.Length > title.Length)
                title = wmTitle;
        }

        return title;
    }

    private static string GetTitleViaWmGetText(IntPtr hwnd)
    {
        try
        {
            var lenResult = SendMessageTimeoutW(
                hwnd, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero,
                SMTO_ABORTIFHUNG, 1000, out _);
            var len = (int)lenResult;
            if (len <= 0) return "";

            var sb = new StringBuilder(len + 1);
            SendMessageTimeoutW(
                hwnd, WM_GETTEXT, (IntPtr)sb.Capacity, sb,
                SMTO_ABORTIFHUNG, 1000, out _);
            return sb.ToString();
        }
        catch
        {
            return "";
        }
    }
}
