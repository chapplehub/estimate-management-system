/**
 * バリ内容編集中の金額ライブプレビュー（計画 §8・ADR-0033/0028）。
 *
 * ドメインの確定計算（LineItemAmountPolicy / EstimateAmountPolicy）を **円単位で近似**する
 * クライアント用の純関数。確定値はあくまでドメインが唯一の真実で、保存後に DTO で上書きする。
 * 円未満の端数（銭）は扱わないため、確定値と最大1円ずれうる前提（ADR-0050 影響欄）。
 */

/** 行金額計算の入力（プレビューに必要な数値のみ）。 */
export type PreviewLine = {
  quantity: number;
  unitPrice: number;
  discountRate: number;
  itemDiscount: number;
};

/**
 * 行の最終金額（円）。§8.1(1)-(3) を円単位で近似する:
 *   基本金額 = floor(数量 × 単価) → 掛率適用 = floor(基本 × 掛率) → 最終 = 掛率後 − 明細値引。
 */
export function previewLineAmount(line: PreviewLine): number {
  const baseAmount = Math.floor(line.unitPrice * line.quantity);
  const discountedAmount = Math.floor(baseAmount * line.discountRate);
  return discountedAmount - line.itemDiscount;
}

/**
 * 明細単位の粗利（円）＝改訂価格 − 行金額（§8.4・改訂明細のみ）。改訂価格を持たない明細は
 * null（粗利を計算できない）。改訂先の価格調整で行ごと・合計の粗利表示に共用する純関数。
 */
export function lineGross(
  line: PreviewLine & { revisedDeliveryPrice: number | null }
): number | null {
  return line.revisedDeliveryPrice !== null
    ? line.revisedDeliveryPrice - previewLineAmount(line)
    : null;
}

/**
 * セット群の表示金額（円）＝構成明細の最終金額の合計（ADR-0047 導出）。
 * 群自身は価格を持たないため、ヘッダ行はこの導出値を表示する。
 */
export function previewGroupAmount(components: ReadonlyArray<PreviewLine>): number {
  return components.reduce((acc, line) => acc + previewLineAmount(line), 0);
}

/** バリ合計プレビューの結果（円）。 */
export type PreviewTotals = {
  /** §8.1(4) 小計 = Σ行金額。 */
  subtotal: number;
  /** §8.1(5) 全体値引後 = 小計 − 全体値引。 */
  afterOverallDiscount: number;
  /** §8.1(6) 消費税額 = 区分丸め(全体値引後 × 税率)。 */
  taxAmount: number;
  /** §8.1(7) 合計 = 全体値引後 + 消費税額。 */
  finalTotal: number;
};

/** 税端数区分（§8.3）を円単位の丸め関数へ写す（TaxRoundingType.applyTo と同型）。 */
function roundTax(rawTax: number, taxRoundingType: string): number {
  switch (taxRoundingType) {
    case "ROUND_UP":
      return Math.ceil(rawTax);
    case "ROUND":
      return Math.round(rawTax);
    case "ROUND_DOWN":
    default:
      return Math.floor(rawTax);
  }
}

/**
 * バリの小計・全体値引後・税額・合計を円単位で近似する（§8.1(4)-(7)）。
 * 確定値はドメイン（EstimateAmountPolicy）が唯一の真実で保存後に DTO で上書きする。
 */
export function previewVariationTotals(args: {
  lines: PreviewLine[];
  overallDiscount: number;
  taxRate: number;
  taxRoundingType: string;
}): PreviewTotals {
  const subtotal = args.lines.reduce((acc, line) => acc + previewLineAmount(line), 0);
  const afterOverallDiscount = subtotal - args.overallDiscount;
  const taxAmount = roundTax(afterOverallDiscount * args.taxRate, args.taxRoundingType);
  const finalTotal = afterOverallDiscount + taxAmount;

  return { subtotal, afterOverallDiscount, taxAmount, finalTotal };
}
