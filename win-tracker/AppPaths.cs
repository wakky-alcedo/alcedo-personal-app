namespace WinTracker;

public static class AppPaths
{
    /// <summary>
    /// exe が置かれているディレクトリ。
    /// 単一ファイル発行 + IncludeAllContentForSelfExtract では AppContext.BaseDirectory が
    /// %TEMP%\.net\WinTracker\&lt;hash&gt;\ の展開先を指すため、exe 隣のファイルにはこちらを使う。
    /// </summary>
    public static readonly string ExeDirectory =
        Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;
}
