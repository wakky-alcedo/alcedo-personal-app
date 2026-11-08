import type { ActivityLog, ActivityRule, ActivitySummary } from '@shared/types'
import { request, requestJson } from './http.ts'

export type ActivityRuleInput = { pattern: string; field?: string; category: string; priority?: number }

function dateParams(date: string, deviceId?: string) {
  const params = new URLSearchParams({ date })
  if (deviceId) params.set('deviceId', deviceId)
  return params
}

export function getCurrentActivity(serverUrl: string, apiKey: string): Promise<ActivityLog | null> {
  return requestJson(serverUrl, apiKey, '/activity/current', 'fetch current activity failed')
}

export function getActivityLogs(serverUrl: string, apiKey: string, date: string, deviceId?: string): Promise<ActivityLog[]> {
  return requestJson(serverUrl, apiKey, `/activity/logs?${dateParams(date, deviceId)}`, 'fetch activity logs failed')
}

export function getActivitySummary(serverUrl: string, apiKey: string, date: string, deviceId?: string): Promise<ActivitySummary[]> {
  return requestJson(serverUrl, apiKey, `/activity/summary?${dateParams(date, deviceId)}`, 'fetch activity summary failed')
}

export async function getActivityDevices(serverUrl: string, apiKey: string): Promise<string[]> {
  const rows = await requestJson<Array<{ deviceId: string }>>(serverUrl, apiKey, '/activity/devices', 'fetch activity devices failed')
  return rows.map(r => r.deviceId)
}

export async function updateActivityCategory(serverUrl: string, apiKey: string, id: string, category: string): Promise<void> {
  await request(serverUrl, apiKey, `/activity/logs/${encodeURIComponent(id)}/category`, 'update activity category failed', {
    method: 'POST',
    body: { category },
  })
}

export function getActivityRules(serverUrl: string, apiKey: string): Promise<ActivityRule[]> {
  return requestJson(serverUrl, apiKey, '/activity/rules', 'fetch activity rules failed')
}

export function createActivityRule(serverUrl: string, apiKey: string, body: ActivityRuleInput): Promise<ActivityRule> {
  return requestJson(serverUrl, apiKey, '/activity/rules', 'create activity rule failed', { method: 'POST', body })
}

export function updateActivityRule(serverUrl: string, apiKey: string, rule: ActivityRule): Promise<ActivityRule> {
  return requestJson(serverUrl, apiKey, '/activity/rules', 'update activity rule failed', { method: 'POST', body: rule })
}

export function reclassifyActivity(serverUrl: string, apiKey: string): Promise<{ updated: number }> {
  return requestJson(serverUrl, apiKey, '/activity/reclassify', 'reclassify failed', { method: 'POST' })
}

export function importActivityRules(
  serverUrl: string, apiKey: string,
  rules: ActivityRuleInput[],
  mode: 'replace' | 'merge' = 'replace',
): Promise<{ imported: number; mode: string }> {
  return requestJson(serverUrl, apiKey, '/activity/rules/import', 'import failed', { method: 'POST', body: { rules, mode } })
}

export async function deleteActivityRule(serverUrl: string, apiKey: string, id: string): Promise<void> {
  await request(serverUrl, apiKey, `/activity/rules/${encodeURIComponent(id)}`, 'delete activity rule failed', { method: 'DELETE' })
}
