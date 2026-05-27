import React from 'react'
import BeliefsPanel from '../components/BeliefsPanel.tsx'
import HabitsPanel from '../components/HabitsPanel.tsx'

type Props = {
  serverUrl: string
  apiKey: string
  loading: boolean
  onServerUrlChange: (value: string) => void
  onApiKeyChange: (value: string) => void
  onRefresh: () => void
}

export default function SettingsPage({ serverUrl, apiKey, loading, onServerUrlChange, onApiKeyChange, onRefresh }: Props) {
  return (
    <section className="settings-panel">
      <div className="section-header">
        <h2>設定</h2>
      </div>

      <div className="settings-group">
        <div className="featured-label">サーバー接続</div>
        <label className="settings-row">
          <span className="settings-label">Server URL</span>
          <input
            className="settings-input"
            value={serverUrl}
            onChange={e => onServerUrlChange(e.target.value)}
            placeholder="http://localhost:8787"
          />
        </label>
        <label className="settings-row">
          <span className="settings-label">API Key</span>
          <input
            className="settings-input"
            type="password"
            value={apiKey}
            onChange={e => onApiKeyChange(e.target.value)}
            placeholder="dev-local-key"
          />
        </label>
        <button type="button" onClick={onRefresh} disabled={loading} className="settings-refresh-btn">
          {loading ? '読み込み中…' : 'データを再取得'}
        </button>
      </div>

      <BeliefsPanel serverUrl={serverUrl} apiKey={apiKey} />
      <HabitsPanel serverUrl={serverUrl} apiKey={apiKey} />
    </section>
  )
}
