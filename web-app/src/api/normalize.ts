// Defensive parsing of server payloads into wire types (shared/types.ts).
// normalizeSubtasks must stay in sync with pc-server/src/routes/tasks.ts.
import type { Belief, Habit, Task, TaskNode } from '@shared/types'
import { randomId } from './http.ts'

type Rec = Record<string, unknown>

function asRecord(value: unknown): Rec {
  return value && typeof value === 'object' ? (value as Rec) : {}
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const STATUSES = ['todo', 'doing', 'done'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const CATEGORY_TYPES = ['short_term', 'long_term'] as const

/** Unwraps `{ [key]: [...] }` or a bare array; anything else is an empty list. */
export function listFrom(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload
  const inner = asRecord(payload)[key]
  return Array.isArray(inner) ? inner : []
}

export function normalizeSubtasks(subtasks: unknown): TaskNode[] {
  if (typeof subtasks === 'string') {
    try {
      return normalizeSubtasks(JSON.parse(subtasks))
    } catch {
      return []
    }
  }
  if (!Array.isArray(subtasks)) return []

  return subtasks.filter(Boolean).map((item): TaskNode => {
    const s = asRecord(item)
    return {
      id: str(s.id, randomId()),
      title: String(s.title ?? ''),
      description: nullableStr(s.description),
      dueAt: nullableStr(s.dueAt),
      priority: oneOf(s.priority, PRIORITIES, 'medium'),
      parentId: nullableStr(s.parentId),
      // Legacy subtasks carried `done: boolean` instead of `status`.
      status: oneOf(s.status, STATUSES, s.done ? 'done' : 'todo'),
      subtasks: normalizeSubtasks(s.subtasks),
    }
  })
}

export function normalizeTask(value: unknown): Task {
  const t = asRecord(value)
  return {
    id: String(t.id),
    title: str(t.title, ''),
    description: nullableStr(t.description),
    categoryType: oneOf(t.categoryType, CATEGORY_TYPES, 'short_term'),
    categoryName: str(t.categoryName, 'today'),
    priority: oneOf(t.priority, PRIORITIES, 'medium'),
    dueAt: nullableStr(t.dueAt),
    dueTime: nullableStr(t.dueTime),
    status: oneOf(t.status, STATUSES, 'todo'),
    deletedAt: nullableStr(t.deletedAt),
    updatedAt: str(t.updatedAt, new Date().toISOString()),
    version: Number(t.version ?? 1),
    subtasks: normalizeSubtasks(t.subtasks),
  }
}

export function normalizeBelief(value: unknown): Belief {
  const b = asRecord(value)
  return {
    id: String(b.id),
    text: str(b.text, ''),
    isActive: Boolean(b.isActive),
    createdAt: str(b.createdAt, ''),
    updatedAt: str(b.updatedAt, ''),
  }
}

export function normalizeHabit(value: unknown): Habit {
  const h = asRecord(value)
  return {
    id: String(h.id),
    name: str(h.name, ''),
    notifyTime: nullableStr(h.notifyTime),
    widgetPriorityTimeRangeStart: nullableStr(h.widgetPriorityTimeRangeStart),
    widgetPriorityTimeRangeEnd: nullableStr(h.widgetPriorityTimeRangeEnd),
    allowedMissDays: Number(h.allowedMissDays ?? 0),
    isActive: Boolean(h.isActive),
    createdAt: str(h.createdAt, ''),
    updatedAt: str(h.updatedAt, ''),
    completedToday: Boolean(h.completedToday),
    streakDays: Number(h.streakDays ?? 0),
    lastDoneDate: nullableStr(h.lastDoneDate),
  }
}
