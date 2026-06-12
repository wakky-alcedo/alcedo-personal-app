import React from 'react'
import { useNotificationSettings } from '../contexts/NotificationSettingsContext.tsx'

export default function NotificationSettingsPanel() {
  const { enabled, reminderMinutes, permission, setEnabled, setReminderMinutes, requestPermission } =
    useNotificationSettings()

  return (
    <div className="settings-group">
      <div className="featured-label">タスク期限通知</div>
      <label className="settings-row checkbox-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
        <span className="settings-label">通知を有効化</span>
      </label>
      <label className="settings-row">
        <span className="settings-label">何分前に通知</span>
        <input
          className="settings-input"
          type="number"
          min={1}
          max={1440}
          value={reminderMinutes}
          disabled={!enabled}
          onChange={e => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) setReminderMinutes(n)
          }}
        />
      </label>
      {permission !== 'unsupported' && (
        <div className="settings-row">
          <span className="settings-label">ブラウザ通知</span>
          {permission === 'granted' && <span className="settings-hint">許可済み</span>}
          {permission === 'denied' && (
            <span className="settings-hint">
              ブロックされています。ブラウザ設定から許可してください(許可しない場合はアプリ内通知が表示されます)。
            </span>
          )}
          {permission === 'default' && (
            <button type="button" className="settings-refresh-btn" onClick={requestPermission}>
              通知を許可する
            </button>
          )}
        </div>
      )}
      {permission === 'unsupported' && (
        <div className="settings-row">
          <span className="settings-label">ブラウザ通知</span>
          <span className="settings-hint">このブラウザは未対応です(アプリ内通知のみ表示されます)。</span>
        </div>
      )}
    </div>
  )
}
