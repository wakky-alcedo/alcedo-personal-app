using System.Runtime.InteropServices;

namespace WinTracker;

/// <summary>このログオンセッションで最後にマウス・キーボード入力があってからの経過時間を取得する。</summary>
public static class IdleDetector
{
    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    /// <summary>取得に失敗したときは null(=操作なしとは判定しない)。</summary>
    public static TimeSpan? GetIdleDuration()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return null;

        // dwTime は GetTickCount と同じ 32bit の tick。符号なし減算で 49.7 日の周回をまたいでも差分が正しく出る
        var elapsedMs = unchecked((uint)Environment.TickCount - info.dwTime);
        // dwTime は単調増加が保証されず現在の tick より少し新しいことがある(差分が負→巨大値に周回する)
        if (elapsedMs > int.MaxValue) elapsedMs = 0;
        return TimeSpan.FromMilliseconds(elapsedMs);
    }
}
