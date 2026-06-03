using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Automation;

namespace WinTracker;

public static class DiagDump
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    private static readonly string OutputPath = Path.Combine(AppContext.BaseDirectory, "diag.txt");
    private static StreamWriter _out = null!;

    private static void W(string text) => _out.WriteLine(text);

    public static void Run()
    {
        _out = new StreamWriter(OutputPath, false, Encoding.UTF8);

        W("5秒後にフォアグラウンドウィンドウのUI Automationツリーをダンプします。");
        W("ブラウザを前面にしてください...");
        _out.Flush();
        Thread.Sleep(5000);

        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero)
        {
            W("フォアグラウンドウィンドウが取得できません");
            _out.Close();
            return;
        }

        var sb = new StringBuilder(1024);
        GetWindowText(hwnd, sb, sb.Capacity);
        W($"GetWindowText: \"{sb}\"");

        GetWindowThreadProcessId(hwnd, out var pid);
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            W($"Process: {proc.ProcessName} (PID {pid})");
        }
        catch
        {
            W($"Process: unknown (PID {pid})");
        }

        W("");
        W("--- UI Automation Tree (depth <= 4) ---");

        var window = AutomationElement.FromHandle(hwnd);
        W($"Window Name=\"{window.Current.Name}\" ControlType={window.Current.ControlType.ProgrammaticName}");

        var walker = TreeWalker.ControlViewWalker;
        DumpTree(walker, window, 1, 4);

        W("");
        W("--- TabItem 要素の詳細 ---");
        DumpTabItems(window);

        W("");
        W("--- Document 要素の詳細 ---");
        DumpDocuments(window);

        _out.Close();

        // 完了メッセージを表示
        System.Windows.Forms.MessageBox.Show(
            $"ダンプ完了:\n{OutputPath}",
            "WinTracker Diag",
            System.Windows.Forms.MessageBoxButtons.OK,
            System.Windows.Forms.MessageBoxIcon.Information);
    }

    private static void DumpTree(TreeWalker walker, AutomationElement element, int depth, int maxDepth)
    {
        if (depth > maxDepth) return;

        try
        {
            var child = walker.GetFirstChild(element);
            while (child != null)
            {
                try
                {
                    var indent = new string(' ', depth * 2);
                    var type = child.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
                    var name = child.Current.Name ?? "";
                    var autoId = child.Current.AutomationId ?? "";
                    var nameDisplay = name.Length > 60 ? name[..60] + "..." : name;

                    var line = $"{indent}{type}";
                    if (!string.IsNullOrEmpty(nameDisplay)) line += $" Name=\"{nameDisplay}\"";
                    if (!string.IsNullOrEmpty(autoId)) line += $" AutoId=\"{autoId}\"";

                    var patterns = child.GetSupportedPatterns();
                    if (patterns.Length > 0)
                    {
                        var patNames = patterns.Select(p => p.ProgrammaticName.Replace("Identifiers.", ""));
                        line += $" Patterns=[{string.Join(",", patNames)}]";
                    }

                    W(line);
                    DumpTree(walker, child, depth + 1, maxDepth);
                }
                catch (Exception ex)
                {
                    W($"{new string(' ', depth * 2)}(error: {ex.Message})");
                }

                try { child = walker.GetNextSibling(child); }
                catch { break; }
            }
        }
        catch { }
    }

    private static void DumpTabItems(AutomationElement window)
    {
        try
        {
            var tabs = window.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem));
            W($"TabItem 数: {tabs.Count}");
            foreach (AutomationElement tab in tabs)
            {
                try
                {
                    W($"  Name=\"{tab.Current.Name}\" AutoId=\"{tab.Current.AutomationId}\"");
                    var patterns = tab.GetSupportedPatterns();
                    W($"    Patterns: [{string.Join(", ", patterns.Select(p => p.ProgrammaticName))}]");

                    if (tab.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selPat))
                        W($"    SelectionItem.IsSelected = {((SelectionItemPattern)selPat).Current.IsSelected}");
                }
                catch (Exception ex)
                {
                    W($"    (error: {ex.Message})");
                }
            }
        }
        catch (Exception ex)
        {
            W($"  FindAll error: {ex.Message}");
        }
    }

    private static void DumpDocuments(AutomationElement window)
    {
        try
        {
            var docs = window.FindAll(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Document));
            W($"Document 数: {docs.Count}");
            foreach (AutomationElement doc in docs)
            {
                try
                {
                    W($"  Name=\"{doc.Current.Name}\" AutoId=\"{doc.Current.AutomationId}\"");
                }
                catch (Exception ex)
                {
                    W($"    (error: {ex.Message})");
                }
            }
        }
        catch (Exception ex)
        {
            W($"  FindAll error: {ex.Message}");
        }
    }
}
