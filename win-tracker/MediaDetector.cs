using Windows.Media.Control;

namespace WinTracker;

public static class MediaDetector
{
    // RequestAsync() は呼ぶたびに NPSMSvc へ通知購読を登録した新しいマネージャーを返す。
    // 毎サンプル取得すると GC されるまで購読が積み上がり、NPSMSvc と自プロセスの
    // CPU 使用率が稼働時間に比例して増えるため、1 インスタンスを使い回す。
    // (呼び出し元 ActivityRecorder.IsMediaPlayingBounded が同時実行を1件に制限している)
    private static GlobalSystemMediaTransportControlsSessionManager? _manager;

    public static bool IsPlaying()
    {
        try
        {
            _manager ??= GlobalSystemMediaTransportControlsSessionManager
                .RequestAsync().GetAwaiter().GetResult();
            var sessions = _manager.GetSessions();
            foreach (var session in sessions)
            {
                var info = session.GetPlaybackInfo();
                if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                    return true;
            }
        }
        catch
        {
            // WinRT API not available, access denied, or NPSMSvc restarted — recreate the manager next time
            _manager = null;
        }

        return false;
    }
}
