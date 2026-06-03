/**
 * 時刻ユーティリティ
 * - 保存: UTC
 * - 表示: ローカル時刻
 * - 「今日」の閾値: ローカル時計の午前6時（6時未満は前日扱い）
 */

/** ローカル Date → YYYY-MM-DD */
export function localDateString(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** 6時閾値で補正した「実効的な今日」の日付文字列（YYYY-MM-DD） */
export function effectiveLocalDate(d: Date = new Date()): string {
  const shifted = new Date(d)
  if (shifted.getHours() < 6) shifted.setDate(shifted.getDate() - 1)
  return localDateString(shifted)
}

/** UTC ISO 文字列 → ローカル日付文字列（YYYY-MM-DD） */
export function utcToLocalDateStr(iso: string): string {
  try {
    return localDateString(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * ローカル日付文字列（YYYY-MM-DD）からその日の06:00ローカル時刻のUTC ISO文字列を返す。
 * activity_logs のフィルタ境界に使用。
 */
export function dayStartUTC(localDate: string): string {
  return new Date(`${localDate}T06:00:00`).toISOString()
}

export function dayEndUTC(localDate: string): string {
  const d = new Date(`${localDate}T06:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

/** 相対時刻文字列（例: "3分前"） */
export function formatAgo(isoUtc: string): string {
  const diff = (Date.now() - new Date(isoUtc).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  return `${Math.floor(diff / 3600)}時間前`
}
