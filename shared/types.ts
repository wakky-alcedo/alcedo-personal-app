// HTTP wire types — shapes exchanged over the API.
// Server-internal types (TaskRow, StoredSubtask, etc.) stay in pc-server.

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

export type Memo = {
  id: string
  body: string
  sourceUrl?: string | null
  sourceTitle?: string | null
  version: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}
