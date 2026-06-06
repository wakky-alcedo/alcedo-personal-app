/** 秒数 → "1h 30m" 形式（DailyPieChart向け英語省略形） */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** 秒数 → "1時間30分" 形式（日本語表記） */
export function formatDurationJa(sec: number): string {
  if (sec <= 0) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}時間${m}分` : `${m}分`
}

/** YYYY-MM-DD + HH:MM(:SS) → UTC ISO文字列（同カレンダー日として扱う） */
export function toISO(date: string, time: string): string {
  const parts = time.split(':').map(Number)
  const hhmm = `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:00`
  return new Date(`${date}T${hhmm}`).toISOString()
}

/** UTC ISO文字列 → "HH:MM" ローカル時刻文字列 */
export function isoToLocalTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
