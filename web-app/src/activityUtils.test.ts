import { describe, it, expect } from 'vitest'
import { buildSegments, summaryFromSegments, BUCKET_MINUTES, GAP_CATEGORY, NUM_BUCKETS } from './activityUtils'
import type { ActivityLog } from './api'

const DAY_START_MS = new Date('2024-01-15T00:00:00Z').getTime()

function makeLog(startedAt: string, endedAt: string, category: string): ActivityLog {
  return {
    id: '1',
    deviceId: 'test',
    startedAt,
    endedAt,
    processName: '',
    windowTitle: '',
    browserUrl: null,
    category,
    isMediaPlaying: false,
    source: 'auto',
    createdAt: startedAt,
  }
}

describe('buildSegments', () => {
  it('single gap segment when no logs provided', () => {
    const segs = buildSegments([], DAY_START_MS)
    expect(segs).toHaveLength(1)
    expect(segs[0].category).toBe(GAP_CATEGORY)
    expect(segs[0].startBucket).toBe(0)
    expect(segs[0].bucketCount).toBe(NUM_BUCKETS)
  })

  it('creates correct segment for a single log', () => {
    // 09:00-09:30 UTC = 6 buckets at 5min each
    const log = makeLog('2024-01-15T09:00:00Z', '2024-01-15T09:30:00Z', '開発')
    const segs = buildSegments([log], DAY_START_MS)
    const devSeg = segs.find(s => s.category === '開発')
    expect(devSeg).toBeDefined()
    expect(devSeg!.bucketCount).toBe(6)
  })

  it('later-starting log overwrites earlier on overlapping buckets', () => {
    // older: 09:00-09:30 (会議), newer: 09:15-09:45 (開発)
    // After processing: 09:00-09:15 = 会議, 09:15-09:45 = 開発
    const older = makeLog('2024-01-15T09:00:00Z', '2024-01-15T09:30:00Z', '会議')
    const newer = makeLog('2024-01-15T09:15:00Z', '2024-01-15T09:45:00Z', '開発')
    const segs = buildSegments([older, newer], DAY_START_MS)
    const meetSeg = segs.find(s => s.category === '会議')
    const devSeg  = segs.find(s => s.category === '開発')
    expect(meetSeg!.bucketCount).toBe(3) // 15min = 3 buckets
    expect(devSeg!.bucketCount).toBe(6)  // 30min = 6 buckets
  })

  it('manual override takes precedence over auto log', () => {
    const log = makeLog('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z', '開発')
    const segs = buildSegments([log], DAY_START_MS, [{
      startedAt: '2024-01-15T09:00:00Z',
      endedAt: '2024-01-15T09:30:00Z',
      category: '休憩',
    }])
    const restSeg = segs.find(s => s.category === '休憩')
    const devSeg  = segs.find(s => s.category === '開発')
    expect(restSeg!.bucketCount).toBe(6) // 30min overridden to 休憩
    expect(devSeg!.bucketCount).toBe(6)  // remaining 30min stays 開発
  })

  it('sessions set contains the originating log', () => {
    const log = makeLog('2024-01-15T09:00:00Z', '2024-01-15T09:05:00Z', '開発')
    const segs = buildSegments([log], DAY_START_MS)
    const devSeg = segs.find(s => s.category === '開発')
    expect(devSeg!.sessions).toHaveLength(1)
    expect(devSeg!.sessions[0]).toBe(log)
  })
})

describe('summaryFromSegments', () => {
  it('aggregates duration by category', () => {
    const segs = buildSegments([
      makeLog('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z', '開発'),
      makeLog('2024-01-15T11:00:00Z', '2024-01-15T11:30:00Z', '開発'),
    ], DAY_START_MS)
    const summary = summaryFromSegments(segs)
    const devEntry = summary.find(s => s.category === '開発')
    expect(devEntry!.durationSec).toBe(90 * 60)
  })

  it('includes gap category in summary', () => {
    const segs = buildSegments([], DAY_START_MS)
    const summary = summaryFromSegments(segs)
    const gapEntry = summary.find(s => s.category === GAP_CATEGORY)
    expect(gapEntry!.durationSec).toBe(24 * 60 * 60)
  })
})
