/**
 * 見積申請一覧（/estimate-applications）の表示ラベル・整形ヘルパ（presentation 専用）。
 * この機能に閉じた小さな写像として持つ（日付・バッジのような複数画面共有部品は _lib へ昇格済みだが、
 * これらは本一覧固有のため昇格しない）。
 */

/** 提出区分（バリエーションの submissionType・ADR-0045）。 */
export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "得意先向け",
  DELIVERY_LOCATION: "納品先向け",
};

/** 金額（円・主単位）を「1,000円」形式に整形する。 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 申請日時を JST の「2026/07/01 13:45」形式に整形する。 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
