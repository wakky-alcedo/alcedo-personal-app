using Windows.Media.Control;

namespace WinTracker;

public static class MediaDetector
{
    public static bool IsPlaying()
    {
        try
        {
            var sessionManager = GlobalSystemMediaTransportControlsSessionManager
                .RequestAsync().GetAwaiter().GetResult();
            var sessions = sessionManager.GetSessions();
            foreach (var session in sessions)
            {
                var info = session.GetPlaybackInfo();
                if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                    return true;
            }
        }
        catch
        {
            // WinRT API not available or access denied — fall back to false
        }

        return false;
    }
}
