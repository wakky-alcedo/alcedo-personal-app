import { describe, it, expect } from 'vitest'
import { localDateKey } from './date.js'

describe('localDateKey', () => {
  it('returns YYYY-MM-DD for daytime (JST 21:00)', () => {
    // UTC 12:00 = JST 21:00 → same day
    expect(localDateKey(new Date('2024-01-15T12:00:00Z'), 9)).toBe('2024-01-15')
  })

  it('treats pre-6am JST as previous calendar day', () => {
    // UTC 20:00 = JST 05:00 → before 6am → previous day
    expect(localDateKey(new Date('2024-01-15T20:00:00Z'), 9)).toBe('2024-01-15')
  })

  it('treats exactly 6am JST as the current day', () => {
    // UTC 21:00 = JST 06:00 → at cutoff → current day
    expect(localDateKey(new Date('2024-01-15T21:00:00Z'), 9)).toBe('2024-01-16')
  })

  it('handles midnight UTC correctly', () => {
    // UTC 00:00 = JST 09:00 → same day
    expect(localDateKey(new Date('2024-01-15T00:00:00Z'), 9)).toBe('2024-01-15')
  })

  it('works across month boundaries', () => {
    // UTC 2024-01-31 20:00 = JST 2024-02-01 05:00 → pre-6am → 2024-01-31
    expect(localDateKey(new Date('2024-01-31T20:00:00Z'), 9)).toBe('2024-01-31')
  })

  it('works across year boundaries', () => {
    // UTC 2023-12-31 20:00 = JST 2024-01-01 05:00 → pre-6am → 2023-12-31
    expect(localDateKey(new Date('2023-12-31T20:00:00Z'), 9)).toBe('2023-12-31')
  })

  it('uses custom offset (UTC+5)', () => {
    // UTC 01:00 + 5h = 06:00 → at cutoff → current day
    expect(localDateKey(new Date('2024-01-15T01:00:00Z'), 5)).toBe('2024-01-15')
    // UTC 00:30 + 5h = 05:30 → pre-6am → previous day
    expect(localDateKey(new Date('2024-01-15T00:30:00Z'), 5)).toBe('2024-01-14')
  })
})
