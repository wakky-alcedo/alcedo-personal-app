import type { HabitLog } from '../../api.ts'

/** habitId → set of done dates, for the heatmap. */
export function groupDoneDatesByHabit(logs: HabitLog[]): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {}
  for (const { habitId, doneDate } of logs) {
    (map[habitId] ??= new Set()).add(doneDate)
  }
  return map
}
