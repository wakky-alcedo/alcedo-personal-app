namespace WinTracker.Models;

public class ClassificationRule
{
    public string Pattern { get; set; } = "";
    public string Field { get; set; } = "processName";
    public string Category { get; set; } = "未分類";
}
