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

describe('addDays', () => {
  it('crosses month and year boundaries', async () => {
    const { addDays } = await import('./date.js')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-08-05', -59)).toBe('2026-06-07')
  })
})

describe('isDateKey', () => {
  it('accepts only real YYYY-MM-DD dates', async () => {
    const { isDateKey } = await import('./date.js')
    expect(isDateKey('2026-08-05')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-8-5')).toBe(false)
    expect(isDateKey(20260805)).toBe(false)
  })
})

describe('dayBoundsUtc', () => {
  it('spans 06:00 JST to 06:00 JST next day', async () => {
    const { dayBoundsUtc } = await import('./date.js')
    expect(dayBoundsUtc('2026-08-05', 9)).toEqual({ start: '2026-08-04T21:00:00.000Z', end: '2026-08-05T21:00:00.000Z' })
    expect(dayBoundsUtc('2027-01-01', 9)).toEqual({ start: '2026-12-31T21:00:00.000Z', end: '2027-01-01T21:00:00.000Z' })
  })
})

describe('normalizeIsoTimestamp', () => {
  it('re-formats parsable timestamps and falls back otherwise', async () => {
    const { normalizeIsoTimestamp } = await import('./date.js')
    const fallback = '2026-01-01T00:00:00.000Z'
    // Kotlin Instant.toString() drops zero millis and may carry micros
    expect(normalizeIsoTimestamp('2026-11-08T04:04:37Z', fallback)).toBe('2026-11-08T04:04:37.000Z')
    expect(normalizeIsoTimestamp('2026-11-08T04:04:37.343123Z', fallback)).toBe('2026-11-08T04:04:37.343Z')
    expect(normalizeIsoTimestamp('not a date', fallback)).toBe(fallback)
    expect(normalizeIsoTimestamp(undefined, fallback)).toBe(fallback)
  })
})
