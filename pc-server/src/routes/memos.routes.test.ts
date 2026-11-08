import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db.js'
import { authHeaders as headers, makeTestApp } from '../test/appHarness.js'
import { parsePullCursor } from './memos.js'

let db: Db
let app: FastifyInstance
let close: () => Promise<void>

beforeEach(async () => { ({ db, app, close } = await makeTestApp()) })
afterEach(async () => { await close() })

const EPOCH = '1970-01-01T00:00:00.000Z'

function insertMemo(id: string, updatedAt: string, deletedAt: string | null = null) {
  db.prepare(`
    INSERT INTO memos (id, body, source_url, source_title, version, created_at, updated_at, deleted_at)
    VALUES (?, ?, NULL, NULL, 1, ?, ?, ?)
  `).run(id, `body ${id}`, updatedAt, updatedAt, deletedAt)
}

type Page = { memos: { id: string }[]; nextCursor: string | null }

async function pull(query: Record<string, string>): Promise<Page> {
  const res = await app.inject({ method: 'GET', url: `/api/v1/memos?${new URLSearchParams(query)}`, headers })
  expect(res.statusCode).toBe(200)
  return res.json()
}

/** Follows nextCursor until it is null, like the Android pull. */
async function pullAll(since: string, limit: number): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | null = null
  for (;;) {
    const page = await pull({ since, limit: String(limit), ...(cursor ? { cursor } : {}) })
    ids.push(...page.memos.map((m) => m.id))
    if (!page.nextCursor) return ids
    cursor = page.nextCursor
  }
}

describe('GET /memos?since= pagination', () => {
  it('does not skip rows that share updated_at across a page boundary', async () => {
    const same = '2026-11-01T00:00:00.000Z'
    const ids = Array.from({ length: 7 }, (_, i) => `m${i}`)
    for (const id of ids) insertMemo(id, same)
    insertMemo('later', '2026-11-02T00:00:00.000Z')

    const pulled = await pullAll(EPOCH, 3)
    expect(pulled).toEqual([...ids, 'later'])
  })

  it('returns an (updated_at, id) cursor only when the page is full', async () => {
    insertMemo('a', '2026-11-01T00:00:00.000Z')
    insertMemo('b', '2026-11-01T00:00:00.000Z')
    const full = await pull({ since: EPOCH, limit: '2' })
    expect(full.nextCursor).toBe('2026-11-01T00:00:00.000Z|b')
    const rest = await pull({ since: EPOCH, limit: '2', cursor: full.nextCursor! })
    expect(rest).toEqual({ memos: [], nextCursor: null })
  })

  it('keeps the old strict "updated_at > ts" rule for a timestamp-only cursor or since', async () => {
    insertMemo('a', '2026-11-01T00:00:00.000Z')
    insertMemo('b', '2026-11-02T00:00:00.000Z')
    const bySince = await pull({ since: '2026-11-01T00:00:00.000Z' })
    expect(bySince.memos.map((m) => m.id)).toEqual(['b'])
    const byOldCursor = await pull({ since: EPOCH, cursor: '2026-11-01T00:00:00.000Z' })
    expect(byOldCursor.memos.map((m) => m.id)).toEqual(['b'])
  })

  it('includes tombstones deleted after since', async () => {
    insertMemo('gone', '2026-11-03T00:00:00.000Z', '2026-11-03T00:00:00.000Z')
    const page = await pull({ since: '2026-11-02T00:00:00.000Z' })
    expect(page.memos).toMatchObject([{ id: 'gone', deletedAt: '2026-11-03T00:00:00.000Z' }])
  })
})

describe('parsePullCursor', () => {
  it('splits the composite cursor and treats a bare timestamp as id-less', () => {
    expect(parsePullCursor('2026-11-01T00:00:00.000Z|abc')).toEqual({ updatedAt: '2026-11-01T00:00:00.000Z', id: 'abc' })
    expect(parsePullCursor('2026-11-01T00:00:00.000Z')).toEqual({ updatedAt: '2026-11-01T00:00:00.000Z', id: null })
  })
})
