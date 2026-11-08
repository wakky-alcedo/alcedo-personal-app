import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeTestApp, TEST_API_KEY } from './test/appHarness.js'
import { redactUrl } from './app.js'

let app: FastifyInstance
let close: () => Promise<void>

beforeEach(async () => { ({ app, close } = await makeTestApp()) })
afterEach(async () => { await close() })

describe('auth', () => {
  it('accepts the header key and rejects a wrong or missing key', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/habits', headers: { 'x-api-key': TEST_API_KEY } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/v1/habits', headers: { 'x-api-key': 'nope' } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/habits' })).statusCode).toBe(401)
  })

  it('accepts ?key= only on the SSE endpoint', async () => {
    expect((await app.inject({ method: 'GET', url: `/api/v1/habits?key=${TEST_API_KEY}` })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/events?key=nope' })).statusCode).toBe(401)
  })

  it('refuses to start without an API key', async () => {
    const { createApp } = await import('./app.js')
    const { openDatabase } = await import('./db.js')
    await expect(createApp({ db: openDatabase(':memory:'), apiKey: undefined, logger: false })).rejects.toThrow('API_KEY')
  })
})

describe('redactUrl', () => {
  it('masks key query values', () => {
    expect(redactUrl('/api/v1/events?key=secret')).toBe('/api/v1/events?key=***')
    expect(redactUrl('/api/v1/events?a=1&key=secret&b=2')).toBe('/api/v1/events?a=1&key=***&b=2')
    expect(redactUrl('/api/v1/habits')).toBe('/api/v1/habits')
  })
})
