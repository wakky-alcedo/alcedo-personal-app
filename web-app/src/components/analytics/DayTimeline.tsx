import React, { useMemo, useState } from 'react'
import type { ActivityLog } from '../../api.ts'
import { useCategoryColors } from '../../CategoryColorsContext.tsx'
import { colorFor as colorForFn } from '../../categoryColors.ts'
import { dayStartUTC } from '../../timeUtils.ts'
import {
  buildSegments, BUCKET_MINUTES, NUM_BUCKETS, SLEEP_CATEGORY, SLEEP_COLOR, GAP_CATEGORY,
  type Segment, type ManualOverride,
} from '../../activityUtils.ts'

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number
  y: number
  segment: Segment
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
  manualOverrides?: ManualOverride[]
}

export default function DayTimeline({ logs, date, manualOverrides = [] }: Props) {
  const { colors } = useCategoryColors()
  const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const colorFor = (cat: string) => {
    if (cat === SLEEP_CATEGORY) return SLEEP_COLOR
    if (cat === GAP_CATEGORY) return isDark ? '#2d3748' : '#e2e8f0'
    return colorForFn(colors, cat)
  }

  const [tooltip, setTooltip]         = useState<TooltipState | null>(null)
  const [expandedSeg, setExpandedSeg] = useState<Segment | null>(null)

  const dayStartMs = useMemo(
    () => new Date(dayStartUTC(date)).getTime(),
    [date]
  )

  const segments = useMemo(
    () => buildSegments(logs, dayStartMs, manualOverrides),
    [logs, dayStartMs, manualOverrides]
  )

  // 現在時刻の位置（当日のみ有効）
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000
  const nowMs = Date.now()
  const nowFraction = (nowMs >= dayStartMs && nowMs < dayEndMs)
    ? (nowMs - dayStartMs) / (dayEndMs - dayStartMs)
    : null

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

        {/* 現在時刻以降の半透明オーバーレイ */}
        {nowFraction !== null && (
          <div
            className="dt-now-overlay"
            style={{ left: `${nowFraction * 100}%` }}
          />
        )}
        {/* 現在時刻の赤い縦線 */}
        {nowFraction !== null && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `calc(${nowFraction * 100}% - 1px)`,
            width: 2, background: '#ef4444',
            pointerEvents: 'none', zIndex: 3,
          }} />
        )}

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
          const h = (6 + offset) % 24
          const pct = (offset / 24) * 100
          return (
            <span key={offset} style={{
              position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
              fontSize: 10, color: 'var(--text-muted)',
            }}>
              {offset === 0 || offset === 24 ? '6' : String(h).padStart(2, '0')}
            </span>
          )
        })}
        {/* 現在時刻ラベル */}
        {nowFraction !== null && (
          <span style={{
            position: 'absolute',
            left: `${nowFraction * 100}%`,
            transform: 'translateX(-50%)',
            fontSize: 10, color: '#ef4444', fontWeight: 600,
          }}>
            ▲
          </span>
        )}
      </div>

      {/* クリック時のセッション詳細 */}
      {expandedSeg && expandedSeg.sessions.length > 0 && (
        <div className="dt-expanded-panel">
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
            {bucketToLabel(expandedSeg.startBucket)}–{bucketToLabel(expandedSeg.startBucket + expandedSeg.bucketCount)}
            &nbsp;
            <span style={{ color: colorFor(expandedSeg.category) }}>{expandedSeg.category}</span>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {expandedSeg.sessions
              .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
              .map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)' }}>
                  <span>{new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.windowTitle || s.processName}
                  </span>
                  <span className="dt-device-badge">
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
          <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(cat), display: 'inline-block' }} />
            {cat}
          </span>
        ))}
      </div>
    </div>
  )
}
