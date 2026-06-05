import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  getActivityRules, importActivityRules, reclassifyActivity, type ActivityRule,
} from '../api.ts'
import { useCategoryColors } from '../CategoryColorsContext.tsx'
import ActivityRulesPanel from './ActivityRulesPanel.tsx'
import CategoryColorsPanel from './CategoryColorsPanel.tsx'

type Props = { serverUrl: string; apiKey: string }

export default function ClassificationSection({ serverUrl, apiKey }: Props) {
  const { colors, updateColors } = useCategoryColors()
  const [rules, setRules]     = useState<ActivityRule[]>([])
  const [msg, setMsg]         = useState<string | null>(null)
  const [rulesKey, setRulesKey] = useState(0)  // 変更でActivityRulesPanelを再マウント
  const importRef = useRef<HTMLInputElement>(null)

  const refreshRules = useCallback(async () => {
    try { setRules(await getActivityRules(serverUrl, apiKey)) } catch {}
  }, [serverUrl, apiKey])

  useEffect(() => { refreshRules() }, [refreshRules])

  // ─── エクスポート ──────────────────────────────────────────────────────────

  function handleExport() {
    const data = {
      rules: rules.map(({ pattern, field, category, priority }) => ({ pattern, field, category, priority })),
      categories: colors,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'activity_rules.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── インポート ──────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const parsed = JSON.parse(await file.text())
      const importedRules: any[] = parsed.rules ?? []
      const importedColors: Record<string, string> | null = parsed.categories ?? null
      if (!Array.isArray(importedRules)) throw new Error('rules が配列ではありません')

      const colorNote = importedColors
        ? `\nカテゴリ色（${Object.keys(importedColors).length}件）も復元されます。` : ''
      const mode = window.confirm(
        `${importedRules.length}件のルールを読み込みます。${colorNote}\n\n「OK」→ 既存ルールをすべて置き換え\n「キャンセル」→ 既存ルールに追加`
      ) ? 'replace' : 'merge'

      const { imported } = await importActivityRules(serverUrl, apiKey, importedRules, mode)
      if (importedColors) updateColors({ ...colors, ...importedColors })

      // ActivityRulesPanel を再マウントして再取得させる
      setRulesKey(k => k + 1)
      await refreshRules()

      const label = mode === 'replace' ? '置き換え' : '追加'
      const colorMsg = importedColors ? `・色 ${Object.keys(importedColors).length}件` : ''
      showMsg(`ルール ${imported}件を${label}${colorMsg}`)
    } catch (err: any) {
      showMsg(`インポート失敗: ${err.message}`)
    }
  }

  // ─── 既存ログを再分類 ──────────────────────────────────────────────────────

  async function handleReclassify() {
    try {
      const { updated } = await reclassifyActivity(serverUrl, apiKey)
      showMsg(`${updated}件のログを再分類しました`)
    } catch {
      showMsg('再分類に失敗しました')
    }
  }

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <div className="settings-group">
      {/* 共通ヘッダー */}
      <div className="activity-rules-header">
        <span className="featured-label">分類設定</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-secondary"
            onClick={handleExport} disabled={rules.length === 0}
            title="カテゴリ色・分類ルールをJSONにエクスポート">
            エクスポート
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}
            title="JSONからカテゴリ色・分類ルールをインポート">
            インポート
            <input ref={importRef} type="file" accept=".json"
              onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn btn-secondary" onClick={handleReclassify}>
            既存ログを再分類
          </button>
        </div>
      </div>
      {msg && <div className="activity-reclassify-msg">{msg}</div>}

      {/* カテゴリ（色・名前管理） */}
      <CategoryColorsPanel />

      {/* 分類ルール */}
      <ActivityRulesPanel key={rulesKey} serverUrl={serverUrl} apiKey={apiKey} />
    </div>
  )
}
