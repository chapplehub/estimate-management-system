/**
 * 消費税率の表示整形ヘルパ（presentation 専用・作成 C1／複製 C6 で共有）。
 *
 * 税率は生値（0..1）で扱い、表示は「8%」「10%」へ整形する。作成・複製の各フォーム表示と
 * §8.7 税率不一致のフォームエラー文言が同一表記を使うため、`Math.round(rate * 100)` の
 * 散在と文言コピペを 1 箇所へ集約する。VO ではなく number を受け、整形を純粋関数に閉じる。
 */

/** 税率（生値 0..1）を「8%」形式へ整形する。 */
export function formatTaxRatePercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * 税率不一致（§8.7）のフォームエラー文言を生成する。
 *
 * 見積年月日の税率と締切日の税率が異なるとき、両税率を提示して日付の確認を促す。作成
 * （checkTaxRateThenCreate）・複製（checkTaxRateThenDuplicate）が返す taxRateMismatch は同型で、
 * どちらの Server Action も同じ文言で reply するため共有する（ADR-0056/0057）。
 */
export function taxRateMismatchFormErrors(
  estimateDateRate: number,
  deadlineRate: number
): string[] {
  return [
    `見積年月日（${formatTaxRatePercent(estimateDateRate)}）と締切日（${formatTaxRatePercent(
      deadlineRate
    )}）で税率が異なります。日付を確認してください（§8.7）。`,
  ];
}
