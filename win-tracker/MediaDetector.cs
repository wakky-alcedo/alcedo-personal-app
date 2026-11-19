using Windows.Media.Control;

namespace WinTracker;

public static class MediaDetector
{
    // RequestAsync() は呼ぶたびに NPSMSvc へ通知購読を登録した新しいマネージャーを返す。
    // 毎サンプル取得すると GC されるまで購読が積み上がり、NPSMSvc と自プロセスの
    // CPU 使用率が稼働時間に比例して増えるため、1 インスタンスを使い回す。
    // (呼び出し元 ActivityRecorder.GetPlayingAppIdsBounded が同時実行を1件に制限している)
    private static GlobalSystemMediaTransportControlsSessionManager? _manager;

    /// <summary>再生中のセッションの再生元 AppUserModelId 一覧。取得できなければ空。</summary>
    public static IReadOnlyList<string> GetPlayingAppIds()
    {
        var ids = new List<string>();
        try
        {
            _manager ??= GlobalSystemMediaTransportControlsSessionManager
                .RequestAsync().GetAwaiter().GetResult();
            foreach (var session in _manager.GetSessions())
            {
                var info = session.GetPlaybackInfo();
                if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                    ids.Add(session.SourceAppUserModelId ?? "");
            }
        }
        catch
        {
            // WinRT API not available, access denied, or NPSMSvc restarted — recreate the manager next time
            _manager = null;
        }

        return ids;
    }

    /// <summary>診断用: 全セッションの (AppUserModelId, 再生状態)。</summary>
    public static IReadOnlyList<(string AppId, string Status)> DescribeSessions()
    {
        var manager = GlobalSystemMediaTransportControlsSessionManager.RequestAsync().GetAwaiter().GetResult();
        return manager.GetSessions()
            .Select(s => (s.SourceAppUserModelId ?? "", s.GetPlaybackInfo().PlaybackStatus.ToString()))
            .ToList();
    }
}
