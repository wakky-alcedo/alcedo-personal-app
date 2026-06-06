import React from 'react'
import ActiveTabBanner from '../components/ActiveTabBanner.tsx'
import BeliefsPanel from '../components/BeliefsPanel.tsx'
import HabitsPanel from '../components/HabitsPanel.tsx'
import TasksPanel from '../components/TasksPanel.tsx'
import type { Task } from '../api.ts'

type Props = {
  loading: boolean
  tasks: Task[]
  onCreateTask: (task: Partial<Task> & { title: string }) => Promise<void>
  onSaveTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
}

export default function DashboardPage({ loading, tasks, onCreateTask, onSaveTask, onDeleteTask }: Props) {
  return (
    <main>
      <ActiveTabBanner />
      <BeliefsPanel compact />
      <HabitsPanel compact />
      <TasksPanel
        loading={loading}
        tasks={tasks}
        onCreateTask={onCreateTask}
        onSaveTask={onSaveTask}
        onDeleteTask={onDeleteTask}
      />
    </main>
  )
}