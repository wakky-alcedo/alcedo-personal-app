import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationJa, toISO, isoToLocalTime } from './format'

describe('formatDuration', () => {
  it('minutes only when under 1 hour', () => {
    expect(formatDuration(300)).toBe('5m')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(59)).toBe('0m')
  })
  it('hours only when minutes is 0', () => {
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(7200)).toBe('2h')
  })
  it('hours and minutes combined', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(90 * 60)).toBe('1h 30m')
    expect(formatDuration(3661)).toBe('1h 1m')
  })
})

describe('formatDurationJa', () => {
  it('empty string for 0 or negative', () => {
    expect(formatDurationJa(0)).toBe('')
    expect(formatDurationJa(-1)).toBe('')
  })
  it('minutes only when under 1 hour', () => {
    expect(formatDurationJa(300)).toBe('5分')
    expect(formatDurationJa(60)).toBe('1分')
  })
  it('hours and minutes', () => {
    expect(formatDurationJa(3600)).toBe('1時間0分')
    expect(formatDurationJa(5400)).toBe('1時間30分')
    expect(formatDurationJa(7260)).toBe('2時間1分')
  })
})

describe('toISO / isoToLocalTime', () => {
  it('round-trips HH:MM through ISO string', () => {
    expect(isoToLocalTime(toISO('2024-01-15', '09:30'))).toBe('09:30')
    expect(isoToLocalTime(toISO('2024-01-15', '00:00'))).toBe('00:00')
    expect(isoToLocalTime(toISO('2024-01-15', '23:59'))).toBe('23:59')
  })
  it('isoToLocalTime returns empty string for null', () => {
    expect(isoToLocalTime(null)).toBe('')
  })
  it('toISO pads single-digit hours and minutes', () => {
    const iso = toISO('2024-01-15', '9:5')
    expect(isoToLocalTime(iso)).toBe('09:05')
  })
})
