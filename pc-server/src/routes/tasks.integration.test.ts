import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/index.js'

type Db = InstanceType<typeof Database>

function makeTestDb(): Db {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  return db
}

const UPSERT_SQL = `
  INSERT INTO tasks (
    id, title, description, categoryType, categoryName, priority, dueAt, dueTime, status, subtasks, parentId, deletedAt, updatedAt, version
  ) VALUES (
    @id, @title, @description, @categoryType, @categoryName, @priority, @dueAt, @dueTime, @status, @subtasks, @parentId, NULL, @updatedAt, @version
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    categoryType = excluded.categoryType,
    categoryName = excluded.categoryName,
    priority = excluded.priority,
    dueAt = excluded.dueAt,
    dueTime = excluded.dueTime,
    status = excluded.status,
    subtasks = excluded.subtasks,
    parentId = excluded.parentId,
    deletedAt = CASE WHEN excluded.version > tasks.version THEN NULL ELSE tasks.deletedAt END,
    updatedAt = excluded.updatedAt,
    version = excluded.version
  WHERE excluded.version > tasks.version
     OR (excluded.version = tasks.version AND excluded.updatedAt > tasks.updatedAt)
`

const MARK_DELETED_SQL = `
  UPDATE tasks
  SET
    status = 'done',
    deletedAt = @updatedAt,
    updatedAt = @updatedAt,
    version = @version
  WHERE id = @id
    AND (@version > version OR (@version = version AND @updatedAt > updatedAt))
`

const BASE = {
  id: 'task-1',
  title: 'Test Task',
  description: null,
  categoryType: 'short_term',
  categoryName: 'dev',
  priority: 'medium',
  dueAt: null,
  dueTime: null,
  status: 'todo',
  subtasks: '[]',
  parentId: null,
}

function upsert(db: Db, patch: Record<string, unknown>) {
  db.prepare(UPSERT_SQL).run({ ...BASE, ...patch })
}

function getTask(db: Db, id = 'task-1') {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

describe('upsert conflict resolution', () => {
  let db: Db
  beforeEach(() => { db = makeTestDb() })

  it('inserts a new task', () => {
    upsert(db, { updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    const row = getTask(db)
    expect(row?.title).toBe('Test Task')
    expect(row?.version).toBe(1)
  })

  it('stores and retrieves dueTime independently of dueAt', () => {
    upsert(db, { dueAt: '2024-01-20T00:00:00.000Z', dueTime: '09:30', updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    const row = getTask(db)
    expect(row?.dueAt).toBe('2024-01-20T00:00:00.000Z')
    expect(row?.dueTime).toBe('09:30')
  })

  it('dueTime defaults to null when not provided', () => {
    upsert(db, { updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    expect(getTask(db)?.dueTime).toBeNull()
  })

  it('higher version overwrites stored task', () => {
    upsert(db, { title: 'v1', updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    upsert(db, { title: 'v2', updatedAt: '2024-01-15T11:00:00.000Z', version: 2 })
    const row = getTask(db)
    expect(row?.title).toBe('v2')
    expect(row?.version).toBe(2)
  })

  it('lower version is rejected (stored wins)', () => {
    upsert(db, { title: 'v2', updatedAt: '2024-01-15T11:00:00.000Z', version: 2 })
    upsert(db, { title: 'v1', updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    const row = getTask(db)
    expect(row?.title).toBe('v2')
    expect(row?.version).toBe(2)
  })

  it('same version: newer updatedAt wins', () => {
    upsert(db, { title: 'old', updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    upsert(db, { title: 'new', updatedAt: '2024-01-15T11:00:00.000Z', version: 1 })
    expect(getTask(db)?.title).toBe('new')
  })

  it('same version: older updatedAt is rejected', () => {
    upsert(db, { title: 'new', updatedAt: '2024-01-15T11:00:00.000Z', version: 1 })
    upsert(db, { title: 'old', updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    expect(getTask(db)?.title).toBe('new')
  })

  it('higher version clears deletedAt (undelete)', () => {
    upsert(db, { updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
    // soft-delete at v1
    db.prepare(MARK_DELETED_SQL).run({ id: 'task-1', updatedAt: '2024-01-15T10:30:00.000Z', version: 1 })
    expect(getTask(db)?.deletedAt).toBeTruthy()
    // v2 upsert should clear deletedAt
    upsert(db, { updatedAt: '2024-01-15T11:00:00.000Z', version: 2 })
    expect(getTask(db)?.deletedAt).toBeNull()
    expect(getTask(db)?.version).toBe(2)
  })
})

describe('markDeleted conflict resolution', () => {
  let db: Db
  beforeEach(() => {
    db = makeTestDb()
    upsert(db, { updatedAt: '2024-01-15T10:00:00.000Z', version: 1 })
  })

  it('soft-deletes when version matches', () => {
    db.prepare(MARK_DELETED_SQL).run({ id: 'task-1', updatedAt: '2024-01-15T11:00:00.000Z', version: 1 })
    const row = getTask(db)
    expect(row?.deletedAt).toBe('2024-01-15T11:00:00.000Z')
    expect(row?.status).toBe('done')
  })

  it('soft-delete rejected if stored version is higher', () => {
    upsert(db, { title: 'v2', updatedAt: '2024-01-15T11:00:00.000Z', version: 2 })
    db.prepare(MARK_DELETED_SQL).run({ id: 'task-1', updatedAt: '2024-01-15T09:00:00.000Z', version: 1 })
    expect(getTask(db)?.deletedAt).toBeNull()
    expect(getTask(db)?.version).toBe(2)
  })
})
