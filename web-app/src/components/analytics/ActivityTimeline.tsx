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
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

type Block = {
  startTime: string
  endTime: string
  processName: string
  category: string
  isMediaPlaying: boolean
  count: number
  ids: string[]
}

function mergeIntoBlocks(logs: ActivityLog[]): Block[] {
  if (logs.length === 0) return []
  const blocks: Block[] = []
  let current: Block = {
    startTime: logs[0].timestamp,
    endTime: logs[0].timestamp,
    processName: logs[0].processName,
    category: logs[0].category,
    isMediaPlaying: logs[0].isMediaPlaying,
    count: 1,
    ids: [logs[0].id],
  }
  for (let i = 1; i < logs.length; i++) {
    const log = logs[i]
    if (log.processName === current.processName && log.category === current.category) {
      current.endTime = log.timestamp
      current.count++
      current.ids.push(log.id)
      if (log.isMediaPlaying) current.isMediaPlaying = true
    } else {
      blocks.push(current)
      current = {
        startTime: log.timestamp,
        endTime: log.timestamp,
        processName: log.processName,
        category: log.category,
        isMediaPlaying: log.isMediaPlaying,
        count: 1,
        ids: [log.id],
      }
    }
  }
  blocks.push(current)
  return blocks
}

type Props = {
  logs: ActivityLog[]
  categories: string[]
  onUpdateCategory: (id: string, category: string) => void
}

export default function ActivityTimeline({ logs, categories, onUpdateCategory }: Props) {
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const blocks = mergeIntoBlocks(logs)

  if (blocks.length === 0) {
    return <div className="analytics-empty">作業記録がありません</div>
  }

  function handleCategoryChange(block: Block, newCategory: string) {
    for (const id of block.ids) {
      onUpdateCategory(id, newCategory)
    }
    setEditingBlock(null)
  }

  return (
    <div className="activity-timeline">
      {blocks.map((block, i) => {
        const key = `${block.startTime}-${i}`
        const durationMin = Math.round(block.count * 15 / 60)
        const isEditing = editingBlock === key
        return (
          <div key={key} className="activity-block">
            <div className="activity-block-time">
              {formatTime(block.startTime)}
              {block.count > 1 && <span className="activity-block-duration">({durationMin}m)</span>}
            </div>
            <div className="activity-block-bar" style={{ backgroundColor: colorFor(block.category) }} />
            <div className="activity-block-content">
              <div className="activity-block-header">
                <button
                  type="button"
                  className="activity-block-category"
                  style={{ color: colorFor(block.category) }}
                  onClick={() => setEditingBlock(isEditing ? null : key)}
                >
                  {block.category}
                </button>
                <span className="activity-block-process">{block.processName}</span>
                {block.isMediaPlaying && <span className="activity-block-media" title="メディア再生中">♪</span>}
              </div>
              {isEditing && (
                <div className="activity-block-edit">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`filter-chip${cat === block.category ? ' active' : ''}`}
                      onClick={() => handleCategoryChange(block, cat)}
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
