import React, { useMemo, useState } from 'react'
import type { ActivityLog } from '../../api.ts'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'
import { colorFor as colorForFn } from '../../categoryColors.ts'
import { effectiveLocalDate, dayStartUTC } from '../../timeUtils.ts'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const BUCKET_MINUTES = 5               // 集約単位（分）
const NUM_BUCKETS    = 24 * 60 / BUCKET_MINUTES  // 288
const SLEEP_CATEGORY = '睡眠'
const SLEEP_COLOR    = '#93c5fd'       // 淡いブルー
const GAP_COLOR      = '#e2e8f0'       // 未記録グレー

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface Segment {
  category: string
  startBucket: number
  bucketCount: number
  sessions: ActivityLog[]     // このセグメントに含まれるセッション
}

interface TooltipState {
  x: number
  y: number
  segment: Segment
}

// ─── アルゴリズム ─────────────────────────────────────────────────────────────

function buildSegments(logs: ActivityLog[], dayStartMs: number): Segment[] {
  // 1. バケツ配列を初期化（null = ギャップ）
  const bucketCategory = new Array<string | null>(NUM_BUCKETS).fill(null)
  const bucketSession  = new Array<ActivityLog | null>(NUM_BUCKETS).fill(null)

  const BUCKET_MS = BUCKET_MINUTES * 60 * 1000

  // 2. 各セッションをバケツに割り当て（後のstartedAtが上書き = 直近デバイス優先）
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

  // 3. ギャップを睡眠で埋める
  const filled = bucketCategory.map(c => c ?? SLEEP_CATEGORY)

  // 4. 連続する同カテゴリをまとめてSegmentに
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

function bucketToLabel(bucket: number): string {
  const totalMin = bucket * BUCKET_MINUTES
  const h = Math.floor(totalMin / 60 + 6) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m}m` : `${m}m`
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

type Props = {
  logs: ActivityLog[]
  date: string   // YYYY-MM-DD（実効ローカル日付）
}

export default function DayTimeline({ logs, date }: Props) {
  const { colors } = useCategoryColors()
  const colorFor = (cat: string) =>
    cat === SLEEP_CATEGORY ? SLEEP_COLOR : colorForFn(colors, cat)

  const [tooltip, setTooltip]         = useState<TooltipState | null>(null)
  const [expandedSeg, setExpandedSeg] = useState<Segment | null>(null)

  const dayStartMs = useMemo(
    () => new Date(dayStartUTC(date)).getTime(),
    [date]
  )

  const segments = useMemo(
    () => buildSegments(logs, dayStartMs),
    [logs, dayStartMs]
  )

  // 時刻ラベル（偶数時刻のみ）
  const hourLabels = Array.from({ length: 13 }, (_, i) => i * 2)  // 0,2,4,...,24 → 6,8,...,6

  return (
    <div style={{ userSelect: 'none' }}>
      {/* タイムラインバー */}
      <div style={{ position: 'relative', height: 28, display: 'flex', borderRadius: 6, overflow: 'hidden', cursor: 'pointer' }}>
        {segments.map((seg, i) => {
          const widthPct = (seg.bucketCount / NUM_BUCKETS) * 100
          return (
            <div
              key={i}
              style={{
                width: `${widthPct}%`,
                background: colorFor(seg.category),
                flexShrink: 0,
                transition: 'filter 0.1s',
              }}
              onMouseMove={e => {
                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
                setTooltip({ x: e.clientX - rect.left, y: -40, segment: seg })
              }}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => setExpandedSeg(expandedSeg?.startBucket === seg.startBucket ? null : seg)}
            />
          )
        })}

        {/* ツールチップ */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: Math.min(tooltip.x, (tooltip.x < 200 ? tooltip.x : tooltip.x - 160)),
            top: -44, background: 'rgba(24,34,53,0.92)', color: '#fff',
            padding: '4px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 10,
          }}>
            <b>{tooltip.segment.category}</b>
            &nbsp;{bucketToLabel(tooltip.segment.startBucket)}–{bucketToLabel(tooltip.segment.startBucket + tooltip.segment.bucketCount)}
            &nbsp;({formatDuration(tooltip.segment.bucketCount * BUCKET_MINUTES * 60)})
          </div>
        )}
      </div>

      {/* 時刻軸 */}
      <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
        {hourLabels.map(offset => {
          const h = (6 + offset) % 24   // offset は既に「日開始からの時間数」
          const pct = (offset / 24) * 100
          return (
            <span key={offset} style={{
              position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
              fontSize: 10, color: '#667085',
            }}>
              {offset === 0 || offset === 24 ? '6' : String(h).padStart(2, '0')}
            </span>
          )
        })}
      </div>

      {/* クリック時のセッション詳細 */}
      {expandedSeg && expandedSeg.sessions.length > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px', background: '#f8fbff',
          border: '1px solid #e6edf8', borderRadius: 8, fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#182235' }}>
            {bucketToLabel(expandedSeg.startBucket)}–{bucketToLabel(expandedSeg.startBucket + expandedSeg.bucketCount)}
            &nbsp;
            <span style={{ color: colorFor(expandedSeg.category) }}>{expandedSeg.category}</span>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {expandedSeg.sessions
              .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
              .map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#667085' }}>
                  <span>{new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.windowTitle || s.processName}
                  </span>
                  <span style={{ fontSize: 11, background: '#eef3ff', padding: '1px 4px', borderRadius: 3 }}>
                    {s.deviceId}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {Array.from(new Set(segments.map(s => s.category))).map(cat => (
          <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#667085' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(cat), display: 'inline-block' }} />
            {cat}
          </span>
        ))}
      </div>
    </div>
  )
}
