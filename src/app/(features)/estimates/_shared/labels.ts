/**
 * 見積詳細画面（S2）の表示ラベル・整形ヘルパ。
 * presentation 専用（DTO の enum 値・数値を日本語表示へ写す）。
 */

/** 見積区分（②タイトルバッジ）。 */
export const ESTIMATE_TYPE_LABELS: Record<string, string> = {
  NEW: "新規",
  REPAIR: "修理",
  AFTER_REPAIR: "事後",
};

/** 提出区分（⑤操作行バッジ・ADR-0045）。 */
export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "得意先向け",
  DELIVERY_LOCATION: "納品先向け",
};

/** バリエーション状態（⑤状態インジケータ）。 */
export const VARIATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "有効",
  INACTIVE: "無効",
};

/** 商品区分（⑥明細の区分列・D10 はドメイン enum 値を表示）。 */
export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  INDIVIDUAL: "個別商品",
  CONSUMABLE: "消耗品",
  SET: "セット商品",
};

/** 金額（円・主単位）を「1,000円」形式に整形する。 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 日付を「2025/04/01」形式に整形する（RSC 側で使用）。 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
