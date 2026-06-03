import React, { useCallback, useEffect, useState } from 'react'
import {
  getActivityRules, createActivityRule, updateActivityRule,
  deleteActivityRule, reclassifyActivity, type ActivityRule,
} from '../api.ts'

type Props = { serverUrl: string; apiKey: string }

type EditState = {
  pattern: string
  field: 'processName' | 'windowTitle' | 'browserUrl'
  category: string
  priority: number
}

function fieldLabel(field: string) {
  if (field === 'windowTitle') return 'タイトル'
  if (field === 'browserUrl') return 'URL'
  return 'プロセス'
}

export default function ActivityRulesPanel({ serverUrl, apiKey }: Props) {
  const [rules, setRules] = useState<ActivityRule[]>([])
  const [pattern, setPattern] = useState('')
  const [field, setField] = useState<'processName' | 'windowTitle' | 'browserUrl'>('processName')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [reclassifyMsg, setReclassifyMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try { setRules(await getActivityRules(serverUrl, apiKey)) }
    catch (e) { console.error(e) }
  }, [serverUrl, apiKey])

  useEffect(() => { refresh() }, [refresh])

  async function handleAdd() {
    if (!pattern || !category) return
    try {
      await createActivityRule(serverUrl, apiKey, { pattern, field, category, priority })
      setPattern(''); setCategory(''); setPriority(0)
      await refresh()
    } catch (e) { console.error(e) }
  }

  function startEdit(rule: ActivityRule) {
    setEditingId(rule.id)
    setEditState({ pattern: rule.pattern, field: rule.field, category: rule.category, priority: rule.priority })
  }

  async function commitEdit(rule: ActivityRule) {
    if (!editState) return
    try {
      await updateActivityRule(serverUrl, apiKey, {
        ...rule,
        pattern: editState.pattern,
        field: editState.field,
        category: editState.category,
        priority: editState.priority,
      })
      setEditingId(null); setEditState(null)
      await refresh()
    } catch (e) { console.error(e) }
  }

  async function handleDelete(id: string) {
    try { await deleteActivityRule(serverUrl, apiKey, id); await refresh() }
    catch (e) { console.error(e) }
  }

  async function handleReclassify() {
    try {
      const { updated } = await reclassifyActivity(serverUrl, apiKey)
      setReclassifyMsg(`${updated}件のログを再分類しました`)
      setTimeout(() => setReclassifyMsg(null), 4000)
    } catch (e) {
      setReclassifyMsg('再分類に失敗しました')
      setTimeout(() => setReclassifyMsg(null), 4000)
    }
  }

  return (
    <div className="settings-group">
      <div className="activity-rules-header">
        <span className="featured-label">分類ルール</span>
        <button type="button" className="btn btn-secondary" onClick={handleReclassify}>
          既存ログを再分類
        </button>
      </div>
      {reclassifyMsg && <div className="activity-reclassify-msg">{reclassifyMsg}</div>}

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

      {rules.length === 0 && <div className="analytics-empty">ルールがありません</div>}

      {rules.length > 0 && (
        <ul className="activity-rule-list">
          {rules.map(rule => (
            <li key={rule.id} className="activity-rule-row">
              {editingId === rule.id && editState ? (
                <>
                  <input
                    className="settings-input activity-rule-edit-input"
                    value={editState.pattern}
                    onChange={e => setEditState(s => s && ({ ...s, pattern: e.target.value }))}
                    style={{ maxWidth: 200 }}
                  />
                  <select
                    className="sort-select"
                    value={editState.field}
                    onChange={e => setEditState(s => s && ({ ...s, field: e.target.value as EditState['field'] }))}
                  >
                    <option value="processName">プロセス名</option>
                    <option value="windowTitle">ウィンドウタイトル</option>
                    <option value="browserUrl">ブラウザURL</option>
                  </select>
                  <input
                    className="settings-input activity-rule-edit-input"
                    value={editState.category}
                    onChange={e => setEditState(s => s && ({ ...s, category: e.target.value }))}
                    style={{ maxWidth: 110 }}
                  />
                  <input
                    className="settings-input activity-rule-edit-input"
                    type="number"
                    value={editState.priority}
                    onChange={e => setEditState(s => s && ({ ...s, priority: Number(e.target.value) }))}
                    style={{ maxWidth: 58 }}
                  />
                  <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => commitEdit(rule)}>保存</button>
                  <button type="button" className="task-node-menu-button" onClick={() => { setEditingId(null); setEditState(null) }}>✕</button>
                </>
              ) : (
                <>
                  <code className="activity-rule-pattern">{rule.pattern}</code>
                  <span className="field-label">{fieldLabel(rule.field)}</span>
                  <span className="activity-rule-cat">{rule.category}</span>
                  <span className="field-label">P:{rule.priority}</span>
                  <button type="button" className="task-node-menu-button" onClick={() => startEdit(rule)} aria-label="編集">✎</button>
                  <button type="button" className="task-node-menu-button" style={{ fontSize: 14 }} onClick={() => handleDelete(rule.id)} aria-label="削除">×</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
