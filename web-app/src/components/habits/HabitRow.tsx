import React, { useRef, useState } from 'react'
import type { Habit } from '../../api.ts'
import { useEditableRow } from '../../hooks/useEditableRow.ts'
import HabitSettingsFields from './HabitSettingsFields.tsx'
import { settingsFromHabit, settingsToHabitFields } from './habitSettings.ts'

type Props = {
  habit: Habit
  onSave: (habit: Habit) => Promise<void>
  onDelete: (habit: Habit) => Promise<void>
  onCheckIn: (habit: Habit) => Promise<void>
}

export default function HabitRow({ habit, onSave, onDelete, onCheckIn }: Props) {
  const { editing, setEditing, busy, setBusy, menuOpen, setMenuOpen, rowRef } = useEditableRow()
  const [name, setName] = useState(habit.name)
  const [settings, setSettings] = useState(() => settingsFromHabit(habit))
  const editorRef = useRef<HTMLDivElement>(null)
  // Escape/Cancel blurs the input; this flag stops that blur from committing the edit.
  const cancelledRef = useRef(false)

  function cancel() {
    cancelledRef.current = true
    setName(habit.name)
    setSettings(settingsFromHabit(habit))
    setEditing(false)
    setTimeout(() => { cancelledRef.current = false }, 0)
  }

  async function commitSave() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSave({ ...habit, name: name.trim(), ...settingsToHabitFields(settings) })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  // Commit only when focus leaves the whole editor, not when moving between its fields.
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
            <span className="habit-check-indicator">✓</span>
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
            <HabitSettingsFields value={settings} onChange={setSettings} onBlur={handleBlur} variant="editor" />
          </div>
          <div className="actions">
            <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}
