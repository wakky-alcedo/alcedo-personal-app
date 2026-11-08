import type { AnalyticsDailyResponse, AnalyticsEntry, AnalyticsSummaryResponse } from '@shared/types'
import { request, requestJson } from './http.ts'

export type AnalyticsEntryInput = {
  id?: string
  targetDate: string
  category: string
  durationSec?: number
  startedAt?: string
  endedAt?: string
  source?: string
}

export function getAnalyticsDaily(serverUrl: string, apiKey: string, date: string): Promise<AnalyticsDailyResponse> {
  return requestJson(serverUrl, apiKey, `/analytics/daily?${new URLSearchParams({ date })}`, 'fetch analytics daily failed')
}

export function createAnalyticsEntry(serverUrl: string, apiKey: string, body: AnalyticsEntryInput): Promise<AnalyticsEntry> {
  return requestJson(serverUrl, apiKey, '/analytics/daily', 'create analytics entry failed', { method: 'POST', body })
}

export async function deleteAnalyticsEntry(serverUrl: string, apiKey: string, id: string): Promise<void> {
  await request(serverUrl, apiKey, `/analytics/daily/${encodeURIComponent(id)}`, 'delete analytics entry failed', { method: 'DELETE' })
}

export function getAnalyticsSummary(
  serverUrl: string, apiKey: string,
  range: 'weekly' | 'monthly', anchor?: string,
): Promise<AnalyticsSummaryResponse> {
  const params = new URLSearchParams({ range })
  if (anchor) params.set('anchor', anchor)
  return requestJson(serverUrl, apiKey, `/analytics/summary?${params}`, 'fetch analytics summary failed')
}
