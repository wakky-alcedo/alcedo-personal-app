import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db.js'
import { authHeaders as headers, makeTestApp } from '../test/appHarness.js'

let db: Db
let app: FastifyInstance
let close: () => Promise<void>

beforeEach(async () => { ({ db, app, close } = await makeTestApp()) })
afterEach(async () => { await close() })

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

describe('beliefs', () => {
  it('soft-deletes via DELETE and /sync/beliefs, and refuses to resurrect', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b1', text: 'Be kind' } })
    await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b2', text: 'Be brave' } })
    await app.inject({ method: 'DELETE', url: '/api/v1/beliefs/b1', headers })
    await app.inject({ method: 'POST', url: '/api/v1/sync/beliefs', headers, payload: { deletions: [{ id: 'b2' }] } })

    const list = await app.inject({ method: 'GET', url: '/api/v1/beliefs', headers })
    expect(list.json().beliefs).toEqual([])
    expect(count('beliefs')).toBe(2)

    const stale = await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b1', text: 'edited' } })
    expect(stale.statusCode).toBe(404)
    await app.inject({ method: 'POST', url: '/api/v1/sync/beliefs', headers, payload: { upserts: [{ id: 'b2', text: 'edited' }] } })
    expect((await app.inject({ method: 'GET', url: '/api/v1/beliefs', headers })).json().beliefs).toEqual([])
  })

  it('requires text and returns booleans without deletedAt', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { text: '' } })
    expect(bad.statusCode).toBe(400)
    const ok = await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b1', text: 'x', isActive: false } })
    expect(ok.json().belief).toMatchObject({ id: 'b1', text: 'x', isActive: false })
    expect(ok.json().belief).not.toHaveProperty('deletedAt')
  })
})

describe('analytics_daily', () => {
  it('soft-deletes entries and excludes them from daily and summary', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/v1/analytics/daily', headers, payload: { targetDate: '2026-08-05', category: 'SNS', durationSec: 4000 } })
    const id = created.json().id
    await app.inject({ method: 'DELETE', url: `/api/v1/analytics/daily/${id}`, headers })

    const daily = await app.inject({ method: 'GET', url: '/api/v1/analytics/daily?date=2026-08-05', headers })
    expect(daily.json()).toMatchObject({ entries: [], totalSec: 0, snsWarning: false })
    const summary = await app.inject({ method: 'GET', url: '/api/v1/analytics/summary?range=weekly&anchor=2026-08-05', headers })
    expect(summary.json().snsWarning).toBe(false)
    expect(count('analytics_daily')).toBe(1)
  })
})

describe('activity_rules', () => {
  it('soft-deletes on DELETE and on import replace; deleted rules stop classifying', async () => {
    const rule = await app.inject({ method: 'POST', url: '/api/v1/activity/rules', headers, payload: { pattern: 'chrome', category: 'Web' } })
    await app.inject({ method: 'DELETE', url: `/api/v1/activity/rules/${rule.json().id}`, headers })
    expect((await app.inject({ method: 'GET', url: '/api/v1/activity/rules', headers })).json()).toEqual([])

    await app.inject({ method: 'POST', url: '/api/v1/activity/rules/import', headers, payload: { rules: [{ pattern: 'code', category: 'Dev' }] } })
    await app.inject({ method: 'POST', url: '/api/v1/activity/rules/import', headers, payload: { rules: [{ pattern: 'slack', category: 'Chat' }] } })
    const rules = (await app.inject({ method: 'GET', url: '/api/v1/activity/rules', headers })).json()
    expect(rules.map((r: { pattern: string }) => r.pattern)).toEqual(['slack'])
    expect(count('activity_rules')).toBe(3)

    await app.inject({ method: 'POST', url: '/api/v1/activity/bulk', headers, payload: { deviceId: 'pc', logs: [{ startedAt: '2026-08-05T01:00:00.000Z', endedAt: '2026-08-05T02:00:00.000Z', processName: 'chrome.exe' }] } })
    const logs = (await app.inject({ method: 'GET', url: '/api/v1/activity/logs?date=2026-08-05', headers })).json()
    expect(logs[0].category).toBe('未分類')
  })
})
