// JST固定（UTC+9）のオフセットを使用。getTimezoneOffset()はサーバーのシステムTZに依存するため使わない。
const TZ_OFFSET_HOURS = Number(process.env.TZ_OFFSET_HOURS ?? 9);

/**
 * 任意の日時から「実効ローカル日付キー」を返す（YYYY-MM-DD）。
 * 午前6時未満は前日扱い。
 */
export function localDateKey(date = new Date(), offsetHours = TZ_OFFSET_HOURS): string {
  const local = new Date(date.getTime() + offsetHours * 3600_000);
  if (local.getUTCHours() < 6) local.setUTCDate(local.getUTCDate() - 1);
  return [
    local.getUTCFullYear(),
    String(local.getUTCMonth() + 1).padStart(2, '0'),
    String(local.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** 現在時刻の実効ローカル日付キーを返す（YYYY-MM-DD）。 */
export function effectiveLocalDate(offsetHours = TZ_OFFSET_HOURS): string {
  return localDateKey(new Date(), offsetHours);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 形式かつ実在する日付かを判定する。 */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * 日付キー（YYYY-MM-DD）に days 日を加算した日付キーを返す。
 * 既に解決済みの「実効ローカル日付」に対する純粋な暦計算なので、
 * localDateKey() を再適用してはならない（JSTオフセットの二重適用で日付がずれる）。
 */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** 実効日（6時境界）が日付キーの日になる区間 [start, end) を UTC ISO 文字列で返す。 */
export function dayBoundsUtc(dateKey: string, offsetHours = TZ_OFFSET_HOURS): { start: string; end: string } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 6 - offsetHours));
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}
