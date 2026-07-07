/**
 * app 共有の JST 固定 日付ヘルパ（presentation 専用）。
 *
 * `<input type="date">` の value（"yyyy-mm-dd"）と Date instant を JST で相互変換する。
 * `z.coerce.date()` や `new Date("yyyy-mm-dd")` は文字列を UTC 0 時として解釈するため、
 * JST 環境では暦日が前日へずれ（day-shift）、§8.7 の税率 era 判定を誤らせる。これを
 * 避けるため、表示・パースとも JST（+09:00 / Asia/Tokyo）に固定する（ADR-0025 と同じ精神）。
 */

/** Date を JST の暦日 "yyyy-mm-dd"（input[type=date] の value 形式）へ整形する。 */
export function toDateInputValue(date: Date): string {
  // en-CA ロケールは "yyyy-mm-dd" 形式。timeZone 指定で JST の暦日に固定する。
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "yyyy-mm-dd" を JST 0 時の instant として解釈する（UTC 解釈の day-shift を避ける）。 */
export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00+09:00`);
}

/**
 * "yyyy-mm-dd" を JST 当日終端 `23:59:59.999`（inclusive 上限）の instant として解釈する。
 *
 * 申請日レンジ検索の上限に使う。BE の `appliedTo` は「この日時以前（≤・inclusive）」ゆえ、
 * 半開区間の翌日 0 時ではなく当日終端を上限とする（`fromDateInputValue` の下限と対になる）。
 */
export function toEndOfDayInstant(value: string): Date {
  return new Date(`${value}T23:59:59.999+09:00`);
}
