import React from 'react'
import BeliefsPanel from '../components/BeliefsPanel.tsx'
import HabitsPanel from '../components/HabitsPanel.tsx'
import TasksPanel from '../components/TasksPanel.tsx'
import type { Task } from '../api.ts'

type Props = {
  serverUrl: string
  apiKey: string
  loading: boolean
  tasks: Task[]
  onCreateTask: (task: Partial<Task> & { title: string }) => Promise<void>
  onDoneTask: (task: Task) => Promise<void>
  onSaveTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
}

export default function DashboardPage({ serverUrl, apiKey, loading, tasks, onCreateTask, onDoneTask, onSaveTask, onDeleteTask }: Props) {
  return (
    <main>
      <BeliefsPanel serverUrl={serverUrl} apiKey={apiKey} compact />
      <HabitsPanel serverUrl={serverUrl} apiKey={apiKey} compact />
      <TasksPanel
        loading={loading}
        tasks={tasks}
        onCreateTask={onCreateTask}
        onDoneTask={onDoneTask}
        onSaveTask={onSaveTask}
        onDeleteTask={onDeleteTask}
      />
    </main>
  )
}