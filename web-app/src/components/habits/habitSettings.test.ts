import { describe, it, expect } from 'vitest'
import { parseAllowedMissDays, settingsFromHabit, settingsToHabitFields } from './habitSettings.ts'
import type { Habit } from '../../api.ts'

const habit: Habit = {
  id: 'h', name: 'Run', notifyTime: '07:00', widgetPriorityTimeRangeStart: null, widgetPriorityTimeRangeEnd: '09:00',
  allowedMissDays: 1, isActive: false, createdAt: '', updatedAt: '', completedToday: false, streakDays: 0, lastDoneDate: null,
}

describe('habit settings', () => {
  it('round-trips between Habit and form state, mapping empty strings to null', () => {
    const settings = settingsFromHabit(habit)
    expect(settings).toEqual({ notifyTime: '07:00', priorityStart: '', priorityEnd: '09:00', allowedMissDays: 1, isActive: false })
    expect(settingsToHabitFields(settings)).toEqual({
      notifyTime: '07:00', widgetPriorityTimeRangeStart: null, widgetPriorityTimeRangeEnd: '09:00', allowedMissDays: 1, isActive: false,
    })
  })

  it('parses allowed miss days defensively', () => {
    expect(parseAllowedMissDays('3')).toBe(3)
    expect(parseAllowedMissDays('')).toBe(0)
    expect(parseAllowedMissDays('-2')).toBe(0)
    expect(parseAllowedMissDays('2.7')).toBe(2)
  })
})
