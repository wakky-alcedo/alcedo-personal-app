import React, { useState } from 'react'
import { createAnalyticsEntry, type AnalyticsEntry } from '../../api.ts'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'
import { useAppConfig } from '../../contexts/AppConfigContext.tsx'
import { toISO, isoToLocalTime, formatDurationJa as formatDuration } from '../../utils/format.ts'

type Props = {
  entry: AnalyticsEntry
  onSaved: () => void
  onCancel: () => void
}

export default function AnalyticsEntryEditRow({ entry, onSaved, onCancel }: Props) {
  const { serverUrl, apiKey } = useAppConfig()
  const { colors } = useCategoryColors()
  const categories = Object.keys(colors)

  const [category, setCategory]   = useState(entry.category)
  const [startTime, setStartTime] = useState(isoToLocalTime(entry.startedAt))
  const [endTime, setEndTime]     = useState(isoToLocalTime(entry.endedAt))
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const durationSec = (() => {
    if (!startTime || !endTime) return 0
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
    const startMin = sh * 60 + sm
    const endMin   = eh * 60 + em
    return endMin > startMin ? (endMin - startMin) * 60 : 0
  })()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !startTime || !endTime || durationSec <= 0) return
    setBusy(true)
    setError(null)
    try {
      await createAnalyticsEntry(serverUrl, apiKey, {
        id:          entry.id,
        targetDate:  entry.targetDate,
        category,
        durationSec: Math.round(durationSec),
        startedAt:   toISO(entry.targetDate, startTime),
        endedAt:     toISO(entry.targetDate, endTime),
      })
      onSaved()
    } catch (err) {
      console.error(err)
      setError('保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="analytics-entry-row" style={{ flexWrap: 'wrap', gap: 6 }}>
      <form style={{ display: 'contents' }} onSubmit={handleSave}>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <span className="field-label">〜</span>
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        {durationSec > 0 && <span className="field-label">{formatDuration(durationSec)}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || durationSec <= 0 || !category}>
            {busy ? '保存中…' : '保存'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>キャンセル</button>
        </div>
        {error && <span style={{ color: 'var(--danger)', fontSize: 12, width: '100%' }}>{error}</span>}
      </form>
    </li>
  )
}
