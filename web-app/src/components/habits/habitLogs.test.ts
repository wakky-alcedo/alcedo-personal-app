import { describe, it, expect } from 'vitest'
import { groupDoneDatesByHabit } from './habitLogs.ts'

describe('groupDoneDatesByHabit', () => {
  it('groups and de-duplicates dates per habit', () => {
    const map = groupDoneDatesByHabit([
      { habitId: 'a', doneDate: '2026-08-01' },
      { habitId: 'b', doneDate: '2026-08-01' },
      { habitId: 'a', doneDate: '2026-08-02' },
      { habitId: 'a', doneDate: '2026-08-02' },
    ])
    expect([...map.a].sort()).toEqual(['2026-08-01', '2026-08-02'])
    expect([...map.b]).toEqual(['2026-08-01'])
  })
})
