import React, { useEffect, useMemo, useState } from 'react'
import type { Task } from '../../api.ts'
import TaskRow from './TaskRow.tsx'

type Props = {
  tasks?: Task[] | null
  onSave: (t: Task) => Promise<void>
  onDelete: (t: Task) => Promise<void>
}

type StatusFilter = 'all' | 'todo' | 'doing' | 'done'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

export default function TaskList({ tasks, onSave, onDelete }: Props) {
  const [sortMode, setSortMode] = useState<'manual' | 'priority' | 'dueAt' | 'title'>(
    () => (localStorage.getItem('taskListSortMode') as 'manual' | 'priority' | 'dueAt' | 'title') ?? 'manual'
  )
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(
    () => (localStorage.getItem('taskListFilterStatus') as StatusFilter) ?? 'all'
  )
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>(
    () => (localStorage.getItem('taskListFilterPriority') as PriorityFilter) ?? 'all'
  )

  useEffect(() => { localStorage.setItem('taskListSortMode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('taskListFilterStatus', filterStatus) }, [filterStatus])
  useEffect(() => { localStorage.setItem('taskListFilterPriority', filterPriority) }, [filterPriority])

  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter(task => !task.deletedAt)

  const orderedTasks = useMemo(() => {
    let list = safeTasks.slice()
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority)
    if (sortMode === 'manual') return list
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return list.sort((a, b) => {
      if (sortMode === 'priority') return (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99)
      if (sortMode === 'dueAt') {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      }
      return a.title.localeCompare(b.title)
    })
  }, [safeTasks, sortMode, filterStatus, filterPriority])

  if (safeTasks.length === 0) return <div>No tasks</div>

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'Todo' },
    { value: 'doing', label: 'Doing' },
    { value: 'done', label: 'Done' },
  ]
  const priorityChips: { value: PriorityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  return (
    <div className="task-list-shell">
      <div className="task-list-toolbar">
        <div className="filter-row">
          <span className="filter-row-label">Status</span>
          <div className="filter-chips">
            {statusChips.map(c => (
              <button
                key={c.value}
                type="button"
                className={`filter-chip${filterStatus === c.value ? ' active' : ''}`}
                onClick={() => setFilterStatus(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-row-label">Priority</span>
          <div className="filter-chips">
            {priorityChips.map(c => (
              <button
                key={c.value}
                type="button"
                className={`filter-chip${filterPriority === c.value ? ' active' : ''}`}
                onClick={() => setFilterPriority(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-row-label">Sort</span>
          <select className="sort-select" value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}>
            <option value="manual">manual</option>
            <option value="priority">priority</option>
            <option value="dueAt">due date</option>
            <option value="title">title</option>
          </select>
        </div>
      </div>
      {orderedTasks.length === 0 ? (
        <div className="task-list-empty">フィルタに一致するタスクがありません</div>
      ) : (
        <ul className="task-list">
          {orderedTasks.map(t => (
            <TaskRow key={t.id} task={t} onSave={onSave} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
