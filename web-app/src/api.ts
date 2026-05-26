export type Task = {
  id: string
  title: string
  description?: string | null
  categoryType: 'short_term' | 'long_term'
  categoryName: string
  priority: 'low' | 'medium' | 'high'
  dueAt?: string | null
  status: 'todo' | 'doing' | 'done'
  deletedAt?: string | null
  updatedAt: string
  version: number
  subtasks: TaskNode[]
}

export type TaskNode = {
  id: string
  title: string
  description?: string | null
  done: boolean
  dueAt?: string | null
  priority?: 'low' | 'medium' | 'high'
  parentId?: string | null
  subtasks: TaskNode[]
}

export type Belief = {
  id: string
  text: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type BeliefInput = Partial<Belief> & { text: string }

export type Habit = {
  id: string
  name: string
  notifyTime?: string | null
  widgetPriorityTimeRangeStart?: string | null
  widgetPriorityTimeRangeEnd?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  completedToday: boolean
  streakDays: number
  lastDoneDate: string | null
}

export type HabitInput = Partial<Habit> & { name: string }

export type TaskInput = Omit<Task, 'updatedAt' | 'version'> & {
  updatedAt?: string
  version?: number
  subtasks?: TaskNode[]
}

export async function getTasks(serverUrl: string, apiKey: string): Promise<Task[]> {
  const res = await fetch(`${serverUrl}/api/v1/tasks`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch tasks failed')
  const payload = await res.json()
  if (Array.isArray(payload)) return payload.map(normalizeTask)
  if (Array.isArray(payload?.tasks)) return payload.tasks.map(normalizeTask)
  return []
}

function normalizeSubtasks(subtasks: unknown): TaskNode[] {
  if (typeof subtasks === 'string') {
    try {
      return normalizeSubtasks(JSON.parse(subtasks))
    } catch {
      return []
    }
  }

  if (!Array.isArray(subtasks)) return []

  return subtasks
    .filter(Boolean)
    .map((subtask: any) => ({
      id: subtask.id ?? randomId(),
      title: String(subtask.title ?? ''),
      description: subtask.description ?? null,
      dueAt: subtask.dueAt ?? null,
      priority: (subtask.priority as any) ?? 'low',
      parentId: subtask.parentId ?? null,
      done: Boolean(subtask.done),
      subtasks: normalizeSubtasks(subtask.subtasks),
    }))
}

function normalizeTask(task: any): Task {
  return {
    id: task.id,
    title: task.title ?? '',
    description: task.description ?? null,
    categoryType: task.categoryType ?? 'short_term',
    categoryName: task.categoryName ?? 'today',
    priority: task.priority ?? 'low',
    dueAt: task.dueAt ?? null,
    status: task.status ?? 'todo',
    deletedAt: task.deletedAt ?? null,
    updatedAt: task.updatedAt ?? new Date().toISOString(),
    version: Number(task.version ?? 1),
    subtasks: normalizeSubtasks(task.subtasks),
  }
}

function withDefaults(task: Partial<TaskInput> & { title: string }): TaskInput {
  return {
    id: task.id ?? crypto.randomUUID(),
    title: task.title,
    description: task.description ?? null,
    categoryType: task.categoryType ?? 'short_term',
    categoryName: task.categoryName ?? 'today',
    priority: task.priority ?? 'low',
    dueAt: task.dueAt ?? null,
    status: task.status ?? 'todo',
    updatedAt: task.updatedAt ?? new Date().toISOString(),
    version: task.version ?? 1,
    subtasks: normalizeSubtasks(task.subtasks),
  }
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeBelief(belief: any): Belief {
  return {
    id: belief.id,
    text: belief.text ?? '',
    isActive: Boolean(belief.isActive),
    createdAt: belief.createdAt,
    updatedAt: belief.updatedAt,
  }
}

function normalizeHabit(habit: any): Habit {
  return {
    id: habit.id,
    name: habit.name ?? '',
    notifyTime: habit.notifyTime ?? null,
    widgetPriorityTimeRangeStart: habit.widgetPriorityTimeRangeStart ?? null,
    widgetPriorityTimeRangeEnd: habit.widgetPriorityTimeRangeEnd ?? null,
    isActive: Boolean(habit.isActive),
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
    completedToday: Boolean(habit.completedToday),
    streakDays: Number(habit.streakDays ?? 0),
    lastDoneDate: habit.lastDoneDate ?? null,
  }
}

export async function getBeliefs(serverUrl: string, apiKey: string): Promise<Belief[]> {
  const res = await fetch(`${serverUrl}/api/v1/beliefs`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch beliefs failed')
  const payload = await res.json()
  const beliefs = Array.isArray(payload) ? payload : payload?.beliefs
  if (Array.isArray(beliefs)) return beliefs.map(normalizeBelief)
  return []
}

export async function createBelief(serverUrl: string, apiKey: string, body: BeliefInput) {
  const belief = {
    id: body.id ?? randomId(),
    text: body.text,
    isActive: body.isActive ?? true,
    createdAt: body.createdAt ?? new Date().toISOString(),
    updatedAt: body.updatedAt ?? new Date().toISOString(),
  }
  const res = await fetch(`${serverUrl}/api/v1/beliefs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(belief)
  })
  if (!res.ok) throw new Error('create belief failed')
  return res.json()
}

export async function updateBelief(serverUrl: string, apiKey: string, body: Belief) {
  const res = await fetch(`${serverUrl}/api/v1/beliefs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({
      ...body,
      updatedAt: new Date().toISOString(),
    })
  })
  if (!res.ok) throw new Error('update belief failed')
  return res.json()
}

export async function deleteBelief(serverUrl: string, apiKey: string, belief: Belief) {
  const res = await fetch(`${serverUrl}/api/v1/beliefs/${belief.id}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('delete belief failed')
  return res.json()
}

export async function getHabits(serverUrl: string, apiKey: string): Promise<Habit[]> {
  const res = await fetch(`${serverUrl}/api/v1/habits`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch habits failed')
  const payload = await res.json()
  const habits = Array.isArray(payload) ? payload : payload?.habits
  if (Array.isArray(habits)) return habits.map(normalizeHabit)
  return []
}

export async function createHabit(serverUrl: string, apiKey: string, body: HabitInput) {
  const habit = {
    id: body.id ?? randomId(),
    name: body.name,
    notifyTime: body.notifyTime ?? null,
    widgetPriorityTimeRangeStart: body.widgetPriorityTimeRangeStart ?? null,
    widgetPriorityTimeRangeEnd: body.widgetPriorityTimeRangeEnd ?? null,
    isActive: body.isActive ?? true,
    createdAt: body.createdAt ?? new Date().toISOString(),
    updatedAt: body.updatedAt ?? new Date().toISOString(),
  }
  const res = await fetch(`${serverUrl}/api/v1/habits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(habit)
  })
  if (!res.ok) throw new Error('create habit failed')
  return res.json()
}

export async function updateHabit(serverUrl: string, apiKey: string, body: Habit) {
  const res = await fetch(`${serverUrl}/api/v1/habits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({
      ...body,
      updatedAt: new Date().toISOString(),
    })
  })
  if (!res.ok) throw new Error('update habit failed')
  return res.json()
}

export async function deleteHabit(serverUrl: string, apiKey: string, habit: Habit) {
  const res = await fetch(`${serverUrl}/api/v1/habits/${habit.id}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('delete habit failed')
  return res.json()
}

export async function checkInHabit(serverUrl: string, apiKey: string, habit: Habit) {
  const res = await fetch(`${serverUrl}/api/v1/habits/${habit.id}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({ doneDate: new Date().toISOString().slice(0, 10) })
  })
  if (!res.ok) throw new Error('habit check-in failed')
  return res.json()
}

export async function createTask(serverUrl: string, apiKey: string, body: Partial<TaskInput> & { title: string }) {
  const res = await fetch(`${serverUrl}/api/v1/sync/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({ tasks: [withDefaults(body)] })
  })
  if (!res.ok) throw new Error('create task failed')
  return res.json()
}

export async function updateTask(serverUrl: string, apiKey: string, body: Task) {
  const res = await fetch(`${serverUrl}/api/v1/sync/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({
      tasks: [
        {
          ...body,
          updatedAt: new Date().toISOString(),
          version: body.version + 1,
          subtasks: normalizeSubtasks(body.subtasks),
        },
      ],
    })
  })
  if (!res.ok) throw new Error('update task failed')
  return res.json()
}

export async function deleteTask(serverUrl: string, apiKey: string, task: Task) {
  const res = await fetch(`${serverUrl}/api/v1/sync/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify({
      deletions: [
        {
          id: task.id,
          updatedAt: new Date().toISOString(),
          version: task.version + 1,
        },
      ],
    })
  })
  if (!res.ok) throw new Error('delete task failed')
  return res.json()
}

export async function markTaskDone(serverUrl: string, apiKey: string, task: Task) {
  return updateTask(serverUrl, apiKey, {
    ...task,
    status: 'done',
    updatedAt: new Date().toISOString(),
    version: task.version + 1,
  })
}
