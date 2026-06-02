import React from 'react'
import { type Task } from '../api.ts'
import NewTaskForm from './NewTaskForm.tsx'
import TaskList from './TaskList.tsx'

type Props = {
  loading: boolean
  tasks: Task[]
  onCreateTask: (task: Partial<Task> & { title: string }) => Promise<void>
  onSaveTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
}

export default function TasksPanel({ loading, tasks, onCreateTask, onSaveTask, onDeleteTask }: Props) {
  return (
    <section className="tasks-panel">
      <div className="section-header">
        <h2>Tasks</h2>
      </div>

      <NewTaskForm onCreate={onCreateTask} />

      {loading ? <div>Loading...</div> : <TaskList tasks={tasks} onSave={onSaveTask} onDelete={onDeleteTask} />}
    </section>
  )
}