import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ActivitySummary } from '../../api.ts'
import { formatDuration } from './DailyPieChart.tsx'

const CATEGORY_COLORS: Record<string, string> = {
  '開発': '#4757ff',
  'ブラウザ': '#6366f1',
  'コミュニケーション': '#10b981',
  '学習': '#0ea5e9',
  'SNS': '#ef4444',
  '娯楽': '#f59e0b',
  '未分類': '#94a3b8',
}

function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6b7280'
}

type Props = { summary: ActivitySummary[] }

export default function ActivityPieChart({ summary }: Props) {
  const data = useMemo(() =>
    summary
      .filter(s => s.durationSec > 0)
      .map(s => ({ name: s.category, value: s.durationSec })),
    [summary]
  )

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
          {data.map(entry => (
            <Cell key={entry.name} fill={colorFor(entry.name)} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatDuration(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
