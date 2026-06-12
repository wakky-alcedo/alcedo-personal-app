import React, { useState } from 'react'
import type { TaskInput } from '../api.ts'
import { useToast } from '../contexts/ToastContext.tsx'

type Props = {
  onCreate: (task: Partial<TaskInput> & { title: string }) => Promise<void>
}

export default function NewTaskForm({ onCreate }: Props) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskInput['priority']>('medium')
  const [dueAt, setDueAt] = useState('')
  const [dueTime, setDueTime] = useState('')
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
        dueTime: dueTime || null,
        subtasks: [],
      })
      setTitle('')
      setPriority('low')
      setDueAt('')
      setDueTime('')
    } catch (err) {
      console.error(err)
      toast.error('タスクの作成に失敗しました')
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
      <input type="date" value={dueAt} onChange={e => {
        const next = e.target.value
        setDueAt(next)
        if (!next) setDueTime('')
      }} />
      <input
        type="time"
        value={dueTime}
        onChange={e => setDueTime(e.target.value)}
        disabled={!dueAt}
        aria-label="Due time"
      />
      <button type="submit" disabled={busy}>Add Task</button>
    </form>
  )
}
