import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAnalyticsDaily, getAnalyticsSummary, deleteAnalyticsEntry,
  getActivityLogs, getActivitySummary, getActivityDevices, updateActivityCategory,
  type AnalyticsEntry, type AnalyticsSummaryDay,
  type ActivityLog, type ActivitySummary,
} from '../api.ts'
import { buildSegments, summaryFromSegments, SLEEP_CATEGORY, GAP_CATEGORY } from '../activityUtils.ts'
import { dayStartUTC, effectiveLocalDate, localDateString } from '../timeUtils.ts'
import { useAppConfig } from '../contexts/AppConfigContext.tsx'

export type DailySub = 'manual' | 'activity'
export type SummaryRange = 'weekly' | 'monthly'

function today() { return effectiveLocalDate() }

export function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T06:00:00`)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

export interface UseAnalyticsReturn {
  // date/tab state
  tab: 'daily' | SummaryRange
  setTab: React.Dispatch<React.SetStateAction<'daily' | SummaryRange>>
  dailySub: DailySub
  setDailySub: React.Dispatch<React.SetStateAction<DailySub>>
  date: string
  setDate: React.Dispatch<React.SetStateAction<string>>
  summaryAnchor: string
  setSummaryAnchor: React.Dispatch<React.SetStateAction<string>>

  // manual analytics
  dailyEntries: AnalyticsEntry[]
  dailyTotal: number
  snsWarning: boolean
  summaryData: AnalyticsSummaryDay[]

  // activity tracking
  activityLogs: ActivityLog[]
  activitySummary: ActivitySummary[]
  devices: string[]
  deviceFilter: string
  setDeviceFilter: (d: string) => void

  // computed
  timedEntries: (AnalyticsEntry & { startedAt: string; endedAt: string })[]
  dayStartMs: number
  dayEndMs: number
  inDayEntries: (AnalyticsEntry & { startedAt: string; endedAt: string })[]
  mergedSummary: { category: string; durationSec: number }[]
  activitySummaryForChart: { category: string; durationSec: number }[]
  activityTotalSec: number
  sleepSec: number

  // ui state
  loading: boolean
  editingId: string | null
  setEditingId: (id: string | null) => void

  // actions
  refreshDaily: () => Promise<void>
  refreshActivity: () => Promise<void>
  handleDelete: (id: string) => Promise<void>
  handleUpdateCategory: (id: string, category: string) => Promise<void>
}

export function useAnalytics(): UseAnalyticsReturn {
  const { serverUrl, apiKey } = useAppConfig()

  const [tab, setTab] = useState<'daily' | SummaryRange>('daily')
  const [dailySub, setDailySub] = useState<DailySub>('activity')
  const [date, setDate] = useState(today)
  const [summaryAnchor, setSummaryAnchor] = useState(today)

  const [dailyEntries, setDailyEntries] = useState<AnalyticsEntry[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [snsWarning, setSnsWarning] = useState(false)
  const [summaryData, setSummaryData] = useState<AnalyticsSummaryDay[]>([])

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [activitySummary, setActivitySummary] = useState<ActivitySummary[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [deviceFilter, setDeviceFilter] = useState('all')

  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const refreshDaily = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnalyticsDaily(serverUrl, apiKey, date)
      setDailyEntries(res.entries)
      setDailyTotal(res.totalSec)
      setSnsWarning(res.snsWarning)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [serverUrl, apiKey, date])

  const refreshActivity = useCallback(async () => {
    const device = deviceFilter === 'all' ? undefined : deviceFilter
    try {
      const [logs, summary, devList] = await Promise.all([
        getActivityLogs(serverUrl, apiKey, date, device),
        getActivitySummary(serverUrl, apiKey, date, device),
        getActivityDevices(serverUrl, apiKey),
      ])
      setActivityLogs(logs)
      setActivitySummary(summary)
      setDevices(devList)
    } catch (e) { console.error(e) }
  }, [serverUrl, apiKey, date, deviceFilter])

  const refreshSummary = useCallback(async () => {
    if (tab === 'daily') return
    setLoading(true)
    try {
      const res = await getAnalyticsSummary(serverUrl, apiKey, tab, summaryAnchor)
      setSummaryData(res.data)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [serverUrl, apiKey, tab, summaryAnchor])

  useEffect(() => { refreshDaily() }, [refreshDaily])
  useEffect(() => { refreshActivity() }, [refreshActivity])
  useEffect(() => { refreshSummary() }, [refreshSummary])

  async function handleDelete(id: string) {
    await deleteAnalyticsEntry(serverUrl, apiKey, id)
    await refreshDaily()
  }

  async function handleUpdateCategory(id: string, category: string) {
    try {
      await updateActivityCategory(serverUrl, apiKey, id, category)
      setActivityLogs(prev => prev.map(l => l.id === id ? { ...l, category } : l))
      const summary = await getActivitySummary(serverUrl, apiKey, date)
      setActivitySummary(summary)
    } catch (e) { console.error(e) }
  }

  const timedEntries = useMemo(
    () => dailyEntries.filter(
      (e): e is typeof e & { startedAt: string; endedAt: string } =>
        e.startedAt != null && e.endedAt != null
    ),
    [dailyEntries]
  )

  const dayStartMs = useMemo(() => new Date(dayStartUTC(date)).getTime(), [date])
  const dayEndMs = useMemo(() => dayStartMs + 24 * 60 * 60 * 1000, [dayStartMs])

  const inDayEntries = useMemo(
    () => timedEntries.filter(e => new Date(e.startedAt).getTime() >= dayStartMs),
    [timedEntries, dayStartMs]
  )

  const mergedSummary = useMemo(
    () => summaryFromSegments(buildSegments(activityLogs, dayStartMs, inDayEntries)),
    [activityLogs, dayStartMs, inDayEntries]
  )

  const activitySummaryForChart = useMemo(
    () => mergedSummary.filter(s => s.category !== GAP_CATEGORY && s.category !== SLEEP_CATEGORY),
    [mergedSummary]
  )

  const activityTotalSec = activitySummaryForChart.reduce((s, e) => s + e.durationSec, 0)

  const manualSleepSec = useMemo(() =>
    timedEntries
      .filter(e => {
        const endMs = new Date(e.endedAt).getTime()
        return e.category === SLEEP_CATEGORY && endMs > dayStartMs && endMs <= dayEndMs
      })
      .reduce((sum, e) => sum + e.durationSec, 0),
    [timedEntries, dayStartMs, dayEndMs]
  )
  const sleepSec = manualSleepSec > 0
    ? manualSleepSec
    : (mergedSummary.find(s => s.category === SLEEP_CATEGORY)?.durationSec ?? 0)

  return {
    tab, setTab, dailySub, setDailySub, date, setDate,
    summaryAnchor, setSummaryAnchor,
    dailyEntries, dailyTotal, snsWarning, summaryData,
    activityLogs, activitySummary, devices, deviceFilter, setDeviceFilter,
    timedEntries, dayStartMs, dayEndMs, inDayEntries,
    mergedSummary, activitySummaryForChart, activityTotalSec, sleepSec,
    loading, editingId, setEditingId,
    refreshDaily, refreshActivity, handleDelete, handleUpdateCategory,
  }
}
