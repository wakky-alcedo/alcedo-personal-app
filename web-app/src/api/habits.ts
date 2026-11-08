import type { Habit } from '@shared/types'
import { randomId, requestJson } from './http.ts'
import { listFrom, normalizeHabit } from './normalize.ts'

export type HabitInput = Partial<Habit> & { name: string }
export type HabitLog = { habitId: string; doneDate: string }

export async function getHabits(serverUrl: string, apiKey: string): Promise<Habit[]> {
  const payload = await requestJson<unknown>(serverUrl, apiKey, '/habits', 'fetch habits failed')
  return listFrom(payload, 'habits').map(normalizeHabit)
}

export function createHabit(serverUrl: string, apiKey: string, body: HabitInput) {
  const now = new Date().toISOString()
  return requestJson<{ habit: Habit }>(serverUrl, apiKey, '/habits', 'create habit failed', {
    method: 'POST',
    body: {
      id: body.id ?? randomId(),
      name: body.name,
      notifyTime: body.notifyTime ?? null,
      widgetPriorityTimeRangeStart: body.widgetPriorityTimeRangeStart ?? null,
      widgetPriorityTimeRangeEnd: body.widgetPriorityTimeRangeEnd ?? null,
      allowedMissDays: body.allowedMissDays ?? 0,
      isActive: body.isActive ?? true,
      createdAt: body.createdAt ?? now,
      updatedAt: body.updatedAt ?? now,
    },
  })
}

export function updateHabit(serverUrl: string, apiKey: string, body: Habit) {
  return requestJson<{ habit: Habit }>(serverUrl, apiKey, '/habits', 'update habit failed', {
    method: 'POST',
    body: { ...body, updatedAt: new Date().toISOString() },
  })
}

export function deleteHabit(serverUrl: string, apiKey: string, habit: Habit) {
  return requestJson<{ deleted: boolean }>(serverUrl, apiKey, `/habits/${encodeURIComponent(habit.id)}`, 'delete habit failed', { method: 'DELETE' })
}

export function getHabitLogs(serverUrl: string, apiKey: string, from: string, to: string): Promise<HabitLog[]> {
  const params = new URLSearchParams({ from, to })
  return requestJson<HabitLog[]>(serverUrl, apiKey, `/habits/logs?${params}`, 'fetch habit logs failed')
}

export function checkInHabit(serverUrl: string, apiKey: string, habit: Habit) {
  // doneDate is omitted on purpose: the server resolves "today" (JST, 6am boundary).
  // Sending a client-side UTC date recorded 06:00-09:00 JST check-ins as yesterday.
  return requestJson<{ habit: Habit }>(serverUrl, apiKey, `/habits/${encodeURIComponent(habit.id)}/logs`, 'habit check-in failed', {
    method: 'POST',
    body: {},
  })
}
