import { describe, it, expect } from 'vitest'
import type { Task } from '../api.ts'
import { isoToLocalTime, toISO } from './format.ts'
import { buildNotifiedKey, getTaskDueDateTime, pruneNotifiedKeys, selectTasksToNotify } from './dueTaskNotifications.ts'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'タスク',
    categoryType: 'short_term',
    categoryName: 'general',
    priority: 'medium',
    dueAt: null,
    dueTime: null,
    status: 'todo',
    deletedAt: null,
    updatedAt: '2024-01-01T00:00:00.000Z',
    version: 1,
    subtasks: [],
    ...overrides,
  }
}

/** Date -> ローカル日付("YYYY-MM-DD")とローカル時刻("HH:mm") */
function localDateAndTime(d: Date): { date: string; time: string } {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }
}

const NOW = new Date(2024, 0, 15, 10, 0, 0, 0)

function taskDueInMinutes(id: string, minutes: number, overrides: Partial<Task> = {}): Task {
  const due = new Date(NOW.getTime() + minutes * 60_000)
  const { date, time } = localDateAndTime(due)
  return makeTask({ id, dueAt: `${date}T00:00:00.000Z`, dueTime: time, ...overrides })
}

describe('getTaskDueDateTime', () => {
  it('returns null when dueAt is missing', () => {
    expect(getTaskDueDateTime({ dueAt: null, dueTime: '09:30' })).toBeNull()
  })

  it('returns null when dueTime is missing', () => {
    expect(getTaskDueDateTime({ dueAt: '2024-01-15T00:00:00.000Z', dueTime: null })).toBeNull()
  })

  it('returns null when both are missing', () => {
    expect(getTaskDueDateTime({ dueAt: null, dueTime: null })).toBeNull()
  })

  it('combines the date part of dueAt with dueTime', () => {
    const due = getTaskDueDateTime({ dueAt: '2024-01-15T00:00:00.000Z', dueTime: '09:30' })
    expect(due).not.toBeNull()
    expect(isoToLocalTime(due!.toISOString())).toBe('09:30')
    expect(due!.toISOString()).toBe(toISO('2024-01-15', '09:30'))
  })

  it('ignores a non-midnight time component on dueAt', () => {
    const due = getTaskDueDateTime({ dueAt: '2024-01-15T05:00:00.000Z', dueTime: '09:30' })
    expect(isoToLocalTime(due!.toISOString())).toBe('09:30')
  })
})

describe('buildNotifiedKey', () => {
  it('combines id, dueAt and dueTime', () => {
    const task = makeTask({ id: 't1', dueAt: '2024-01-15T00:00:00.000Z', dueTime: '09:30' })
    expect(buildNotifiedKey(task)).toBe('t1:2024-01-15T00:00:00.000Z:09:30')
  })

  it('produces a different key when dueTime changes', () => {
    const a = makeTask({ id: 't1', dueAt: '2024-01-15T00:00:00.000Z', dueTime: '09:30' })
    const b = makeTask({ id: 't1', dueAt: '2024-01-15T00:00:00.000Z', dueTime: '10:00' })
    expect(buildNotifiedKey(a)).not.toBe(buildNotifiedKey(b))
  })
})

describe('selectTasksToNotify', () => {
  it('includes a task due within the reminder window', () => {
    const task = taskDueInMinutes('t1', 10)
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([task])
  })

  it('excludes a task due outside the reminder window', () => {
    const task = taskDueInMinutes('t1', 45)
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([])
  })

  it('excludes an already-overdue task', () => {
    const task = taskDueInMinutes('t1', -5)
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([])
  })

  it('excludes done tasks', () => {
    const task = taskDueInMinutes('t1', 10, { status: 'done' })
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([])
  })

  it('excludes deleted tasks', () => {
    const task = taskDueInMinutes('t1', 10, { deletedAt: '2024-01-14T00:00:00.000Z' })
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([])
  })

  it('excludes tasks without dueTime', () => {
    const task = makeTask({ id: 't1', dueAt: '2024-01-15T00:00:00.000Z', dueTime: null })
    expect(selectTasksToNotify([task], NOW, 30, new Set())).toEqual([])
  })

  it('excludes tasks already notified', () => {
    const task = taskDueInMinutes('t1', 10)
    expect(selectTasksToNotify([task], NOW, 30, new Set([buildNotifiedKey(task)]))).toEqual([])
  })

  it('returns only matching tasks among many', () => {
    const dueSoon = taskDueInMinutes('t1', 10)
    const dueLater = taskDueInMinutes('t2', 45)
    const done = taskDueInMinutes('t3', 10, { status: 'done' })
    expect(selectTasksToNotify([dueSoon, dueLater, done], NOW, 30, new Set())).toEqual([dueSoon])
  })
})

describe('pruneNotifiedKeys', () => {
  it('removes the key of a task that is now done', () => {
    const task = taskDueInMinutes('t1', 10)
    const key = buildNotifiedKey(task)
    const done = { ...task, status: 'done' as const }
    expect(pruneNotifiedKeys([done], new Set([key]))).toEqual(new Set())
  })

  it('removes the key of a task that no longer exists', () => {
    const task = taskDueInMinutes('t1', 10)
    const key = buildNotifiedKey(task)
    expect(pruneNotifiedKeys([], new Set([key]))).toEqual(new Set())
  })

  it('removes a stale key when the task due time changes', () => {
    const task = taskDueInMinutes('t1', 10)
    const staleKey = buildNotifiedKey(task)
    const updated = taskDueInMinutes('t1', 20)
    expect(pruneNotifiedKeys([updated], new Set([staleKey]))).toEqual(new Set())
  })

  it('keeps the key of a still-pending task', () => {
    const task = taskDueInMinutes('t1', 10)
    const key = buildNotifiedKey(task)
    expect(pruneNotifiedKeys([task], new Set([key]))).toEqual(new Set([key]))
  })
})
