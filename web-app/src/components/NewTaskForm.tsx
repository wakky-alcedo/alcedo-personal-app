import React, { useState } from 'react'
import type { TaskInput, TaskNode } from '../api.ts'
import TaskSubtasksEditor from './TaskSubtasksEditor.tsx'

type Props = {
  onCreate: (task: Partial<TaskInput> & { title: string }) => Promise<void>
}

export default function NewTaskForm({ onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskInput['priority']>('low')
  const [categoryType, setCategoryType] = useState<TaskInput['categoryType']>('short_term')
  const [categoryName, setCategoryName] = useState('today')
  const [dueAt, setDueAt] = useState('')
  const [subtasks, setSubtasks] = useState<TaskNode[]>([])
  const [busy, setBusy] = useState(false)

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await onCreate({
        title: title.trim(),
        priority,
        categoryType,
        categoryName,
        dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
        subtasks,
      })
      setTitle('')
      setPriority('low')
      setCategoryType('short_term')
      setCategoryName('today')
      setDueAt('')
      setSubtasks([])
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
      <select value={categoryType} onChange={e => setCategoryType(e.target.value as TaskInput['categoryType'])}>
        <option value="short_term">short_term</option>
        <option value="long_term">long_term</option>
      </select>
      <input placeholder="category name" value={categoryName} onChange={e => setCategoryName(e.target.value)} />
      <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
      <TaskSubtasksEditor subtasks={subtasks} onChange={setSubtasks} />
      <button type="submit" disabled={busy}>Add Task</button>
    </form>
  )
}
