using System.Text.Json;
using System.Text.RegularExpressions;
using WinTracker.Models;

namespace WinTracker;

public class RuleClassifier
{
    private readonly List<ClassificationRule> _rules;

    public RuleClassifier(string rulesPath)
    {
        if (File.Exists(rulesPath))
        {
            var json = File.ReadAllText(rulesPath);
            _rules = JsonSerializer.Deserialize<List<ClassificationRule>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        else
        {
            _rules = [];
        }
    }

    public string Classify(string processName, string windowTitle)
    {
        foreach (var rule in _rules)
        {
            var target = rule.Field == "windowTitle" ? windowTitle : processName;
            try
            {
                if (Regex.IsMatch(target, rule.Pattern, RegexOptions.IgnoreCase))
                    return rule.Category;
            }
            catch
            {
                // Skip invalid regex
            }
        }

        return "未分類";
    }
}
