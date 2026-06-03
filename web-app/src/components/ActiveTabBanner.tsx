import React, { useEffect, useState } from 'react'
import { getCurrentActivity, type ActivityLog } from '../api.ts'

type Props = {
  serverUrl: string
  apiKey: string
}

export default function ActiveTabBanner({ serverUrl, apiKey }: Props) {
  const [log, setLog] = useState<ActivityLog | null>(null)

  async function fetchCurrent() {
    try {
      const data = await getCurrentActivity(serverUrl, apiKey)
      setLog(data)
    } catch {}
  }

  useEffect(() => {
    fetchCurrent()
    const id = setInterval(fetchCurrent, 15_000)
    return () => clearInterval(id)
  }, [serverUrl, apiKey])

  if (!log) return null

  return (
    <div className="active-tab-banner">
      <span className="active-tab-dot" />
      <span className="active-tab-title">{log.windowTitle || log.processName}</span>
      {log.browserUrl && (
        <span className="active-tab-url">{truncateUrl(log.browserUrl)}</span>
      )}
      <span className="active-tab-meta">
        {log.processName} · {log.category} · {formatAgo(log.timestamp)}
      </span>
    </div>
  )
}

function formatAgo(timestamp: string): string {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  return `${Math.floor(diff / 3600)}時間前`
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url.slice(0, 60)
  }
}
