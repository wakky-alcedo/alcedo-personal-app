import { describe, it, expect } from 'vitest'
import { computeStreakDays } from './habits.js'

describe('computeStreakDays', () => {
  it('allowedMissDays=0: a single missed day breaks the streak (no regression)', () => {
    // today, yesterday logged; the day before that missed; older days logged
    const logSet = new Set(['2026-08-05', '2026-08-04', '2026-08-02', '2026-08-01'])
    expect(computeStreakDays(logSet, '2026-08-05', 0)).toBe(2)
  })

  it('tolerates a gap within the allowed run length', () => {
    // today, yesterday logged; 2026-08-03 missed; 08-02, 08-01 logged
    const logSet = new Set(['2026-08-05', '2026-08-04', '2026-08-02', '2026-08-01'])
    expect(computeStreakDays(logSet, '2026-08-05', 1)).toBe(4)
  })

  it('breaks the streak when a gap exceeds allowedMissDays', () => {
    // today, yesterday logged; 08-03 and 08-02 missed (2-day gap); 08-01 logged
    const logSet = new Set(['2026-08-05', '2026-08-04', '2026-08-01'])
    expect(computeStreakDays(logSet, '2026-08-05', 1)).toBe(2)
  })

  it('absorbs two independent gaps that are each within the allowance', () => {
    // 08-05, 08-04 logged; 08-03,08-02 missed (gap of 2); 08-01,07-31 logged; 07-30,07-29 missed (gap of 2); 07-28 logged
    const logSet = new Set([
      '2026-08-05', '2026-08-04',
      '2026-08-01', '2026-07-31',
      '2026-07-28',
    ])
    expect(computeStreakDays(logSet, '2026-08-05', 2)).toBe(5)
  })

  it('completedToday/lastDoneDate concerns are independent of allowedMissDays (streak count only reflects logged days)', () => {
    const logSet = new Set(['2026-08-04'])
    // today not logged -> falls back to yesterday; allowedMissDays shouldn't matter here
    expect(computeStreakDays(logSet, '2026-08-05', 0)).toBe(1)
    expect(computeStreakDays(logSet, '2026-08-05', 3)).toBe(1)
  })

  it('does not consume the miss budget for "today" when today is not yet checked in', () => {
    const logSet = new Set(['2026-08-04', '2026-08-03'])
    expect(computeStreakDays(logSet, '2026-08-05', 0)).toBe(2)
  })

  it('terminates promptly at the earliest logged date (no infinite loop) even with a large allowance', () => {
    const logSet = new Set(['2026-08-05'])
    expect(computeStreakDays(logSet, '2026-08-05', 5)).toBe(1)
  })

  it('empty log set yields a streak of 0', () => {
    expect(computeStreakDays(new Set(), '2026-08-05', 3)).toBe(0)
  })
})
