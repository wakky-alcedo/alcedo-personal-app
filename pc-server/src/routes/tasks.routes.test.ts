import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../app.js'
import { openDatabase, type Db } from '../db.js'

const headers = { 'x-api-key': 'test-key' }
const EPOCH = '1970-01-01T00:00:00.000Z'

let db: Db
let app: FastifyInstance

beforeEach(async () => {
  db = openDatabase(':memory:')
  app = await createApp({ db, apiKey: 'test-key', logger: false })
})

afterEach(async () => {
  await app.close()
  db.close()
})

const task = { id: 't1', title: 'Buy milk', categoryType: 'short_term', categoryName: 'today', priority: 'medium', status: 'todo', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, subtasks: [] }

describe('task deletions reach pull clients', () => {
  it('GET /tasks hides a web-deleted task but /sync/changes reports its tombstone', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/sync/tasks', headers, payload: { upserts: [task] } })
    // Same shape as web-app deleteTask(): version + 1
    await app.inject({ method: 'POST', url: '/api/v1/sync/tasks', headers, payload: { deletions: [{ id: 't1', updatedAt: '2026-08-02T00:00:00.000Z', version: 2 }] } })

    const list = await app.inject({ method: 'GET', url: '/api/v1/tasks', headers })
    expect(list.json().tasks).toEqual([])

    const changes = await app.inject({ method: 'GET', url: `/api/v1/sync/changes?since=${EPOCH}`, headers })
    expect(changes.json()).toEqual({ upserts: [], deletions: [{ id: 't1', updatedAt: '2026-08-02T00:00:00.000Z', version: 2 }] })
  })

  it('a stale deletion (older version) does not delete a newer task', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/sync/tasks', headers, payload: { upserts: [{ ...task, version: 3 }] } })
    await app.inject({ method: 'POST', url: '/api/v1/sync/tasks', headers, payload: { deletions: [{ id: 't1', updatedAt: '2026-08-02T00:00:00.000Z', version: 2 }] } })
    const changes = await app.inject({ method: 'GET', url: `/api/v1/sync/changes?since=${EPOCH}`, headers })
    expect(changes.json().deletions).toEqual([])
    expect(changes.json().upserts).toHaveLength(1)
  })
})

describe('flat parentId rows', () => {
  it('nest under their parent in GET /tasks and /sync/changes; orphans become roots', async () => {
    const child = { ...task, id: 'c1', title: 'child', parentId: 't1' }
    const orphan = { ...task, id: 'o1', title: 'orphan', parentId: 'missing' }
    await app.inject({ method: 'POST', url: '/api/v1/sync/tasks', headers, payload: { upserts: [task, child, orphan] } })

    for (const url of ['/api/v1/tasks', `/api/v1/sync/changes?since=${EPOCH}`]) {
      const body = (await app.inject({ method: 'GET', url, headers })).json()
      const roots = body.tasks ?? body.upserts
      expect(roots.map((t: { id: string }) => t.id).sort()).toEqual(['o1', 't1'])
      const parent = roots.find((t: { id: string }) => t.id === 't1')
      expect(parent.subtasks.map((t: { id: string }) => t.id)).toEqual(['c1'])
    }
  })
})

