import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../app.js'
import { openDatabase, type Db } from '../db.js'

const API_KEY = 'test-key'
const headers = { 'x-api-key': API_KEY }

let db: Db
let app: FastifyInstance

beforeEach(async () => {
  // 2026-08-05 08:00 JST (= 2026-08-04 23:00 UTC): the UTC date is still the 4th.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-04T23:00:00Z'))
  db = openDatabase(':memory:')
  app = await createApp({ db, apiKey: API_KEY, logger: false })
})

afterEach(async () => {
  await app.close()
  db.close()
  vi.useRealTimers()
})

async function createHabit(body: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'Run', ...body } })
  return res
}

describe('POST /habits/:id/logs', () => {
  it('records the JST effective date when doneDate is omitted (not the UTC date)', async () => {
    await createHabit()
    const res = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: {} })
    expect(res.statusCode).toBe(200)
    expect(res.json().habit.completedToday).toBe(true)
    expect(res.json().habit.lastDoneDate).toBe('2026-08-05')
  })

  it('accepts an explicit past doneDate (queued offline check-in)', async () => {
    await createHabit()
    const res = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: { doneDate: '2026-08-03' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().habit.completedToday).toBe(false)
  })

  it('is idempotent for the same day', async () => {
    await createHabit()
    await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: {} })
    await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: {} })
    const logs = await app.inject({ method: 'GET', url: '/api/v1/habits/logs', headers })
    expect(logs.json()).toEqual([{ habitId: 'h1', doneDate: '2026-08-05' }])
  })

  it('rejects malformed and far-future dates', async () => {
    await createHabit()
    const bad = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: { doneDate: '2026-8-5' } })
    expect(bad.statusCode).toBe(400)
    const future = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: { doneDate: '2026-08-07' } })
    expect(future.statusCode).toBe(400)
    const tolerated = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: { doneDate: '2026-08-06' } })
    expect(tolerated.statusCode).toBe(200)
  })

  it('returns 404 for unknown or deleted habits', async () => {
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/habits/nope/logs', headers, payload: {} })
    expect(unknown.statusCode).toBe(404)
    await createHabit()
    await app.inject({ method: 'DELETE', url: '/api/v1/habits/h1', headers })
    const deleted = await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: {} })
    expect(deleted.statusCode).toBe(404)
  })
})

describe('GET /habits/logs', () => {
  it('defaults to a 60-day window ending today', async () => {
    await createHabit()
    for (const doneDate of ['2026-06-06', '2026-06-07', '2026-08-05']) {
      await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: { doneDate } })
    }
    const res = await app.inject({ method: 'GET', url: '/api/v1/habits/logs', headers })
    // 2026-08-05 - 59 days = 2026-06-07
    expect(res.json().map((l: { doneDate: string }) => l.doneDate)).toEqual(['2026-06-07', '2026-08-05'])
  })

  it('rejects malformed query dates', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/habits/logs?from=yesterday', headers })
    expect(res.statusCode).toBe(400)
  })
})

describe('habit CRUD', () => {
  it('requires a name', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { name: '  ' } })
    expect(res.statusCode).toBe(400)
  })

  it('soft-deletes: hidden from lists, rows kept, not resurrected by a stale upsert', async () => {
    await createHabit()
    await app.inject({ method: 'POST', url: '/api/v1/habits/h1/logs', headers, payload: {} })
    await app.inject({ method: 'DELETE', url: '/api/v1/habits/h1', headers })

    const list = await app.inject({ method: 'GET', url: '/api/v1/habits', headers })
    expect(list.json().habits).toEqual([])
    const logs = await app.inject({ method: 'GET', url: '/api/v1/habits/logs', headers })
    expect(logs.json()).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM habits').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM habit_logs').get()).toEqual({ n: 1 })

    const stale = await createHabit({ name: 'Run (edited offline)' })
    expect(stale.statusCode).toBe(404)
  })

  it('returns computed fields and normalizes booleans', async () => {
    const res = await createHabit({ isActive: false, allowedMissDays: '2' })
    const habit = res.json().habit
    expect(habit).toMatchObject({ id: 'h1', name: 'Run', isActive: false, allowedMissDays: 2, streakDays: 0, completedToday: false, lastDoneDate: null })
    expect(habit).not.toHaveProperty('deletedAt')
  })
})
