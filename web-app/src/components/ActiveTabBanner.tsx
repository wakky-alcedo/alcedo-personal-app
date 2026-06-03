import React, { useEffect, useState } from 'react'
import { getCurrentActivity, type ActivityLog } from '../api.ts'
import { formatAgo } from '../timeUtils.ts'

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
        {log.deviceId} · {log.category} · {formatAgo(log.startedAt)}
      </span>
    </div>
  )
}


function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url.slice(0, 60)
  }
}
