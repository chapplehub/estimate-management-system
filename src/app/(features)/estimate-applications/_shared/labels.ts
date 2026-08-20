/**
 * 見積申請（一覧 `/estimate-applications` と詳細 `[estimateNumber]/[variationNumber]`）で共有する
 * 表示ラベル・整形ヘルパ（presentation 専用）。
 *
 * 一覧・詳細の共通親（`estimate-applications/`）直下の `_shared` に置き、両画面で同じ提出区分ラベル・
 * 金額/日時整形を単一ソースにする。見積申請機能に閉じるため global（`_lib`）へは昇格しない
 * （機能固有は昇格しない方針）。
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

/** 日時を JST の「2026/07/01 13:45」形式に整形する。 */
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
