import { describe, it, expect } from 'vitest'
import { listFrom, normalizeHabit, normalizeSubtasks, normalizeTask } from './normalize.ts'

describe('normalizeSubtasks', () => {
  it('parses JSON strings and maps legacy done:boolean to status', () => {
    const result = normalizeSubtasks(JSON.stringify([{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B' }]))
    expect(result.map(s => [s.id, s.status])).toEqual([['a', 'done'], ['b', 'todo']])
  })

  it('keeps explicit status and recurses into children', () => {
    const [node] = normalizeSubtasks([{ id: 'a', title: 'A', status: 'doing', subtasks: [{ id: 'c', title: 'C' }] }])
    expect(node).toMatchObject({ status: 'doing', priority: 'medium', parentId: null, description: null })
    expect(node.subtasks[0].id).toBe('c')
  })

  it('returns [] for malformed input', () => {
    expect(normalizeSubtasks('{not json')).toEqual([])
    expect(normalizeSubtasks(42)).toEqual([])
  })
})

describe('normalizeTask', () => {
  it('fills defaults and rejects unknown enum values', () => {
    const task = normalizeTask({ id: 't1', status: 'archived', priority: 'urgent', version: '3' })
    expect(task).toMatchObject({ id: 't1', title: '', status: 'todo', priority: 'medium', categoryType: 'short_term', categoryName: 'today', version: 3, subtasks: [] })
  })
})

describe('normalizeHabit', () => {
  it('coerces numbers and booleans', () => {
    expect(normalizeHabit({ id: 'h', name: 'Run', isActive: 1, allowedMissDays: '2', streakDays: '5', completedToday: 0 }))
      .toMatchObject({ isActive: true, allowedMissDays: 2, streakDays: 5, completedToday: false, lastDoneDate: null })
  })
})

describe('listFrom', () => {
  it('accepts a bare array or a wrapped list', () => {
    expect(listFrom([1], 'x')).toEqual([1])
    expect(listFrom({ x: [2] }, 'x')).toEqual([2])
    expect(listFrom({ y: [2] }, 'x')).toEqual([])
    expect(listFrom(null, 'x')).toEqual([])
  })
})
