import React, { useCallback, useEffect, useState } from 'react'
import { getActivityRules, createActivityRule, deleteActivityRule, type ActivityRule } from '../api.ts'

type Props = { serverUrl: string; apiKey: string }

export default function ActivityRulesPanel({ serverUrl, apiKey }: Props) {
  const [rules, setRules] = useState<ActivityRule[]>([])
  const [pattern, setPattern] = useState('')
  const [field, setField] = useState<'processName' | 'windowTitle' | 'browserUrl'>('processName')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setRules(await getActivityRules(serverUrl, apiKey))
    } catch (e) { console.error(e) }
  }, [serverUrl, apiKey])

  useEffect(() => { refresh() }, [refresh])

  async function handleAdd() {
    if (!pattern || !category) return
    try {
      await createActivityRule(serverUrl, apiKey, { pattern, field, category, priority })
      setPattern('')
      setCategory('')
      setPriority(0)
      await refresh()
    } catch (e) { console.error(e) }
  }

  async function handleDelete(id: string) {
    try {
      await deleteActivityRule(serverUrl, apiKey, id)
      await refresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="settings-group">
      <div className="featured-label">分類ルール</div>

      <div className="activity-rule-form">
        <input
          className="settings-input"
          placeholder="正規表現パターン（例: Code|code）"
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <select
          className="sort-select"
          value={field}
          onChange={e => setField(e.target.value as 'processName' | 'windowTitle' | 'browserUrl')}
        >
          <option value="processName">プロセス名</option>
          <option value="windowTitle">ウィンドウタイトル</option>
          <option value="browserUrl">ブラウザURL</option>
        </select>
        <input
          className="settings-input"
          placeholder="カテゴリ名"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <input
          className="settings-input"
          type="number"
          placeholder="優先度"
          value={priority}
          onChange={e => setPriority(Number(e.target.value))}
          style={{ maxWidth: 64 }}
        />
        <button type="button" className="btn btn-primary" onClick={handleAdd}>追加</button>
      </div>

      {rules.length > 0 && (
        <ul className="activity-rule-list">
          {rules.map(rule => (
            <li key={rule.id} className="activity-rule-row">
              <code className="activity-rule-pattern">{rule.pattern}</code>
              <span className="field-label">{rule.field === 'windowTitle' ? 'タイトル' : rule.field === 'browserUrl' ? 'URL' : 'プロセス'}</span>
              <span className="activity-rule-cat">{rule.category}</span>
              <span className="field-label">P:{rule.priority}</span>
              <button
                type="button"
                className="task-node-menu-button"
                style={{ fontSize: 14 }}
                onClick={() => handleDelete(rule.id)}
                aria-label="削除"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {rules.length === 0 && (
        <div className="analytics-empty">ルールがありません</div>
      )}
    </div>
  )
}
