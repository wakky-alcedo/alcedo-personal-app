import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { authHeaders as headers, makeTestApp } from '../test/appHarness.js'
import { summaryWindow } from './analytics.js'

let app: FastifyInstance
let close: () => Promise<void>
const originalTz = process.env.TZ

beforeEach(async () => {
  // Run under a non-UTC system TZ: the old code mixed local setHours() with UTC toISOString().
  process.env.TZ = 'Asia/Tokyo'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-04T23:00:00Z')) // 2026-08-05 08:00 JST
  ;({ app, close } = await makeTestApp())
})

afterEach(async () => {
  await close()
  vi.useRealTimers()
  process.env.TZ = originalTz
})

describe('summaryWindow', () => {
  it('weekly is the 7 days ending at the anchor', () => {
    expect(summaryWindow('weekly', '2026-03-02')).toEqual({ startDate: '2026-02-24', days: 7 })
  })
  it('monthly covers the whole calendar month', () => {
    expect(summaryWindow('monthly', '2024-02-10')).toEqual({ startDate: '2024-02-01', days: 29 })
    expect(summaryWindow('monthly', '2026-12-31')).toEqual({ startDate: '2026-12-01', days: 31 })
  })
})

describe('GET /analytics/summary', () => {
  it('keeps the anchor date under a JST system timezone', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analytics/daily', headers, payload: { targetDate: '2026-08-05', category: 'SNS', durationSec: 3600 } })
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/summary?range=weekly&anchor=2026-08-05', headers })
    const body = res.json()
    expect(body).toMatchObject({ startDate: '2026-07-30', endDate: '2026-08-05', snsWarning: true })
    expect(body.data.map((d: { date: string }) => d.date)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'])
    expect(body.data[6]).toEqual({ date: '2026-08-05', SNS: 3600 })
  })

  it('defaults the anchor to the JST effective date', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/summary?range=monthly', headers })
    expect(res.json()).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-05' })
    expect(res.json().data).toHaveLength(31)
  })

  it('rejects malformed anchors', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/summary?anchor=8/5', headers })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /analytics/daily', () => {
  it('defaults to the JST effective date, not the UTC date', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/daily', headers })
    expect(res.json().date).toBe('2026-08-05')
  })
})
