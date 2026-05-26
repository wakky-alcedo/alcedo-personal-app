import React, { useEffect, useState } from 'react'
import { getTasks, createTask, updateTask, deleteTask, markTaskDone, type Task } from './api.ts'
import DashboardPage from './pages/DashboardPage.tsx'
import AnalyticsPage from './pages/AnalyticsPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'

const DEFAULT_SERVER = (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:8787'
const DEFAULT_API_KEY = 'dev-local-key'

type Tab = 'dashboard' | 'analytics' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER)
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY)

  useEffect(() => { refresh() }, [serverUrl, apiKey])

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
    await refresh()
  }

  async function handleSave(task: Task) {
    await updateTask(serverUrl, apiKey, task)
    await refresh()
  }

  async function handleDone(task: Task) {
    await markTaskDone(serverUrl, apiKey, task)
    await refresh()
  }

  async function handleDelete(task: Task) {
    await deleteTask(serverUrl, apiKey, task)
    await refresh()
  }

  return (
    <div className="container">
      <header>
        <div className="app-header-row">
          <h1>Alcedo</h1>
          <nav className="top-tab-nav">
            {([
              ['dashboard', 'ダッシュボード'],
              ['analytics', '分析'],
              ['settings', '設定'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                type="button"
                className={`top-tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === 'dashboard' && (
        <DashboardPage
          serverUrl={serverUrl}
          apiKey={apiKey}
          loading={loading}
          tasks={tasks}
          onCreateTask={handleCreate}
          onDoneTask={handleDone}
          onSaveTask={handleSave}
          onDeleteTask={handleDelete}
        />
      )}
      {tab === 'analytics' && <AnalyticsPage serverUrl={serverUrl} apiKey={apiKey} />}
      {tab === 'settings' && (
        <SettingsPage
          serverUrl={serverUrl}
          apiKey={apiKey}
          loading={loading}
          onServerUrlChange={setServerUrl}
          onApiKeyChange={setApiKey}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
