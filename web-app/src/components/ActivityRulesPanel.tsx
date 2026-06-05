import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  getActivityRules, createActivityRule, updateActivityRule,
  deleteActivityRule, type ActivityRule,
} from '../api.ts'
import { useCategoryColors } from '../CategoryColorsContext.tsx'

export type { ActivityRule }

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
  const { colors, updateColors } = useCategoryColors()
  const categoryNames = Object.keys(colors)
  const [rules, setRules] = useState<ActivityRule[]>([])
  const [pattern, setPattern] = useState('')
  const [field, setField] = useState<'processName' | 'windowTitle' | 'browserUrl'>('processName')
  const [category, setCategory] = useState(() => Object.keys(colors)[0] ?? '')
  const [priority, setPriority] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [reclassifyMsg, setReclassifyMsg] = useState<string | null>(null)
  const editRowRef = useRef<HTMLDivElement>(null)
  const editStateRef = useRef(editState)
  editStateRef.current = editState

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


  return (
    <div>
      <div className="featured-label" style={{ marginBottom: 8 }}>分類ルール</div>
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
        <select
          className="sort-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
                <div
                  ref={editRowRef}
                  style={{ display: 'contents' }}
                  onBlur={e => {
                    // フォーカスが編集行の外に出たら自動保存
                    setTimeout(() => {
                      if (!editRowRef.current?.contains(document.activeElement)) {
                        commitEdit(rule)
                      }
                    }, 0)
                  }}
                >
                  <input
                    autoFocus
                    className="settings-input activity-rule-edit-input"
                    value={editState.pattern}
                    onChange={e => setEditState(s => s && ({ ...s, pattern: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Escape') { setEditingId(null); setEditState(null) } }}
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
                  <select
                    className="sort-select"
                    value={editState.category}
                    onChange={e => setEditState(s => s && ({ ...s, category: e.target.value }))}
                  >
                    {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    className="settings-input activity-rule-edit-input"
                    type="number"
                    value={editState.priority}
                    onChange={e => setEditState(s => s && ({ ...s, priority: Number(e.target.value) }))}
                    style={{ maxWidth: 58 }}
                  />
                  <button type="button" className="task-node-menu-button"
                    onClick={() => { setEditingId(null); setEditState(null) }}
                    title="キャンセル">✕</button>
                </div>
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
