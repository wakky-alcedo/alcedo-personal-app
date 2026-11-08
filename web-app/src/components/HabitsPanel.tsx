import React, { useMemo, useState } from 'react'
import HabitHeatmap from './HabitHeatmap.tsx'
import HabitQuickCheck from './habits/HabitQuickCheck.tsx'
import HabitRow from './habits/HabitRow.tsx'
import NewHabitForm from './habits/NewHabitForm.tsx'
import { useHabits } from '../hooks/useHabits.ts'

type Props = {
  compact?: boolean
}

export default function HabitsPanel({ compact = false }: Props) {
  const { habits, doneMap, loading, refresh, create, save, remove, checkIn } = useHabits()
  const [listOpen, setListOpen] = useState(false)
  const activeHabits = useMemo(() => habits.filter(h => h.isActive), [habits])

  if (compact) {
    return (
      <section className="habits-panel habits-panel--compact">
        <div className="section-header">
          <h2>Habits</h2>
          <button type="button" className="compact-panel-btn" onClick={refresh} disabled={loading} title="Refresh">↺</button>
        </div>
        <HabitQuickCheck habits={activeHabits} disabled={loading} compact onCheckIn={checkIn} />
        <HabitHeatmap habits={activeHabits} doneMap={doneMap} />
      </section>
    )
  }

  return (
    <section className="habits-panel">
      <div className="section-header">
        <h2>Habits</h2>
        <button type="button" onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <HabitQuickCheck habits={activeHabits} disabled={loading} compact={false} onCheckIn={checkIn} />

      <button type="button" className="collapse-toggle" onClick={() => setListOpen(v => !v)}>
        {listOpen ? '▾' : '▸'} All habits ({habits.length})
      </button>

      {listOpen && (
        <>
          <NewHabitForm disabled={loading} onCreate={create} />
          {loading ? <div>Loading...</div> : null}
          <ul className="habit-list">
            {habits.map(habit => (
              <HabitRow key={habit.id} habit={habit} onSave={save} onDelete={remove} onCheckIn={checkIn} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
