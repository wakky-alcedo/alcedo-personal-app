import React, { useCallback, useEffect, useState } from 'react'
import {
  getAnalyticsDaily, getAnalyticsSummary, deleteAnalyticsEntry,
  type AnalyticsEntry, type AnalyticsSummaryDay,
} from '../api.ts'
import DailyPieChart, { formatDuration } from '../components/analytics/DailyPieChart.tsx'
import RangeBarChart from '../components/analytics/RangeBarChart.tsx'
import GoalTracker from '../components/analytics/GoalTracker.tsx'
import AnalyticsEntryForm from '../components/analytics/AnalyticsEntryForm.tsx'

type Props = { serverUrl: string; apiKey: string }

type SummaryRange = 'weekly' | 'monthly'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function offsetDate(base: string, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function AnalyticsPage({ serverUrl, apiKey }: Props) {
  const [tab, setTab] = useState<'daily' | SummaryRange>('daily')
  const [date, setDate] = useState(today)
  const [summaryAnchor, setSummaryAnchor] = useState(today)
  const [dailyEntries, setDailyEntries] = useState<AnalyticsEntry[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [snsWarning, setSnsWarning] = useState(false)
  const [summaryData, setSummaryData] = useState<AnalyticsSummaryDay[]>([])
  const [loading, setLoading] = useState(false)

  const refreshDaily = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnalyticsDaily(serverUrl, apiKey, date)
      setDailyEntries(res.entries)
      setDailyTotal(res.totalSec)
      setSnsWarning(res.snsWarning)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [serverUrl, apiKey, date])

  const refreshSummary = useCallback(async () => {
    if (tab === 'daily') return
    setLoading(true)
    try {
      const res = await getAnalyticsSummary(serverUrl, apiKey, tab, summaryAnchor)
      setSummaryData(res.data)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [serverUrl, apiKey, tab, summaryAnchor])

  useEffect(() => { refreshDaily() }, [refreshDaily])
  useEffect(() => { refreshSummary() }, [refreshSummary])

  async function handleDelete(id: string) {
    await deleteAnalyticsEntry(serverUrl, apiKey, id)
    await refreshDaily()
  }

  return (
    <section className="analytics-panel">
      <div className="section-header">
        <h2>分析</h2>
        {loading && <span className="field-label">読み込み中…</span>}
      </div>

      <div className="tab-nav">
        {(['daily', 'weekly', 'monthly'] as const).map(t => (
          <button
            key={t}
            type="button"
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'daily' ? '日次' : t === 'weekly' ? '週次' : '月次'}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="analytics-grid">
          <div className="date-nav">
            <button type="button" className="task-node-menu-button" onClick={() => setDate(d => offsetDate(d, -1))}>‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-input" />
            <button type="button" className="task-node-menu-button" onClick={() => setDate(d => offsetDate(d, 1))}>›</button>
            <button type="button" className="collapse-toggle" onClick={() => setDate(today())}>今日</button>
          </div>

          {snsWarning && (
            <div className="sns-warning">
              ⚠️ SNS使用時間が60分を超えています（{formatDuration(dailyEntries.filter(e => e.category === 'SNS').reduce((s, e) => s + e.durationSec, 0))}）
            </div>
          )}

          <div className="analytics-card">
            <div className="featured-label">時間配分</div>
            <div className="analytics-stat">合計: {formatDuration(dailyTotal)}</div>
            <DailyPieChart entries={dailyEntries} />
          </div>

          <GoalTracker entries={dailyEntries} />

          <div className="analytics-card">
            <div className="featured-label">記録を追加</div>
            <AnalyticsEntryForm serverUrl={serverUrl} apiKey={apiKey} date={date} onCreated={refreshDaily} />
          </div>

          {dailyEntries.length > 0 && (
            <div className="analytics-card">
              <div className="featured-label">本日の記録</div>
              <ul className="analytics-entry-list">
                {dailyEntries.map(e => (
                  <li key={e.id} className="analytics-entry-row">
                    <span className="analytics-entry-cat">{e.category}</span>
                    <span className="analytics-entry-dur">{formatDuration(e.durationSec)}</span>
                    <span className="field-label">{e.source}</span>
                    <button
                      type="button"
                      className="task-node-menu-button"
                      style={{ fontSize: 14 }}
                      onClick={() => handleDelete(e.id)}
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(tab === 'weekly' || tab === 'monthly') && (
        <div className="analytics-grid">
          <div className="date-nav">
            <button
              type="button"
              className="task-node-menu-button"
              onClick={() => setSummaryAnchor(a => offsetDate(a, tab === 'weekly' ? -7 : -30))}
            >‹</button>
            <span className="field-label">{summaryAnchor}</span>
            <button
              type="button"
              className="task-node-menu-button"
              onClick={() => setSummaryAnchor(a => offsetDate(a, tab === 'weekly' ? 7 : 30))}
            >›</button>
            <button type="button" className="collapse-toggle" onClick={() => setSummaryAnchor(today())}>今日</button>
          </div>

          <div className="analytics-card">
            <div className="featured-label">{tab === 'weekly' ? '週次' : '月次'}グラフ</div>
            <RangeBarChart data={summaryData} range={tab} />
          </div>
        </div>
      )}
    </section>
  )
}
