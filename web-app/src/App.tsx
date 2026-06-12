import React, { useEffect, useState } from 'react'
import { getTasks, createTask, updateTask, deleteTask, type Task } from './api.ts'
import { CategoryColorsProvider } from './CategoryColorsContext.tsx'
import { AppConfigProvider, useAppConfig } from './contexts/AppConfigContext.tsx'
import { ToastProvider } from './contexts/ToastContext.tsx'
import { NotificationSettingsProvider } from './contexts/NotificationSettingsContext.tsx'
import ToastContainer from './components/ToastContainer.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import AnalyticsPage from './pages/AnalyticsPage.tsx'
import MemosPage from './pages/MemosPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import { useDueTaskNotifications } from './hooks/useDueTaskNotifications.ts'

type Tab = 'dashboard' | 'memos' | 'analytics' | 'settings'

const VALID_TABS: Tab[] = ['dashboard', 'memos', 'analytics', 'settings']

function readTabFromHash(): Tab {
  const hash = window.location.hash.slice(1) as Tab
  return VALID_TABS.includes(hash) ? hash : 'dashboard'
}

function AppBody() {
  const { serverUrl, apiKey } = useAppConfig()
  const [tab, setTab] = useState<Tab>(readTabFromHash)

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { refresh() }, [serverUrl, apiKey])

  useEffect(() => {
    const es = new EventSource(`${serverUrl}/api/v1/events?key=${encodeURIComponent(apiKey)}`)
    es.onmessage = async () => {
      try {
        const list = await getTasks(serverUrl, apiKey)
        setTasks(list)
      } catch {}
    }
    return () => es.close()
  }, [serverUrl, apiKey])

  useDueTaskNotifications(tasks)

  async function refresh() {
    setLoading(true)
    try {
      const list = await getTasks(serverUrl, apiKey)
      setTasks(list)
    } catch (e) {
      console.error(e)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(task: Partial<Task> & { title: string }) {
    await createTask(serverUrl, apiKey, task)
    // EventSource handles adding the new task to the list
  }

  async function handleSave(task: Task) {
    const optimistic = { ...task, version: task.version + 1, updatedAt: new Date().toISOString() }
    setTasks(prev => prev.map(t => t.id === task.id ? optimistic : t))
    try {
      await updateTask(serverUrl, apiKey, task)
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      throw e
    }
  }

  async function handleDelete(task: Task) {
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try {
      await deleteTask(serverUrl, apiKey, task)
    } catch (e) {
      setTasks(prev => [...prev, task])
      throw e
    }
  }

  return (
    <div className="container">
      <header>
        <div className="app-header-row">
          <h1>Alcedo</h1>
          <nav className="top-tab-nav">
            {([
              ['dashboard', 'ダッシュボード'],
              ['memos', 'メモ'],
              ['analytics', '分析'],
              ['settings', '設定'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                type="button"
                className={`top-tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => { window.location.hash = t }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === 'dashboard' && (
        <DashboardPage
          loading={loading}
          tasks={tasks}
          onCreateTask={handleCreate}
          onSaveTask={handleSave}
          onDeleteTask={handleDelete}
        />
      )}
      {tab === 'memos' && <MemosPage />}
      {tab === 'analytics' && <AnalyticsPage />}
      {tab === 'settings' && (
        <SettingsPage
          loading={loading}
          onRefresh={refresh}
        />
      )}
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <AppConfigProvider>
      <ToastProvider>
        <NotificationSettingsProvider>
          <CategoryColorsProvider>
            <AppBody />
          </CategoryColorsProvider>
        </NotificationSettingsProvider>
      </ToastProvider>
    </AppConfigProvider>
  )
}
