import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { AnalyticsSummaryDay } from '../../api.ts'
import { formatDuration } from './DailyPieChart.tsx'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'
import { colorFor as colorForFn } from '../../categoryColors.ts'

const DEFAULT_CATEGORIES = ['学習', 'SNS', '娯楽', '移動', 'その他']

function shortDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

type Props = {
  data: AnalyticsSummaryDay[]
  range: 'weekly' | 'monthly'
}

export default function RangeBarChart({ data, range }: Props) {
  const { colors } = useCategoryColors()
  const colorFor = (cat: string) => colorForFn(colors, cat)
  const categories = useMemo(() => {
    const used = new Set<string>()
    for (const row of data) {
      for (const k of Object.keys(row)) {
        if (k !== 'date') used.add(k)
      }
    }
    return [...new Set([...DEFAULT_CATEGORIES.filter(c => used.has(c)), ...used])].filter(c => c !== 'date')
  }, [data])

  const chartData = useMemo(
    () => data.map(row => ({ ...row, date: shortDate(row.date as string) })),
    [data]
  )

  if (data.every(row => Object.keys(row).length <= 1)) {
    return <div className="analytics-empty">まだデータがありません</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5ff" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${Math.floor(v / 3600)}h`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => formatDuration(Number(v))} />
        <Legend />
        {categories.map(cat => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={colorFor(cat) ?? '#6b7280'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
