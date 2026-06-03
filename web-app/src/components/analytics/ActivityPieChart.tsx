import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ActivitySummary } from '../../api.ts'
import { formatDuration } from './DailyPieChart.tsx'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'
import { colorFor as colorForFn } from '../../categoryColors.ts'

type Props = { summary: ActivitySummary[] }

export default function ActivityPieChart({ summary }: Props) {
  const { colors } = useCategoryColors()
  const colorFor = (cat: string) => colorForFn(colors, cat)
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
