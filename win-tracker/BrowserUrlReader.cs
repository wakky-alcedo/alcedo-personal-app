using System.Windows.Automation;

namespace WinTracker;

public static class BrowserUrlReader
{
    private static readonly HashSet<string> BrowserProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "firefox", "brave", "opera", "vivaldi",
    };

    public static bool IsBrowser(string processName) => BrowserProcesses.Contains(processName);

    // UI Automation はハング(応答なしタブ等)しうる同期COM呼び出しのため、
    // Task.Wait のタイムアウト後も内部タスクは走り続ける。孤立タスクが
    // 際限なく積み上がらないよう、同時実行数を常に最大1件に制限する。
    private static int _inFlight;

    /// <summary>
    /// UI Automation でブラウザのURL・ページタイトル(Document 名)を一括取得する。
    /// windowTitle は GetWindowText の結果で、Document が複数ある場合(ウェブパネル等)に
    /// 表示中のページを選ぶ手がかりにする。
    /// </summary>
    public static (string? Url, string? Title) GetInfo(IntPtr hwnd, string processName, string windowTitle, int timeoutMs = 1200)
    {
        if (!IsBrowser(processName)) return (null, null);
        if (Interlocked.CompareExchange(ref _inFlight, 1, 0) != 0) return (null, null);

        try
        {
            var task = Task.Run(() =>
            {
                try
                {
                    var window = AutomationElement.FromHandle(hwnd);

                    // URL取得
                    var url = processName.Equals("firefox", StringComparison.OrdinalIgnoreCase)
                        ? ReadFirefoxUrl(window)
                        : ReadChromiumUrl(window);

                    // ページタイトル取得（TreeWalker で手動走査）
                    var title = ReadPageTitle(window, windowTitle);

                    return (CleanUrl(url), title);
                }
                finally
                {
                    Interlocked.Exchange(ref _inFlight, 0);
                }
            });
            return task.Wait(TimeSpan.FromMilliseconds(timeoutMs)) ? task.Result : (null, null);
        }
        catch
        {
            Interlocked.Exchange(ref _inFlight, 0);
            return (null, null);
        }
    }

    /// <summary>
    /// TreeWalker でブラウザの UI ツリーを浅く走査し、Document 要素の Name からページタイトルを取得する。
    /// ウィンドウタイトルの先頭と一致する Document を優先し、なければ最初に見つかった Document を返す
    /// (一致しない場合は呼び出し側がタブ切替中と判定して読み直す)。
    /// TabItem の選択状態は Vivaldi では取得できず(タブバーが HTML 描画のため TabItem が現れない)、
    /// 他ブラウザでも選択中以外のタブを誤判定しうるため使わない。
    /// </summary>
    private static string? ReadPageTitle(AutomationElement window, string windowTitle)
    {
        string? first = null;
        return FindDocumentTitle(TreeWalker.ControlViewWalker, window, 0, windowTitle, ref first) ?? first;
    }

    private static string? FindDocumentTitle(
        TreeWalker walker, AutomationElement element, int depth, string windowTitle, ref string? first)
    {
        if (depth > 6) return null;

        try
        {
            var child = walker.GetFirstChild(element);
            while (child != null)
            {
                try
                {
                    var type = child.Current.ControlType;

                    if (type == ControlType.Document)
                    {
                        var name = child.Current.Name;
                        if (!string.IsNullOrWhiteSpace(name) && name.Length > 2)
                        {
                            if (windowTitle.StartsWith(name, StringComparison.Ordinal))
                                return name;
                            first ??= name;
                        }
                    }
                    else if (IsContainer(type))
                    {
                        var result = FindDocumentTitle(walker, child, depth + 1, windowTitle, ref first);
                        if (result != null) return result;
                    }
                }
                catch { }

                try { child = walker.GetNextSibling(child); }
                catch { break; }
            }
        }
        catch { }

        return null;
    }

    private static bool IsContainer(ControlType type) =>
        type == ControlType.Pane || type == ControlType.Tab ||
        type == ControlType.Group || type == ControlType.Custom ||
        type == ControlType.Window || type == ControlType.ToolBar;

    // ─── URL取得 ──────────────────────────────────────────────────────────────

    private static string? ReadChromiumUrl(AutomationElement window)
    {
        var toolbar = window.FindFirst(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ToolBar));
        if (toolbar == null) return null;

        var edit = toolbar.FindFirst(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
        if (edit == null) return null;

        if (edit.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern))
            return ((ValuePattern)pattern).Current.Value;

        return null;
    }

    private static string? ReadFirefoxUrl(AutomationElement window)
    {
        var condition = new AndCondition(
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
            new PropertyCondition(AutomationElement.AutomationIdProperty, "urlbar-input"));

        var edit = window.FindFirst(TreeScope.Descendants, condition);
        if (edit != null && edit.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern))
            return ((ValuePattern)pattern).Current.Value;

        return ReadChromiumUrl(window);
    }

    // ─── URL整形 ──────────────────────────────────────────────────────────────

    private static string? CleanUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        var raw = url.Contains("://") ? url : "https://" + url;

        string clean;
        if (Uri.TryCreate(raw, UriKind.Absolute, out var uri))
            clean = uri.GetLeftPart(UriPartial.Path);
        else
        {
            var idx = url.IndexOfAny(['?', '#']);
            clean = idx >= 0 ? url[..idx] : url;
        }

        // Amazon 等のトラッキング用パスセグメント /ref=xxx を除去
        var refIdx = clean.IndexOf("/ref=", StringComparison.Ordinal);
        if (refIdx >= 0) clean = clean[..refIdx];

        return clean;
    }
}
