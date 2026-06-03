using System.Windows.Automation;

namespace WinTracker;

public static class BrowserUrlReader
{
    private static readonly HashSet<string> BrowserProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "firefox", "brave", "opera", "vivaldi",
    };

    public static bool IsBrowser(string processName) => BrowserProcesses.Contains(processName);

    /// <summary>
    /// UI Automation でブラウザのURL・タブタイトルを一括取得する。
    /// </summary>
    public static (string? Url, string? Title) GetInfo(IntPtr hwnd, string processName)
    {
        if (!IsBrowser(processName)) return (null, null);

        try
        {
            var task = Task.Run(() =>
            {
                var window = AutomationElement.FromHandle(hwnd);

                // URL取得
                var url = processName.Equals("firefox", StringComparison.OrdinalIgnoreCase)
                    ? ReadFirefoxUrl(window)
                    : ReadChromiumUrl(window);

                // タブタイトル取得（TreeWalker で手動走査）
                var title = ReadPageTitle(window);

                return (CleanUrl(url), title);
            });
            return task.Wait(TimeSpan.FromSeconds(4)) ? task.Result : (null, null);
        }
        catch
        {
            return (null, null);
        }
    }

    /// <summary>
    /// TreeWalker でブラウザの UI ツリーを浅く走査し、
    /// 選択中の TabItem または Document 要素からページタイトルを取得する。
    /// </summary>
    private static string? ReadPageTitle(AutomationElement window)
    {
        var walker = TreeWalker.ControlViewWalker;
        // 選択中タブを探す
        var tabTitle = FindSelectedTabTitle(walker, window, 0);
        if (tabTitle != null) return tabTitle;

        // フォールバック: Document 要素の Name
        return FindDocumentTitle(walker, window, 0);
    }

    private static string? FindSelectedTabTitle(TreeWalker walker, AutomationElement element, int depth)
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

                    if (type == ControlType.TabItem)
                    {
                        if (IsSelectedTab(child))
                        {
                            var name = child.Current.Name;
                            if (!string.IsNullOrWhiteSpace(name) && name.Length > 2)
                                return name;
                        }
                    }
                    else if (IsContainer(type))
                    {
                        var result = FindSelectedTabTitle(walker, child, depth + 1);
                        if (result != null) return result;
                    }
                }
                catch { /* stale element */ }

                try { child = walker.GetNextSibling(child); }
                catch { break; }
            }
        }
        catch { }

        return null;
    }

    private static string? FindDocumentTitle(TreeWalker walker, AutomationElement element, int depth)
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
                            return name;
                    }
                    else if (IsContainer(type))
                    {
                        var result = FindDocumentTitle(walker, child, depth + 1);
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

    private static bool IsSelectedTab(AutomationElement tab)
    {
        try
        {
            // SelectionItemPattern
            if (tab.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selPat))
            {
                if (((SelectionItemPattern)selPat).Current.IsSelected)
                    return true;
            }
        }
        catch { }

        try
        {
            // ExpandCollapsePattern (一部のブラウザで使用)
            if (tab.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expPat))
            {
                if (((ExpandCollapsePattern)expPat).Current.ExpandCollapseState == ExpandCollapseState.Expanded)
                    return true;
            }
        }
        catch { }

        try
        {
            // TogglePattern (一部のブラウザでトグル状態で表現)
            if (tab.TryGetCurrentPattern(TogglePattern.Pattern, out var togPat))
            {
                if (((TogglePattern)togPat).Current.ToggleState == ToggleState.On)
                    return true;
            }
        }
        catch { }

        return false;
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
