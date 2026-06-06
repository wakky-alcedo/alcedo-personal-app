import React from 'react'
import DailyPieChart from '../components/analytics/DailyPieChart.tsx'
import { formatDuration } from '../utils/format.ts'
import RangeBarChart from '../components/analytics/RangeBarChart.tsx'
import GoalTracker from '../components/analytics/GoalTracker.tsx'
import AnalyticsEntryForm from '../components/analytics/AnalyticsEntryForm.tsx'
import ActivityTimeline from '../components/analytics/ActivityTimeline.tsx'
import ActivityPieChart from '../components/analytics/ActivityPieChart.tsx'
import DayTimeline from '../components/analytics/DayTimeline.tsx'
import AnalyticsEntryEditRow from '../components/analytics/AnalyticsEntryEditRow.tsx'
import { useAnalytics, offsetDate } from '../hooks/useAnalytics.ts'
import { effectiveLocalDate } from '../timeUtils.ts'

const DEFAULT_CATEGORIES = ['開発', 'ブラウザ', 'コミュニケーション', '学習', 'SNS', '娯楽', '未分類']

function today() { return effectiveLocalDate() }

export default function AnalyticsPage() {
  const {
    tab, setTab, dailySub, setDailySub, date, setDate,
    summaryAnchor, setSummaryAnchor,
    dailyEntries, dailyTotal, snsWarning, summaryData,
    activityLogs, activitySummary, devices, deviceFilter, setDeviceFilter,
    timedEntries, inDayEntries,
    activitySummaryForChart, activityTotalSec, sleepSec,
    loading, editingId, setEditingId,
    refreshDaily, handleDelete, handleUpdateCategory,
  } = useAnalytics()

  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...activitySummary.map(s => s.category),
  ]))

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

          <div className="tab-nav">
            <button
              type="button"
              className={`tab-btn${dailySub === 'activity' ? ' active' : ''}`}
              onClick={() => setDailySub('activity')}
            >作業記録</button>
            <button
              type="button"
              className={`tab-btn${dailySub === 'manual' ? ' active' : ''}`}
              onClick={() => setDailySub('manual')}
            >手動記録</button>
          </div>

          {dailySub === 'activity' && (
            <>
              {devices.length > 1 && (
                <div className="device-filter">
                  <span className="field-label">デバイス:</span>
                  <button
                    type="button"
                    className={`filter-chip${deviceFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setDeviceFilter('all')}
                  >すべて</button>
                  {devices.map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`filter-chip${deviceFilter === d ? ' active' : ''}`}
                      onClick={() => setDeviceFilter(d)}
                    >{d}</button>
                  ))}
                </div>
              )}
              <div className="analytics-card">
                <div className="featured-label">24時間タイムライン</div>
                <DayTimeline logs={activityLogs} date={date} manualOverrides={timedEntries} />
              </div>

              <div className="analytics-card">
                <div className="featured-label">作業時間配分</div>
                <div className="analytics-stat">合計: {formatDuration(activityTotalSec)}</div>
                {sleepSec > 0 && <div className="analytics-stat">睡眠: {formatDuration(sleepSec)}</div>}
                <ActivityPieChart summary={activitySummaryForChart} />
              </div>

              <div className="analytics-card">
                <div className="featured-label">タイムライン</div>
                <ActivityTimeline
                  logs={activityLogs}
                  categories={categories}
                  onUpdateCategory={handleUpdateCategory}
                />
              </div>
            </>
          )}

          {dailySub === 'manual' && (
            <>
              {snsWarning && (
                <div className="sns-warning">
                  SNS使用時間が60分を超えています（{formatDuration(dailyEntries.filter(e => e.category === 'SNS').reduce((s, e) => s + e.durationSec, 0))}）
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
                <AnalyticsEntryForm date={date} onCreated={refreshDaily} />
              </div>

              {dailyEntries.length > 0 && (
                <div className="analytics-card">
                  <div className="featured-label">本日の記録</div>
                  <ul className="analytics-entry-list">
                    {dailyEntries.map(e =>
                      editingId === e.id ? (
                        <AnalyticsEntryEditRow
                          key={e.id}
                          entry={e}
                          onSaved={() => { setEditingId(null); refreshDaily() }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <li key={e.id} className="analytics-entry-row">
                          <span className="analytics-entry-cat">{e.category}</span>
                          <span className="analytics-entry-dur">{formatDuration(e.durationSec)}</span>
                          <span className="field-label">
                            {e.startedAt && e.endedAt
                              ? `${new Date(e.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}〜${new Date(e.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : e.source}
                          </span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className="task-node-menu-button"
                              style={{ fontSize: 12 }}
                              onClick={() => setEditingId(e.id)}
                              aria-label="編集"
                            >✏</button>
                            <button
                              type="button"
                              className="task-node-menu-button"
                              style={{ fontSize: 14 }}
                              onClick={() => handleDelete(e.id)}
                              aria-label="削除"
                            >×</button>
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </>
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
