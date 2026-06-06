import React, { useEffect, useState } from 'react'
import { createAnalyticsEntry } from '../../api.ts'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'

type Props = {
  serverUrl: string
  apiKey: string
  date: string
  onCreated: () => void
}

/** YYYY-MM-DD + HH:MM(:SS) → UTC ISO string（常に同カレンダー日として扱う） */
function toISO(date: string, time: string): string {
  const parts = time.split(':').map(Number)
  const hhmm = `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:00`
  return new Date(`${date}T${hhmm}`).toISOString()
}

function formatDuration(sec: number): string {
  if (sec <= 0) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}時間${m}分` : `${m}分`
}

export default function AnalyticsEntryForm({ serverUrl, apiKey, date, onCreated }: Props) {
  const { colors } = useCategoryColors()
  const categories = Object.keys(colors)

  const [category, setCategory] = useState(categories[0] ?? '')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // カテゴリ一覧が変わったとき、現在の選択値が存在しなければ先頭に戻す
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0])
    }
  }, [categories])

  // Date オブジェクトを使わず時・分の直接計算（タイムゾーンや秒付き文字列に依存しない）
  const durationSec = (() => {
    if (!startTime || !endTime) return 0
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
    const startMin = sh * 60 + sm
    const endMin   = eh * 60 + em
    return endMin > startMin ? (endMin - startMin) * 60 : 0
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startTime || !endTime || durationSec <= 0 || !category) return
    setBusy(true)
    setError(null)
    try {
      await createAnalyticsEntry(serverUrl, apiKey, {
        targetDate: date,
        category,
        durationSec: Math.round(durationSec),
        startedAt: toISO(date, startTime),
        endedAt:   toISO(date, endTime),
      })
      setStartTime('')
      setEndTime('')
      onCreated()
    } catch (err) {
      console.error(err)
      setError('保存に失敗しました。サーバーへの接続を確認してください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="analytics-entry-form" onSubmit={handleSubmit}>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        type="time"
        value={startTime} onChange={e => { setStartTime(e.target.value); setError(null) }}
      />
      <span className="field-label">〜</span>
      <input
        type="time"
        value={endTime} onChange={e => { setEndTime(e.target.value); setError(null) }}
      />
      {durationSec > 0 && <span className="field-label">{formatDuration(durationSec)}</span>}
      <button type="submit" className="btn btn-primary" disabled={busy || durationSec <= 0 || !category}>
        {busy ? '保存中…' : '追加'}
      </button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12, gridColumn: '1 / -1' }}>{error}</span>}
    </form>
  )
}
