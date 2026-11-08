import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, request } from './http.ts'
import { checkInHabit } from './habits.ts'
import { deleteMemo } from './memos.ts'

afterEach(() => { vi.unstubAllGlobals() })

function stubFetch(status = 200, json: unknown = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(json), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('request', () => {
  it('adds the API key and only sets Content-Type when there is a body', async () => {
    const fetchMock = stubFetch()
    await request('http://s', 'k', '/x', 'fail', { method: 'DELETE' })
    await request('http://s', 'k', '/y', 'fail', { method: 'POST', body: { a: 1 } })
    expect(fetchMock.mock.calls[0]).toEqual(['http://s/api/v1/x', { method: 'DELETE', headers: { 'X-Api-Key': 'k' }, body: undefined }])
    expect(fetchMock.mock.calls[1]).toEqual(['http://s/api/v1/y', { method: 'POST', headers: { 'X-Api-Key': 'k', 'Content-Type': 'application/json' }, body: '{"a":1}' }])
  })

  it('throws ApiError with the status for non-2xx responses', async () => {
    stubFetch(404)
    await expect(deleteMemo('http://s', 'k', 'm1')).rejects.toMatchObject({ name: 'ApiError', status: 404, message: 'delete memo failed' })
    await expect(request('http://s', 'k', '/x', 'boom')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('checkInHabit', () => {
  it('does not send a client-side doneDate (server decides "today")', async () => {
    const fetchMock = stubFetch(200, { habit: {} })
    await checkInHabit('http://s', 'k', { id: 'h 1' } as never)
    expect(fetchMock.mock.calls[0][0]).toBe('http://s/api/v1/habits/h%201/logs')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{}' })
  })
})
