import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { authHeaders as headers, makeTestApp } from '../test/appHarness.js'

let app: FastifyInstance
let close: () => Promise<void>

beforeEach(async () => { ({ app, close } = await makeTestApp()) })
afterEach(async () => { await close() })

const T1 = '2026-11-08T01:00:00.000Z'
const T2 = '2026-11-08T02:00:00.000Z'

describe('habits upsert: last writer wins by updatedAt', () => {
  it('ignores an edit older than the stored one and returns the current row', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'new', updatedAt: T2 } })
    const stale = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'stale', updatedAt: T1 } })
    expect(stale.statusCode).toBe(200)
    expect(stale.json().habit).toMatchObject({ name: 'new', updatedAt: T2 })
  })

  it('applies a newer edit, and treats a missing updatedAt as now (old clients)', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'a', updatedAt: T1 } })
    const newer = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'b', updatedAt: T2 } })
    expect(newer.json().habit.name).toBe('b')
    const noStamp = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'c' } })
    expect(noStamp.json().habit.name).toBe('c')
  })

  it('compares Kotlin-style timestamps (no millis) by time, not by string', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'a', updatedAt: '2026-11-08T01:00:00.500Z' } })
    const later = await app.inject({ method: 'POST', url: '/api/v1/habits', headers, payload: { id: 'h1', name: 'b', updatedAt: '2026-11-08T01:00:01Z' } })
    expect(later.json().habit).toMatchObject({ name: 'b', updatedAt: '2026-11-08T01:00:01.000Z' })
  })
})

describe('beliefs upsert: last writer wins by updatedAt', () => {
  it('ignores an older edit via POST /beliefs and /sync/beliefs', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b1', text: 'new', updatedAt: T2 } })
    const stale = await app.inject({ method: 'POST', url: '/api/v1/beliefs', headers, payload: { id: 'b1', text: 'stale', updatedAt: T1 } })
    expect(stale.statusCode).toBe(200)
    expect(stale.json().belief).toMatchObject({ text: 'new', updatedAt: T2 })

    await app.inject({ method: 'POST', url: '/api/v1/sync/beliefs', headers, payload: { upserts: [{ id: 'b1', text: 'stale2', updatedAt: T1 }] } })
    const list = await app.inject({ method: 'GET', url: '/api/v1/beliefs', headers })
    expect(list.json().beliefs).toMatchObject([{ id: 'b1', text: 'new' }])
  })
})
