export const DEFAULT_COLORS: Record<string, string> = {
  '開発': '#4757ff',
  'ブラウザ': '#6366f1',
  'コミュニケーション': '#10b981',
  '学習': '#0ea5e9',
  'SNS': '#ef4444',
  '娯楽': '#f59e0b',
  '未分類': '#94a3b8',
  '移動': '#8b5cf6',
  'その他': '#64748b',
}

const LS_KEY = 'alcedo_category_colors'

export function loadColors(): Record<string, string> {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) return { ...DEFAULT_COLORS, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULT_COLORS }
}

export function saveColors(colors: Record<string, string>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(colors))
}

export function colorFor(colors: Record<string, string>, cat: string): string {
  return colors[cat] ?? '#6b7280'
}
