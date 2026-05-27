import React, { useState } from 'react'
import type { TaskInput } from '../api.ts'

type Props = {
  onCreate: (task: Partial<TaskInput> & { title: string }) => Promise<void>
}

export default function NewTaskForm({ onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskInput['priority']>('medium')
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await onCreate({
        title: title.trim(),
        priority,
        dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
        subtasks: [],
      })
      setTitle('')
      setPriority('low')
      setDueAt('')
    } catch (err) {
      console.error(err)
      alert('Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="new-task">
      <input placeholder="New task title" value={title} onChange={e => setTitle(e.target.value)} />
      <select value={priority} onChange={e => setPriority(e.target.value as TaskInput['priority'])}>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
      <button type="submit" disabled={busy}>Add Task</button>
    </form>
  )
}
