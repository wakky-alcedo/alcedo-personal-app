import type { ActivityLog } from './api.ts'

export const BUCKET_MINUTES = 5
export const NUM_BUCKETS    = 24 * 60 / BUCKET_MINUTES  // 288
export const SLEEP_CATEGORY = '睡眠'
export const SLEEP_COLOR    = '#93c5fd'

export interface Segment {
  category: string
  startBucket: number
  bucketCount: number
  sessions: ActivityLog[]
}

/**
 * 複数デバイスのログを5分バケツでマージする。
 * 同一バケツに複数デバイスが競合する場合は startedAt が新しい方を優先。
 * 記録のないバケツは SLEEP_CATEGORY で埋める。
 */
export function buildSegments(logs: ActivityLog[], dayStartMs: number): Segment[] {
  const bucketCategory = new Array<string | null>(NUM_BUCKETS).fill(null)
  const bucketSession  = new Array<ActivityLog | null>(NUM_BUCKETS).fill(null)
  const BUCKET_MS = BUCKET_MINUTES * 60 * 1000

  const sorted = [...logs].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )
  for (const log of sorted) {
    const startMs = new Date(log.startedAt).getTime()
    const endMs   = new Date(log.endedAt ?? new Date().toISOString()).getTime()
    const startB  = Math.max(0, Math.floor((startMs - dayStartMs) / BUCKET_MS))
    const endB    = Math.min(NUM_BUCKETS, Math.ceil((endMs - dayStartMs) / BUCKET_MS))
    for (let i = startB; i < endB; i++) {
      bucketCategory[i] = log.category
      bucketSession[i]  = log
    }
  }

  const filled = bucketCategory.map(c => c ?? SLEEP_CATEGORY)

  const segments: Segment[] = []
  let cur = { category: filled[0], startBucket: 0, count: 1, sessions: new Set<ActivityLog>() }
  if (bucketSession[0]) cur.sessions.add(bucketSession[0])

  for (let i = 1; i < NUM_BUCKETS; i++) {
    if (filled[i] === cur.category) {
      cur.count++
      if (bucketSession[i]) cur.sessions.add(bucketSession[i] as ActivityLog)
    } else {
      segments.push({
        category: cur.category,
        startBucket: cur.startBucket,
        bucketCount: cur.count,
        sessions: Array.from(cur.sessions),
      })
      cur = {
        category: filled[i],
        startBucket: i,
        count: 1,
        sessions: new Set<ActivityLog>(bucketSession[i] ? [bucketSession[i] as ActivityLog] : []),
      }
    }
  }
  segments.push({
    category: cur.category,
    startBucket: cur.startBucket,
    bucketCount: cur.count,
    sessions: Array.from(cur.sessions),
  })

  return segments
}

/** セグメント一覧をカテゴリ別の秒数集計に変換する */
export function summaryFromSegments(segments: Segment[]): { category: string; durationSec: number }[] {
  const map: Record<string, number> = {}
  for (const seg of segments) {
    map[seg.category] = (map[seg.category] ?? 0) + seg.bucketCount * BUCKET_MINUTES * 60
  }
  return Object.entries(map).map(([category, durationSec]) => ({ category, durationSec }))
}
