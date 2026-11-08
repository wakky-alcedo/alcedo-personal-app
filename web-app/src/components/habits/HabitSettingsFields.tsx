import React from 'react'
import { parseAllowedMissDays, type HabitSettings } from './habitSettings.ts'

type Props = {
  value: HabitSettings
  onChange: (next: HabitSettings) => void
  /** Inline editor commits on blur; the create form doesn't. */
  onBlur?: () => void
  /** 'editor' stacks the active checkbox like the other fields; 'form' keeps it inline. */
  variant: 'form' | 'editor'
}

export default function HabitSettingsFields({ value, onChange, onBlur, variant }: Props) {
  const set = <K extends keyof HabitSettings>(key: K, v: HabitSettings[K]) => onChange({ ...value, [key]: v })

  return (
    <>
      <label className="habit-field">
        <span className="field-label">通知時刻</span>
        <input type="time" value={value.notifyTime} onChange={e => set('notifyTime', e.target.value)} onBlur={onBlur} />
      </label>
      <label className="habit-field">
        <span className="field-label">ウィジェット優先 開始</span>
        <input type="time" value={value.priorityStart} onChange={e => set('priorityStart', e.target.value)} onBlur={onBlur} />
      </label>
      <label className="habit-field">
        <span className="field-label">ウィジェット優先 終了</span>
        <input type="time" value={value.priorityEnd} onChange={e => set('priorityEnd', e.target.value)} onBlur={onBlur} />
      </label>
      <label className="habit-field">
        <span className="field-label">何日連続まで休んでOK</span>
        <input
          type="number"
          min={0}
          step={1}
          value={value.allowedMissDays}
          onChange={e => set('allowedMissDays', parseAllowedMissDays(e.target.value))}
          onBlur={onBlur}
        />
      </label>
      {variant === 'editor' ? (
        <label className="checkbox-row habit-field">
          <input type="checkbox" checked={value.isActive} onChange={e => set('isActive', e.target.checked)} />
          <span className="field-label">active</span>
        </label>
      ) : (
        <label className="checkbox-row">
          <input type="checkbox" checked={value.isActive} onChange={e => set('isActive', e.target.checked)} />
          active
        </label>
      )}
    </>
  )
}
