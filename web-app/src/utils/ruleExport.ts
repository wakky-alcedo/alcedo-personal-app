import type { ActivityRuleInput } from '../api.ts'

export type RuleExport = {
  rules: ActivityRuleInput[]
  categories: Record<string, string> | null
}

/**
 * Parses an exported `{ rules, categories }` JSON file. Throws when `rules` is not an array;
 * rule entries without a string pattern/category are dropped (the server would skip them).
 */
export function parseRuleExport(text: string): RuleExport {
  const parsed: unknown = JSON.parse(text)
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const rawRules = root.rules ?? []
  if (!Array.isArray(rawRules)) throw new Error('rules が配列ではありません')

  const rules = rawRules.flatMap((item): ActivityRuleInput[] => {
    if (!item || typeof item !== 'object') return []
    const r = item as Record<string, unknown>
    if (typeof r.pattern !== 'string' || typeof r.category !== 'string') return []
    return [{
      pattern: r.pattern,
      category: r.category,
      ...(typeof r.field === 'string' ? { field: r.field } : {}),
      ...(typeof r.priority === 'number' ? { priority: r.priority } : {}),
    }]
  })

  const rawCategories = root.categories
  const categories = rawCategories && typeof rawCategories === 'object' && !Array.isArray(rawCategories)
    ? Object.fromEntries(Object.entries(rawCategories).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : null

  return { rules, categories }
}
