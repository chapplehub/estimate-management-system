/**
 * 任意の Date を JST 基準の暦日文字列 `"YYYY-MM-DD"` に変換する純関数。
 *
 * 時点解決 QueryService（ADR-20260624-95f）は「変換済みの暦日文字列」を入力に取る。
 * Date→JST暦日の変換は価格決定の責務であり、その唯一の変換点としてここに置く。
 *
 * ドメイン層は外部依存禁止のため、`FiscalYear.from` と同じく Date の UTC ミリ秒に
 * +9h オフセットを加えてから `getUTC*` で読む純関数として実装する
 * （実行環境TZや `process.env.TZ` に依存しない）。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toJstCalendarDay(date: Date): string {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
