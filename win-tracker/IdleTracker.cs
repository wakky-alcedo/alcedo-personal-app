namespace WinTracker;

/// <summary>
/// 操作なし判定。最後の入力から、または前面アプリのメディア再生を最後に確認してから
/// <c>threshold</c> 以上経っていれば「作業していない」とみなし、その起点時刻を返す。
/// </summary>
public sealed class IdleTracker(TimeSpan threshold)
{
    private DateTime? _lastWatchingUtc;
    private bool _lastWatchingKnown;

    /// <param name="inputIdle">最後の入力からの経過時間。null は取得失敗。</param>
    /// <param name="foregroundMediaPlaying">前面アプリが再生中か。null は判定できなかった(タイムアウト等)。</param>
    /// <returns>操作なしなら作業が止まった時刻(UTC)、作業中なら null。</returns>
    public DateTime? IdleSince(DateTime nowUtc, TimeSpan? inputIdle, bool? foregroundMediaPlaying)
    {
        if (inputIdle == null) return null;

        // 判定できなかったサンプルは直前の結果を引き継ぐ(1回のタイムアウトで視聴中の区間を閉じないため)
        var watching = foregroundMediaPlaying ?? _lastWatchingKnown;
        _lastWatchingKnown = watching;
        if (watching) _lastWatchingUtc = nowUtc;

        var lastInputUtc = nowUtc - inputIdle.Value;
        var activeUntil = _lastWatchingUtc is { } w && w > lastInputUtc ? w : lastInputUtc;
        return nowUtc - activeUntil >= threshold ? activeUntil : null;
    }
}
