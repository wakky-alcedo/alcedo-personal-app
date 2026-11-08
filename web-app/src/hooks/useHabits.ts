import { useCallback, useEffect, useState } from 'react'
import { checkInHabit, createHabit, deleteHabit, getHabitLogs, getHabits, updateHabit, type Habit, type HabitInput } from '../api.ts'
import { buildHeatmapDays, HEATMAP_DAYS } from '../components/HabitHeatmap.tsx'
import { groupDoneDatesByHabit } from '../components/habits/habitLogs.ts'
import { useAppConfig } from '../contexts/AppConfigContext.tsx'
import { useToast } from '../contexts/ToastContext.tsx'

/** Habits + heatmap logs with CRUD/check-in actions. Failures surface as toasts. */
export function useHabits() {
  const { serverUrl, apiKey } = useAppConfig()
  const { toast } = useToast()
  const [habits, setHabits] = useState<Habit[]>([])
  const [doneMap, setDoneMap] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const days = buildHeatmapDays()
      const [nextHabits, logs] = await Promise.all([
        getHabits(serverUrl, apiKey),
        getHabitLogs(serverUrl, apiKey, days[0], days[HEATMAP_DAYS - 1]),
      ])
      setHabits(nextHabits)
      setDoneMap(groupDoneDatesByHabit(logs))
    } catch (error) {
      console.error(error)
      toast.error('習慣の取得に失敗しました')
      setHabits([])
    } finally {
      setLoading(false)
    }
  }, [serverUrl, apiKey, toast])

  useEffect(() => { void refresh() }, [refresh])

  async function mutate(action: () => Promise<unknown>, failureMessage: string): Promise<boolean> {
    let ok = true
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast.error(failureMessage)
      ok = false
    }
    await refresh()
    return ok
  }

  return {
    habits,
    doneMap,
    loading,
    refresh,
    create: (input: HabitInput) => mutate(() => createHabit(serverUrl, apiKey, input), '習慣の作成に失敗しました'),
    save: async (habit: Habit) => { await mutate(() => updateHabit(serverUrl, apiKey, habit), '習慣の更新に失敗しました') },
    remove: async (habit: Habit) => { await mutate(() => deleteHabit(serverUrl, apiKey, habit), '習慣の削除に失敗しました') },
    checkIn: async (habit: Habit) => { await mutate(() => checkInHabit(serverUrl, apiKey, habit), 'チェックインに失敗しました') },
  }
}
