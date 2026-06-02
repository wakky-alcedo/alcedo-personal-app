import React, { useEffect, useState } from 'react'
import { getTasks, createTask, updateTask, deleteTask, type Task } from './api.ts'
import DashboardPage from './pages/DashboardPage.tsx'
import AnalyticsPage from './pages/AnalyticsPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'

const DEFAULT_SERVER = (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:8787'
const DEFAULT_API_KEY = 'dev-local-key'
const LS_SERVER_KEY = 'alcedo_server_url'
const LS_API_KEY = 'alcedo_api_key'

type Tab = 'dashboard' | 'analytics' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(
    () => localStorage.getItem(LS_SERVER_KEY) ?? DEFAULT_SERVER
  )
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(LS_API_KEY) ?? DEFAULT_API_KEY
  )

  function handleServerUrlChange(value: string) {
    setServerUrl(value)
    localStorage.setItem(LS_SERVER_KEY, value)
  }

  function handleApiKeyChange(value: string) {
    setApiKey(value)
    localStorage.setItem(LS_API_KEY, value)
  }

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
          onServerUrlChange={handleServerUrlChange}
          onApiKeyChange={handleApiKeyChange}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
