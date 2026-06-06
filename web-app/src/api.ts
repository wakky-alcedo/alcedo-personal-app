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
      priority: (subtask.priority as any) ?? 'medium',
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
    priority: task.priority ?? 'medium',
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
    priority: task.priority ?? 'medium',
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

export async function getHabitLogs(serverUrl: string, apiKey: string, from: string, to: string): Promise<Array<{ habitId: string; doneDate: string }>> {
  const res = await fetch(`${serverUrl}/api/v1/habits/logs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch habit logs failed')
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


// ─── Analytics ───────────────────────────────────────────────────────────────

export type AnalyticsEntry = {
  id: string
  targetDate: string
  source: string
  category: string
  durationSec: number
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AnalyticsDailyResponse = {
  date: string
  entries: AnalyticsEntry[]
  totalSec: number
  snsWarning: boolean
}

export type AnalyticsSummaryDay = { date: string } & { [category: string]: number | string }

export type AnalyticsSummaryResponse = {
  range: string
  startDate: string
  endDate: string
  data: AnalyticsSummaryDay[]
  snsWarning: boolean
}

export async function getAnalyticsDaily(serverUrl: string, apiKey: string, date: string): Promise<AnalyticsDailyResponse> {
  const res = await fetch(`${serverUrl}/api/v1/analytics/daily?date=${encodeURIComponent(date)}`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch analytics daily failed')
  return res.json()
}

export async function createAnalyticsEntry(
  serverUrl: string, apiKey: string,
  body: { id?: string; targetDate: string; category: string; durationSec?: number; startedAt?: string; endedAt?: string; source?: string }
): Promise<AnalyticsEntry> {
  const res = await fetch(`${serverUrl}/api/v1/analytics/daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('create analytics entry failed')
  return res.json()
}

export async function deleteAnalyticsEntry(serverUrl: string, apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${serverUrl}/api/v1/analytics/daily/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('delete analytics entry failed')
}

export async function getAnalyticsSummary(
  serverUrl: string, apiKey: string,
  range: 'weekly' | 'monthly', anchor?: string
): Promise<AnalyticsSummaryResponse> {
  const params = new URLSearchParams({ range })
  if (anchor) params.set('anchor', anchor)
  const res = await fetch(`${serverUrl}/api/v1/analytics/summary?${params}`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch analytics summary failed')
  return res.json()
}

// ─── Activity Tracking ──────────────────────────────────────────────────────

export type ActivityLog = {
  id: string
  deviceId: string
  startedAt: string
  endedAt: string | null
  processName: string
  windowTitle: string
  browserUrl: string | null
  category: string
  isMediaPlaying: boolean
  source: string
  createdAt: string
}

export type ActivitySummary = {
  category: string
  durationSec: number
}

export type ActivityRule = {
  id: string
  pattern: string
  field: 'processName' | 'windowTitle' | 'browserUrl'
  category: string
  priority: number
  createdAt: string
  updatedAt: string
}

export async function getCurrentActivity(serverUrl: string, apiKey: string): Promise<ActivityLog | null> {
  const res = await fetch(`${serverUrl}/api/v1/activity/current`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch current activity failed')
  return res.json()
}

export async function getActivityLogs(serverUrl: string, apiKey: string, date: string, deviceId?: string): Promise<ActivityLog[]> {
  const params = new URLSearchParams({ date })
  if (deviceId) params.set('deviceId', deviceId)
  const res = await fetch(`${serverUrl}/api/v1/activity/logs?${params}`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch activity logs failed')
  return res.json()
}

export async function getActivitySummary(serverUrl: string, apiKey: string, date: string, deviceId?: string): Promise<ActivitySummary[]> {
  const params = new URLSearchParams({ date })
  if (deviceId) params.set('deviceId', deviceId)
  const res = await fetch(`${serverUrl}/api/v1/activity/summary?${params}`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch activity summary failed')
  return res.json()
}

export async function getActivityDevices(serverUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${serverUrl}/api/v1/activity/devices`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch activity devices failed')
  const rows = await res.json() as Array<{ deviceId: string }>
  return rows.map(r => r.deviceId)
}

export async function updateActivityCategory(serverUrl: string, apiKey: string, id: string, category: string): Promise<void> {
  const res = await fetch(`${serverUrl}/api/v1/activity/logs/${encodeURIComponent(id)}/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ category })
  })
  if (!res.ok) throw new Error('update activity category failed')
}

export async function getActivityRules(serverUrl: string, apiKey: string): Promise<ActivityRule[]> {
  const res = await fetch(`${serverUrl}/api/v1/activity/rules`, {
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('fetch activity rules failed')
  return res.json()
}

export async function createActivityRule(
  serverUrl: string, apiKey: string,
  body: { pattern: string; field?: string; category: string; priority?: number }
): Promise<ActivityRule> {
  const res = await fetch(`${serverUrl}/api/v1/activity/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('create activity rule failed')
  return res.json()
}

export async function updateActivityRule(
  serverUrl: string, apiKey: string,
  rule: ActivityRule
): Promise<ActivityRule> {
  const res = await fetch(`${serverUrl}/api/v1/activity/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(rule)
  })
  if (!res.ok) throw new Error('update activity rule failed')
  return res.json()
}

export async function reclassifyActivity(serverUrl: string, apiKey: string): Promise<{ updated: number }> {
  const res = await fetch(`${serverUrl}/api/v1/activity/reclassify`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('reclassify failed')
  return res.json()
}

export async function importActivityRules(
  serverUrl: string, apiKey: string,
  rules: Array<{ pattern: string; field?: string; category: string; priority?: number }>,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ imported: number; mode: string }> {
  const res = await fetch(`${serverUrl}/api/v1/activity/rules/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ rules, mode })
  })
  if (!res.ok) throw new Error('import failed')
  return res.json()
}

export async function deleteActivityRule(serverUrl: string, apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${serverUrl}/api/v1/activity/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey }
  })
  if (!res.ok) throw new Error('delete activity rule failed')
}
