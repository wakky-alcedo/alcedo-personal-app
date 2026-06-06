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
