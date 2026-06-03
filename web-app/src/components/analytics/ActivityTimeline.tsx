import React, { useState } from 'react'
import type { ActivityLog } from '../../api.ts'

const CATEGORY_COLORS: Record<string, string> = {
  '開発': '#4757ff',
  'ブラウザ': '#6366f1',
  'コミュニケーション': '#10b981',
  '学習': '#0ea5e9',
  'SNS': '#ef4444',
  '娯楽': '#f59e0b',
  '未分類': '#94a3b8',
}

function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6b7280'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDurationSec(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`
}

function sessionDuration(log: ActivityLog): number {
  if (!log.endedAt) return 0
  return Math.round((new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
}

type Props = {
  logs: ActivityLog[]
  categories: string[]
  onUpdateCategory: (id: string, category: string) => void
}

export default function ActivityTimeline({ logs, categories, onUpdateCategory }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (logs.length === 0) {
    return <div className="analytics-empty">作業記録がありません</div>
  }

  return (
    <div className="activity-timeline">
      {logs.map((log) => {
        const isOpen = !log.endedAt
        const dur = sessionDuration(log)
        const isEditing = editingId === log.id
        return (
          <div key={log.id} className={`activity-block${isOpen ? ' activity-block--open' : ''}`}>
            <div className="activity-block-time">
              <span>{formatTime(log.startedAt)}</span>
              {dur > 0 && <span className="activity-block-duration">{formatDurationSec(dur)}</span>}
              {isOpen && <span className="activity-block-duration">進行中</span>}
            </div>
            <div className="activity-block-bar" style={{ backgroundColor: colorFor(log.category) }} />
            <div className="activity-block-content">
              <div className="activity-block-title" title={log.windowTitle}>
                {log.windowTitle || log.processName}
              </div>
              <div className="activity-block-header">
                <button
                  type="button"
                  className="activity-block-category"
                  style={{ color: colorFor(log.category) }}
                  onClick={() => setEditingId(isEditing ? null : log.id)}
                >
                  {log.category}
                </button>
                <span className="activity-block-process">{log.processName}</span>
                <span className="activity-block-device">{log.deviceId}</span>
                {log.isMediaPlaying && <span className="activity-block-media" title="メディア再生中">♪</span>}
              </div>
              {log.browserUrl && (
                <div className="activity-block-url" title={log.browserUrl}>{log.browserUrl}</div>
              )}
              {isEditing && (
                <div className="activity-block-edit">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`filter-chip${cat === log.category ? ' active' : ''}`}
                      onClick={() => { onUpdateCategory(log.id, cat); setEditingId(null) }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
