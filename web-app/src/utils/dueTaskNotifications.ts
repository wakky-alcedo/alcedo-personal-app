import type { Task } from '../api.ts'
import { toISO } from './format.ts'

/** タスクの dueAt(日付) + dueTime(HH:mm) を結合した期限時刻。いずれか未設定なら null */
export function getTaskDueDateTime(task: Pick<Task, 'dueAt' | 'dueTime'>): Date | null {
  if (!task.dueAt || !task.dueTime) return null
  const datePart = task.dueAt.slice(0, 10)
  return new Date(toISO(datePart, task.dueTime))
}

/** 「通知済み」キー。dueAt/dueTime が変わると新しいキーになり再通知される */
export function buildNotifiedKey(task: Pick<Task, 'id' | 'dueAt' | 'dueTime'>): string {
  return `${task.id}:${task.dueAt}:${task.dueTime}`
}

/**
 * 通知すべきタスクを選定する。
 * 対象: dueAt/dueTime が両方設定済み、status !== 'done'、deletedAt なし、
 * 期限が (now, now + reminderMinutes] の範囲内、かつ未通知のもの。
 */
export function selectTasksToNotify(
  tasks: Task[],
  now: Date,
  reminderMinutes: number,
  notifiedKeys: ReadonlySet<string>,
): Task[] {
  const nowMs = now.getTime()
  const windowMs = reminderMinutes * 60_000
  return tasks.filter(task => {
    if (task.status === 'done' || task.deletedAt) return false
    const due = getTaskDueDateTime(task)
    if (!due) return false
    const diffMs = due.getTime() - nowMs
    if (diffMs <= 0 || diffMs > windowMs) return false
    return !notifiedKeys.has(buildNotifiedKey(task))
  })
}

/** done/削除/編集済みタスクの古い通知済みキーを除去し、無限増加を防ぐ */
export function pruneNotifiedKeys(tasks: Task[], notifiedKeys: ReadonlySet<string>): Set<string> {
  const validKeys = new Set(
    tasks
      .filter(task => task.status !== 'done' && !task.deletedAt && getTaskDueDateTime(task))
      .map(buildNotifiedKey)
  )
  return new Set([...notifiedKeys].filter(key => validKeys.has(key)))
}
