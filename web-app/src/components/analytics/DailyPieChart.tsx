import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { AnalyticsEntry } from '../../api.ts'

export const CATEGORY_COLORS: Record<string, string> = {
  '学習': '#4757ff',
  'SNS': '#ef4444',
  '娯楽': '#f59e0b',
  '移動': '#10b981',
  'その他': '#94a3b8',
}

function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6b7280'
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

type Props = { entries: AnalyticsEntry[] }

export default function DailyPieChart({ entries }: Props) {
  const data = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of entries) map[e.category] = (map[e.category] ?? 0) + e.durationSec
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [entries])

  if (data.length === 0) {
    return <div className="analytics-empty">まだデータがありません</div>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, value }) => `${name} ${formatDuration(value as number)}`}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={colorFor(entry.name)} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatDuration(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
