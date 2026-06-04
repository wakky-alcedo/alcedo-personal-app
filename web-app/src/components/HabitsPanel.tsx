import React, { useEffect, useMemo, useRef, useState } from 'react'
import { checkInHabit, createHabit, deleteHabit, getHabitLogs, getHabits, updateHabit, type Habit, type HabitInput } from '../api.ts'
import HabitHeatmap, { buildHeatmapDays, HEATMAP_DAYS } from './HabitHeatmap.tsx'

type Props = {
  serverUrl: string
  apiKey: string
  compact?: boolean
}

function HabitRow({ habit, onSave, onDelete, onCheckIn }: {
  habit: Habit
  onSave: (habit: Habit) => Promise<void>
  onDelete: (habit: Habit) => Promise<void>
  onCheckIn: (habit: Habit) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [name, setName] = useState(habit.name)
  const [notifyTime, setNotifyTime] = useState(habit.notifyTime ?? '')
  const [priorityStart, setPriorityStart] = useState(habit.widgetPriorityTimeRangeStart ?? '')
  const [priorityEnd, setPriorityEnd] = useState(habit.widgetPriorityTimeRangeEnd ?? '')
  const [isActive, setIsActive] = useState(habit.isActive)
  const rowRef = useRef<HTMLLIElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e: PointerEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [menuOpen])

  function cancel() {
    cancelledRef.current = true
    setName(habit.name)
    setNotifyTime(habit.notifyTime ?? '')
    setPriorityStart(habit.widgetPriorityTimeRangeStart ?? '')
    setPriorityEnd(habit.widgetPriorityTimeRangeEnd ?? '')
    setIsActive(habit.isActive)
    setEditing(false)
    setTimeout(() => { cancelledRef.current = false }, 0)
  }

  async function commitSave() {
    if (!name.trim()) return
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

  function handleBlur() {
    setTimeout(() => {
      if (cancelledRef.current) return
      if (!editorRef.current?.contains(document.activeElement)) void commitSave()
    }, 0)
  }

  async function remove() {
    if (!window.confirm(`Delete habit: ${habit.name}?`)) return
    setBusy(true)
    try { await onDelete(habit) } finally { setBusy(false) }
  }

  async function doneToday() {
    setBusy(true)
    try { await onCheckIn(habit) } finally { setBusy(false) }
  }

  return (
    <li ref={rowRef} className={`habit-row${habit.isActive ? '' : ' inactive'}`}>
      {!editing ? (
        <div className="task-node-body">
          <div className="task-node-head">
            <span className={`habit-check-indicator${habit.completedToday ? ' completed' : ''}`}>✓</span>
            <button
              type="button"
              className="link-button task-node-title habit-row-name"
              onClick={() => setEditing(true)}
            >
              {habit.name}
            </button>
            {habit.streakDays > 0 && (
              <span className="habit-streak-badge">🔥 {habit.streakDays}</span>
            )}
            <button
              type="button"
              className="task-node-menu-button"
              onClick={() => setMenuOpen(v => !v)}
              disabled={busy}
              aria-label={`Actions for ${habit.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
          </div>
          {menuOpen && (
            <div className="task-node-menu" role="menu">
              {!habit.completedToday && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void doneToday() }} disabled={busy}>
                  Done today
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true) }} disabled={busy}>
                Edit
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void remove() }} disabled={busy}>
                Delete
              </button>
            </div>
          )}
        </div>
      ) : (
        <div ref={editorRef} className="habit-editor">
          <div className="task-node-head">
            <span className={`habit-check-indicator${isActive ? '' : ''}`}>✓</span>
            <input
              autoFocus
              className="habit-name-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); void commitSave() }
                if (e.key === 'Escape') { e.preventDefault(); cancel() }
              }}
              onBlur={handleBlur}
            />
          </div>
          <div className="habit-secondary-fields">
            <label className="habit-field">
              <span className="field-label">通知時刻</span>
              <input type="time" value={notifyTime} onChange={e => setNotifyTime(e.target.value)} onBlur={handleBlur} />
            </label>
            <label className="habit-field">
              <span className="field-label">ウィジェット優先 開始</span>
              <input type="time" value={priorityStart} onChange={e => setPriorityStart(e.target.value)} onBlur={handleBlur} />
            </label>
            <label className="habit-field">
              <span className="field-label">ウィジェット優先 終了</span>
              <input type="time" value={priorityEnd} onChange={e => setPriorityEnd(e.target.value)} onBlur={handleBlur} />
            </label>
            <label className="checkbox-row habit-field">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span className="field-label">active</span>
            </label>
          </div>
          <div className="actions">
            <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function HabitsPanel({ serverUrl, apiKey, compact = false }: Props) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [doneMap, setDoneMap] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [name, setName] = useState('')
  const [notifyTime, setNotifyTime] = useState('')
  const [priorityStart, setPriorityStart] = useState('')
  const [priorityEnd, setPriorityEnd] = useState('')
  const [isActive, setIsActive] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const days = buildHeatmapDays()
      const [nextHabits, logs] = await Promise.all([
        getHabits(serverUrl, apiKey),
        getHabitLogs(serverUrl, apiKey, days[0], days[HEATMAP_DAYS - 1]),
      ])
      setHabits(nextHabits)
      const map: Record<string, Set<string>> = {}
      for (const { habitId, doneDate } of logs) {
        if (!map[habitId]) map[habitId] = new Set()
        map[habitId].add(doneDate)
      }
      setDoneMap(map)
    } catch (error) {
      console.error(error)
      setHabits([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [serverUrl, apiKey])

  const quickHabits = useMemo(() => habits.filter(h => h.isActive), [habits])

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

  async function handleSave(habit: Habit) { await updateHabit(serverUrl, apiKey, habit); await refresh() }
  async function handleDelete(habit: Habit) { await deleteHabit(serverUrl, apiKey, habit); await refresh() }
  async function handleCheckIn(habit: Habit) { await checkInHabit(serverUrl, apiKey, habit); await refresh() }

  const quickCheckCard = (
    <div className="featured-card habit-featured">
      <div className="featured-label">Habit check</div>
      <div className="habit-quick-list">
        {quickHabits.length === 0 ? (
          <div className="featured-text">No active habits yet</div>
        ) : (
          quickHabits.map(habit => (
            <button
              key={habit.id}
              type="button"
              className={`habit-quick-card${habit.completedToday ? ' done' : ''}`}
              onClick={() => handleCheckIn(habit)}
              disabled={loading || habit.completedToday}
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

  if (compact) {
    return (
      <section className="habits-panel habits-panel--compact">
        <div className="section-header">
          <h2>Habits</h2>
          <button type="button" className="compact-panel-btn" onClick={refresh} disabled={loading} title="Refresh">↺</button>
        </div>
        <div className="habit-quick-list habit-quick-list--compact">
          {quickHabits.length === 0 ? (
            <span className="compact-empty">No active habits</span>
          ) : (
            quickHabits.map(habit => (
              <button
                key={habit.id}
                type="button"
                className={`habit-quick-card habit-quick-card--compact${habit.completedToday ? ' done' : ''}`}
                onClick={() => handleCheckIn(habit)}
                disabled={loading || habit.completedToday}
              >
                <span className="habit-quick-name">{habit.name}</span>
                <span className="habit-quick-meta">
                  {habit.streakDays > 0 ? `🔥${habit.streakDays} ` : ''}{habit.completedToday ? '✓' : ''}
                </span>
              </button>
            ))
          )}
        </div>
        <HabitHeatmap habits={habits.filter(h => h.isActive)} doneMap={doneMap} />
      </section>
    )
  }

  return (
    <section className="habits-panel">
      <div className="section-header">
        <h2>Habits</h2>
        <button type="button" onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <div className="featured-card habit-featured">
        <div className="featured-label">Habit check</div>
        <div className="habit-quick-list">
          {quickHabits.length === 0 ? (
            <div className="featured-text">No active habits yet</div>
          ) : (
            quickHabits.map(habit => (
              <button
                key={habit.id}
                type="button"
                className={`habit-quick-card${habit.completedToday ? ' done' : ''}`}
                onClick={() => handleCheckIn(habit)}
                disabled={loading || habit.completedToday}
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

      <button type="button" className="collapse-toggle" onClick={() => setListOpen(v => !v)}>
        {listOpen ? '▾' : '▸'} All habits ({habits.length})
      </button>

      {listOpen && (
        <>
          <form className="habit-form" onSubmit={handleCreate}>
            <input placeholder="New habit name" value={name} onChange={e => setName(e.target.value)} />
            <label className="habit-field">
              <span className="field-label">通知時刻</span>
              <input type="time" value={notifyTime} onChange={e => setNotifyTime(e.target.value)} />
            </label>
            <label className="habit-field">
              <span className="field-label">ウィジェット優先 開始</span>
              <input type="time" value={priorityStart} onChange={e => setPriorityStart(e.target.value)} />
            </label>
            <label className="habit-field">
              <span className="field-label">ウィジェット優先 終了</span>
              <input type="time" value={priorityEnd} onChange={e => setPriorityEnd(e.target.value)} />
            </label>
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
        </>
      )}
    </section>
  )
}
