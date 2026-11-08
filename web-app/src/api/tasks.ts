import type { Task, TaskNode } from '@shared/types'
import { randomId, requestJson } from './http.ts'
import { listFrom, normalizeSubtasks, normalizeTask } from './normalize.ts'

export type TaskInput = Omit<Task, 'updatedAt' | 'version'> & {
  updatedAt?: string
  version?: number
  subtasks?: TaskNode[]
}

type SyncResult = { acceptedUpserts: number; acceptedDeletions: number }

function withDefaults(task: Partial<TaskInput> & { title: string }): TaskInput {
  return {
    id: task.id ?? randomId(),
    title: task.title,
    description: task.description ?? null,
    categoryType: task.categoryType ?? 'short_term',
    categoryName: task.categoryName ?? 'today',
    priority: task.priority ?? 'medium',
    dueAt: task.dueAt ?? null,
    dueTime: task.dueTime ?? null,
    status: task.status ?? 'todo',
    updatedAt: task.updatedAt ?? new Date().toISOString(),
    version: task.version ?? 1,
    subtasks: normalizeSubtasks(task.subtasks),
  }
}

export async function getTasks(serverUrl: string, apiKey: string): Promise<Task[]> {
  const payload = await requestJson<unknown>(serverUrl, apiKey, '/tasks', 'fetch tasks failed')
  return listFrom(payload, 'tasks').map(normalizeTask)
}

export function createTask(serverUrl: string, apiKey: string, body: Partial<TaskInput> & { title: string }) {
  return requestJson<SyncResult>(serverUrl, apiKey, '/sync/tasks', 'create task failed', {
    method: 'POST',
    body: { tasks: [withDefaults(body)] },
  })
}

export function updateTask(serverUrl: string, apiKey: string, body: Task) {
  return requestJson<SyncResult>(serverUrl, apiKey, '/sync/tasks', 'update task failed', {
    method: 'POST',
    body: {
      tasks: [{
        ...body,
        updatedAt: new Date().toISOString(),
        version: body.version + 1,
        subtasks: normalizeSubtasks(body.subtasks),
      }],
    },
  })
}

export function deleteTask(serverUrl: string, apiKey: string, task: Task) {
  return requestJson<SyncResult>(serverUrl, apiKey, '/sync/tasks', 'delete task failed', {
    method: 'POST',
    body: { deletions: [{ id: task.id, updatedAt: new Date().toISOString(), version: task.version + 1 }] },
  })
}
