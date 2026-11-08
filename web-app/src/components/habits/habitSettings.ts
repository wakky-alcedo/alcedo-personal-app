import type { Habit } from '../../api.ts'

/** Editable habit settings as form state (empty string = unset time). */
export type HabitSettings = {
  notifyTime: string
  priorityStart: string
  priorityEnd: string
  allowedMissDays: number
  isActive: boolean
}

export const EMPTY_HABIT_SETTINGS: HabitSettings = {
  notifyTime: '',
  priorityStart: '',
  priorityEnd: '',
  allowedMissDays: 0,
  isActive: true,
}

export function settingsFromHabit(habit: Habit): HabitSettings {
  return {
    notifyTime: habit.notifyTime ?? '',
    priorityStart: habit.widgetPriorityTimeRangeStart ?? '',
    priorityEnd: habit.widgetPriorityTimeRangeEnd ?? '',
    allowedMissDays: habit.allowedMissDays ?? 0,
    isActive: habit.isActive,
  }
}

/** Maps form state back to the wire fields of `Habit`. */
export function settingsToHabitFields(settings: HabitSettings) {
  return {
    notifyTime: settings.notifyTime || null,
    widgetPriorityTimeRangeStart: settings.priorityStart || null,
    widgetPriorityTimeRangeEnd: settings.priorityEnd || null,
    allowedMissDays: settings.allowedMissDays,
    isActive: settings.isActive,
  }
}

/** Parses the "allowed miss days" number input: non-negative integer, blank → 0. */
export function parseAllowedMissDays(raw: string): number {
  return Math.max(0, parseInt(raw, 10) || 0)
}
