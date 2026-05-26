import React, { useState } from 'react'
import { createAnalyticsEntry } from '../../api.ts'

const DEFAULT_CATEGORIES = ['学習', 'SNS', '娯楽', '移動', 'その他']

type Props = {
  serverUrl: string
  apiKey: string
  date: string
  onCreated: () => void
}

export default function AnalyticsEntryForm({ serverUrl, apiKey, date, onCreated }: Props) {
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const durationSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60
    if (durationSec <= 0) return
    setBusy(true)
    try {
      await createAnalyticsEntry(serverUrl, apiKey, { targetDate: date, category, durationSec })
      setHours('')
      setMinutes('')
      onCreated()
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="analytics-entry-form" onSubmit={handleSubmit}>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        type="number" min="0" max="23" placeholder="h"
        value={hours} onChange={e => setHours(e.target.value)}
      />
      <span className="field-label">時間</span>
      <input
        type="number" min="0" max="59" placeholder="m"
        value={minutes} onChange={e => setMinutes(e.target.value)}
      />
      <span className="field-label">分</span>
      <button type="submit" disabled={busy}>追加</button>
    </form>
  )
}
