import React from 'react'
import type { Habit } from '../../api.ts'

type Props = {
  habits: Habit[]
  disabled: boolean
  compact: boolean
  onCheckIn: (habit: Habit) => void
}

/** One-tap "done today" buttons for active habits (dashboard compact or settings card). */
export default function HabitQuickCheck({ habits, disabled, compact, onCheckIn }: Props) {
  if (compact) {
    return (
      <div className="habit-quick-list habit-quick-list--compact">
        {habits.length === 0 ? (
          <span className="compact-empty">No active habits</span>
        ) : (
          habits.map(habit => (
            <button
              key={habit.id}
              type="button"
              className={`habit-quick-card habit-quick-card--compact${habit.completedToday ? ' done' : ''}`}
              onClick={() => onCheckIn(habit)}
              disabled={disabled || habit.completedToday}
            >
              <span className="habit-quick-name">{habit.name}</span>
              <span className="habit-quick-meta">
                {habit.streakDays > 0 ? `🔥${habit.streakDays} ` : ''}{habit.completedToday ? '✓' : ''}
              </span>
            </button>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="featured-card habit-featured">
      <div className="featured-label">Habit check</div>
      <div className="habit-quick-list">
        {habits.length === 0 ? (
          <div className="featured-text">No active habits yet</div>
        ) : (
          habits.map(habit => (
            <button
              key={habit.id}
              type="button"
              className={`habit-quick-card${habit.completedToday ? ' done' : ''}`}
              onClick={() => onCheckIn(habit)}
              disabled={disabled || habit.completedToday}
            >
              <div className="habit-quick-name">{habit.name}</div>
              <div className="habit-quick-meta">
                {habit.streakDays > 0 ? `🔥 ${habit.streakDays}  ` : ''}
                {habit.completedToday ? '✓ done' : 'tap to complete'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
