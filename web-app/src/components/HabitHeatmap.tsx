import React, { useEffect, useRef } from 'react'
import type { Habit } from '../api.ts'
import { effectiveLocalDate, localDateString } from '../timeUtils.ts'

export const HEATMAP_DAYS = 60
const CELL_W = 14 // 12px cell + 2px gap

export function buildHeatmapDays(): string[] {
  const todayStr = effectiveLocalDate()
  const today = new Date(`${todayStr}T06:00:00`)
  return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (HEATMAP_DAYS - 1 - i))
    return localDateString(d)
  })
}

function monthLabels(days: string[]): Array<{ label: string; index: number }> {
  const labels: Array<{ label: string; index: number }> = []
  let lastMonth = ''
  for (let i = 0; i < days.length; i++) {
    const month = days[i].slice(0, 7)
    if (month !== lastMonth) {
      labels.push({ label: days[i].slice(5, 7) + '月', index: i })
      lastMonth = month
    }
  }
  return labels
}

type Props = {
  habits: Habit[]
  doneMap: Record<string, Set<string>>
}

export default function HabitHeatmap({ habits, doneMap }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初期表示で今日（右端）までスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [habits.length])

  if (habits.length === 0) return null

  const days = buildHeatmapDays()
  const today = effectiveLocalDate()
  const labels = monthLabels(days)

  return (
    <div className="habit-heatmap-wrapper">
      {/* 左列: 習慣名（スクロールに追従しない） */}
      <div className="habit-heatmap-names">
        <div className="habit-heatmap-name-spacer" />
        {habits.map(habit => (
          <div key={habit.id} className="habit-heatmap-label" title={habit.name}>
            {habit.name}
          </div>
        ))}
      </div>

      {/* 右列: 月ラベル + セル（横スクロール） */}
      <div className="habit-heatmap-scroll" ref={scrollRef}>
        <div className="habit-heatmap-rows">
          <div className="habit-heatmap-months">
            {labels.map(({ label, index }) => (
              <span key={label} className="habit-heatmap-month" style={{ left: index * CELL_W }}>
                {label}
              </span>
            ))}
          </div>
          {habits.map(habit => {
            const done = doneMap[habit.id] ?? new Set()
            return (
              <div key={habit.id} className="habit-heatmap-row">
                {days.map((day, i) => (
                  <span
                    key={day}
                    className={`habit-heatmap-cell${done.has(day) ? ' done' : ''}${day === today ? ' today' : ''}`}
                    title={`${day}${done.has(day) ? ' ✓' : ''}`}
                    style={{ marginLeft: i > 0 && i % 7 === 0 ? 4 : undefined }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
