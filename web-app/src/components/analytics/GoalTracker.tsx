import React, { useEffect, useState } from 'react'
import type { AnalyticsEntry } from '../../api.ts'
import { CATEGORY_COLORS, formatDuration } from './DailyPieChart.tsx'

const DEFAULT_CATEGORIES = ['学習', 'SNS', '娯楽', '移動', 'その他']
const GOALS_KEY = 'alcedo_analytics_goals'

export type Goals = Record<string, number>

function loadGoals(): Goals {
  try {
    const s = localStorage.getItem(GOALS_KEY)
    return s ? JSON.parse(s) : { '学習': 7200, 'SNS': 3600 }
  } catch { return { '学習': 7200, 'SNS': 3600 } }
}

function saveGoals(goals: Goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals))
}

type Props = { entries: AnalyticsEntry[] }

export default function GoalTracker({ entries }: Props) {
  const [goals, setGoals] = useState<Goals>(loadGoals)
  const [editOpen, setEditOpen] = useState(false)
  const [draftGoals, setDraftGoals] = useState<Goals>(loadGoals)

  useEffect(() => { setDraftGoals({ ...goals }) }, [editOpen])

  const actualByCat: Record<string, number> = {}
  for (const e of entries) actualByCat[e.category] = (actualByCat[e.category] ?? 0) + e.durationSec

  const goalCategories = Object.keys(goals).filter(c => goals[c] > 0)
  if (goalCategories.length === 0 && !editOpen) {
    return (
      <div className="goal-tracker">
        <button type="button" className="collapse-toggle" onClick={() => setEditOpen(true)}>
          ▸ 目標を設定
        </button>
      </div>
    )
  }

  const achievementPct = goalCategories.length > 0
    ? Math.round(
        goalCategories.reduce((sum, cat) => {
          const actual = actualByCat[cat] ?? 0
          const goal = goals[cat]
          // SNS is a limit (lower is better); others are targets (higher is better)
          const pct = cat === 'SNS'
            ? actual <= goal ? 1 : goal / actual
            : Math.min(actual / goal, 1)
          return sum + pct
        }, 0) / goalCategories.length * 100
      )
    : null

  return (
    <div className="goal-tracker">
      <div className="goal-tracker-header">
        <span className="section-caption">目標達成率</span>
        {achievementPct !== null && (
          <span className={`goal-overall-pct${achievementPct >= 80 ? ' good' : achievementPct >= 50 ? ' warn' : ' bad'}`}>
            {achievementPct}%
          </span>
        )}
        <button type="button" className="collapse-toggle" style={{ marginLeft: 'auto' }} onClick={() => setEditOpen(v => !v)}>
          {editOpen ? '▾' : '▸'} 目標編集
        </button>
      </div>

      <div className="goal-list">
        {goalCategories.map(cat => {
          const actual = actualByCat[cat] ?? 0
          const goal = goals[cat]
          const pct = cat === 'SNS'
            ? Math.min(actual / goal * 100, 100)
            : Math.min(actual / goal * 100, 100)
          const isSnS = cat === 'SNS'
          const over = actual > goal
          return (
            <div key={cat} className="goal-row">
              <span className="goal-cat" style={{ color: CATEGORY_COLORS[cat] ?? '#333' }}>{cat}</span>
              <div className="goal-bar-wrap">
                <div
                  className={`goal-bar-fill${isSnS && over ? ' sns-over' : ''}`}
                  style={{ width: `${pct}%`, background: isSnS && over ? '#ef4444' : (CATEGORY_COLORS[cat] ?? '#4757ff') }}
                />
              </div>
              <span className="goal-label">
                {formatDuration(actual)} / {formatDuration(goal)}
                {isSnS && over && ' ⚠️'}
              </span>
            </div>
          )
        })}
      </div>

      {editOpen && (
        <div className="goal-editor">
          {DEFAULT_CATEGORIES.map(cat => (
            <label key={cat} className="goal-edit-row">
              <span style={{ color: CATEGORY_COLORS[cat], minWidth: 48 }}>{cat}</span>
              <input
                type="number"
                min="0"
                placeholder="分"
                value={draftGoals[cat] != null ? Math.round(draftGoals[cat] / 60) : ''}
                onChange={e => setDraftGoals(g => ({ ...g, [cat]: Number(e.target.value) * 60 }))}
              />
              <span className="field-label">分/日</span>
            </label>
          ))}
          <div className="actions">
            <button type="button" onClick={() => {
              const next = Object.fromEntries(Object.entries(draftGoals).filter(([, v]) => v > 0))
              setGoals(next)
              saveGoals(next)
              setEditOpen(false)
            }}>保存</button>
            <button type="button" onClick={() => setEditOpen(false)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  )
}
