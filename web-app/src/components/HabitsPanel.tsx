import React, { useEffect, useMemo, useState } from 'react'
import { checkInHabit, createHabit, deleteHabit, getHabits, updateHabit, type Habit, type HabitInput } from '../api.ts'

type Props = {
  serverUrl: string
  apiKey: string
}

function HabitRow({ habit, onSave, onDelete, onCheckIn }: { habit: Habit; onSave: (habit: Habit) => Promise<void>; onDelete: (habit: Habit) => Promise<void>; onCheckIn: (habit: Habit) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(habit.name)
  const [notifyTime, setNotifyTime] = useState(habit.notifyTime ?? '')
  const [priorityStart, setPriorityStart] = useState(habit.widgetPriorityTimeRangeStart ?? '')
  const [priorityEnd, setPriorityEnd] = useState(habit.widgetPriorityTimeRangeEnd ?? '')
  const [isActive, setIsActive] = useState(habit.isActive)

  async function save() {
    setBusy(true)
    try {
      await onSave({
        ...habit,
        name: name.trim(),
        notifyTime: notifyTime || null,
        widgetPriorityTimeRangeStart: priorityStart || null,
        widgetPriorityTimeRangeEnd: priorityEnd || null,
        isActive,
      })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete habit: ${habit.name}?`)) return
    setBusy(true)
    try {
      await onDelete(habit)
    } finally {
      setBusy(false)
    }
  }

  async function doneToday() {
    setBusy(true)
    try {
      await onCheckIn(habit)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`habit-row${habit.isActive ? '' : ' inactive'}`}>
      {!editing ? (
        <>
          <div>
            <button type="button" className="link-button task-node-title" onClick={() => setEditing(true)}>{habit.name}</button>
            <div className="meta">
              {habit.id} • {habit.isActive ? 'active' : 'inactive'} • notify: {habit.notifyTime || 'none'} • streak: {habit.streakDays} day(s)
            </div>
            <div className="description">
              {habit.completedToday ? 'Done today' : 'Not done today'}
              {habit.lastDoneDate ? ` • last done: ${habit.lastDoneDate}` : ''}
            </div>
          </div>
          <div className="actions">
            <button type="button" onClick={doneToday} disabled={busy || habit.completedToday}>Done today</button>
            <button type="button" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
            <button type="button" onClick={remove} disabled={busy}>Delete</button>
          </div>
        </>
      ) : (
        <div className="habit-editor">
          <input value={name} onChange={e => setName(e.target.value)} />
          <input type="time" value={notifyTime} onChange={e => setNotifyTime(e.target.value)} />
          <input type="time" value={priorityStart} onChange={e => setPriorityStart(e.target.value)} />
          <input type="time" value={priorityEnd} onChange={e => setPriorityEnd(e.target.value)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            active
          </label>
          <div className="actions">
            <button type="button" onClick={save} disabled={busy}>Save</button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function HabitsPanel({ serverUrl, apiKey }: Props) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [notifyTime, setNotifyTime] = useState('')
  const [priorityStart, setPriorityStart] = useState('')
  const [priorityEnd, setPriorityEnd] = useState('')
  const [isActive, setIsActive] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const nextHabits = await getHabits(serverUrl, apiKey)
      setHabits(nextHabits)
    } catch (error) {
      console.error(error)
      setHabits([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [serverUrl, apiKey])

  const quickHabits = useMemo(() => habits.filter(habit => habit.isActive).slice(0, 3), [habits])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const payload: HabitInput = {
      name: name.trim(),
      notifyTime: notifyTime || null,
      widgetPriorityTimeRangeStart: priorityStart || null,
      widgetPriorityTimeRangeEnd: priorityEnd || null,
      isActive,
    }
    await createHabit(serverUrl, apiKey, payload)
    setName('')
    setNotifyTime('')
    setPriorityStart('')
    setPriorityEnd('')
    setIsActive(true)
    await refresh()
  }

  async function handleSave(habit: Habit) {
    await updateHabit(serverUrl, apiKey, habit)
    await refresh()
  }

  async function handleDelete(habit: Habit) {
    await deleteHabit(serverUrl, apiKey, habit)
    await refresh()
  }

  async function handleCheckIn(habit: Habit) {
    await checkInHabit(serverUrl, apiKey, habit)
    await refresh()
  }

  return (
    <section className="habits-panel">
      <div className="section-header">
        <h2>Habits</h2>
        <button type="button" onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <div className="featured-card habit-featured">
        <div className="featured-label">Quick check</div>
        <div className="habit-quick-list">
          {quickHabits.length === 0 ? (
            <div className="featured-text">No active habits yet</div>
          ) : (
            quickHabits.map(habit => (
              <button
                key={habit.id}
                type="button"
                className="habit-quick-card"
                onClick={() => handleCheckIn(habit)}
                disabled={loading || habit.completedToday}
              >
                <div className="title">{habit.name}</div>
                <div className="meta">streak: {habit.streakDays} • {habit.completedToday ? 'done today' : 'tap to complete'}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <form className="habit-form" onSubmit={handleCreate}>
        <input placeholder="New habit name" value={name} onChange={e => setName(e.target.value)} />
        <input type="time" value={notifyTime} onChange={e => setNotifyTime(e.target.value)} />
        <input type="time" value={priorityStart} onChange={e => setPriorityStart(e.target.value)} />
        <input type="time" value={priorityEnd} onChange={e => setPriorityEnd(e.target.value)} />
        <label className="checkbox-row">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          active
        </label>
        <button type="submit" disabled={loading}>Add Habit</button>
      </form>

      {loading ? <div>Loading...</div> : null}
      <ul className="habit-list">
        {habits.map(habit => (
          <HabitRow key={habit.id} habit={habit} onSave={handleSave} onDelete={handleDelete} onCheckIn={handleCheckIn} />
        ))}
      </ul>
    </section>
  )
}