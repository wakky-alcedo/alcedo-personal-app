import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { authHeaders as headers, makeTestApp } from '../test/appHarness.js'

let app: FastifyInstance
let close: () => Promise<void>

beforeEach(async () => { ({ app, close } = await makeTestApp()) })
afterEach(async () => { await close() })

describe('activity date params', () => {
  it('returns 400 instead of 500 for malformed dates', async () => {
    for (const url of ['/api/v1/activity/logs?date=bad', '/api/v1/activity/summary?date=2026-13-01', '/api/v1/activity/devices?date=x']) {
      expect((await app.inject({ method: 'GET', url, headers })).statusCode).toBe(400)
    }
  })

  it('a session at 05:59 JST belongs to the previous day', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/activity/bulk', headers, payload: { deviceId: 'pc', logs: [
      { startedAt: '2026-08-05T20:59:00.000Z', endedAt: '2026-08-05T21:10:00.000Z', processName: 'late.exe' },
      { startedAt: '2026-08-05T21:00:00.000Z', endedAt: '2026-08-05T21:10:00.000Z', processName: 'early.exe' },
    ] } })
    const day5 = (await app.inject({ method: 'GET', url: '/api/v1/activity/logs?date=2026-08-05', headers })).json()
    const day6 = (await app.inject({ method: 'GET', url: '/api/v1/activity/logs?date=2026-08-06', headers })).json()
    expect(day5.map((l: { processName: string }) => l.processName)).toEqual(['late.exe'])
    expect(day6.map((l: { processName: string }) => l.processName)).toEqual(['early.exe'])
  })
})
