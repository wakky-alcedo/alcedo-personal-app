import React from 'react'
import type { Habit } from '../api.ts'

export const HEATMAP_DAYS = 60

export function buildHeatmapDays(): string[] {
  const today = new Date()
  return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (HEATMAP_DAYS - 1 - i))
    return d.toISOString().slice(0, 10)
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
  if (habits.length === 0) return null

  const days = buildHeatmapDays()
  const today = new Date().toISOString().slice(0, 10)
  const labels = monthLabels(days)

  return (
    <div className="habit-heatmap-scroll">
      <div className="habit-heatmap-grid">
        <div className="habit-heatmap-label" />
        <div className="habit-heatmap-months">
          {labels.map(({ label, index }) => (
            <span key={label} className="habit-heatmap-month" style={{ left: index * 14 }}>
              {label}
            </span>
          ))}
        </div>
        {habits.map(habit => {
          const done = doneMap[habit.id] ?? new Set()
          return (
            <React.Fragment key={habit.id}>
              <div className="habit-heatmap-label" title={habit.name}>{habit.name}</div>
              <div className="habit-heatmap-row">
                {days.map((day, i) => (
                  <span
                    key={day}
                    className={`habit-heatmap-cell${done.has(day) ? ' done' : ''}${day === today ? ' today' : ''}`}
                    title={`${day}${done.has(day) ? ' ✓' : ''}`}
                    style={{ marginLeft: i > 0 && i % 7 === 0 ? 4 : undefined }}
                  />
                ))}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
