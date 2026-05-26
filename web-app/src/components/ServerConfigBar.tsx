import React from 'react'

type Props = {
  serverUrl: string
  apiKey: string
  loading: boolean
  onServerUrlChange: (value: string) => void
  onApiKeyChange: (value: string) => void
  onRefresh: () => void
}

export default function ServerConfigBar({ serverUrl, apiKey, loading, onServerUrlChange, onApiKeyChange, onRefresh }: Props) {
  return (
    <div className="config">
      <label>
        Server URL <input value={serverUrl} onChange={e => onServerUrlChange(e.target.value)} />
      </label>
      <label>
        API Key <input value={apiKey} onChange={e => onApiKeyChange(e.target.value)} />
      </label>
      <button onClick={onRefresh} disabled={loading}>Refresh</button>
    </div>
  )
}