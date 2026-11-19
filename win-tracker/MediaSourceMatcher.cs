namespace WinTracker;

/// <summary>再生中メディアセッションの再生元アプリ(AppUserModelId)が前面プロセスかを判定する。</summary>
public static class MediaSourceMatcher
{
    /// <param name="aliases">
    /// プロセス名 → AppUserModelId に含まれる文字列。AppUserModelId にプロセス名が含まれないアプリ
    /// (Firefox のハッシュ ID、ストアアプリのパッケージ名など)を対応付ける。
    /// </param>
    public static bool IsForegroundSource(
        string processName, IEnumerable<string> playingAppIds, IReadOnlyDictionary<string, string[]> aliases)
    {
        if (string.IsNullOrEmpty(processName)) return false;
        var needles = new List<string> { processName };
        foreach (var (proc, ids) in aliases)
        {
            if (string.Equals(proc, processName, StringComparison.OrdinalIgnoreCase))
                needles.AddRange(ids.Where(id => !string.IsNullOrEmpty(id)));
        }

        return playingAppIds.Any(appId =>
            needles.Any(n => appId.Contains(n, StringComparison.OrdinalIgnoreCase)));
    }
}
