import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";

/**
 * 改訂明細を含むか判定する（編集可否・複製適格性の共通条件）。改訂明細は revisedDeliveryPrice を
 * 持つ通常明細（§8.4）で、セット群の構成明細としても現れ得るため構成内まで走査する。
 */
function containsRevisedLine(variation: VariationDTO): boolean {
  return variation.lines.some((node) =>
    node.kind === "setGroup"
      ? node.components.some((c) => c.revisedDeliveryPrice !== null)
      : node.revisedDeliveryPrice !== null
  );
}

/**
 * 編集可能なバリか判定する（UI 抑止・二重防御の外側）。
 *
 * 条件は「有効（ACTIVE）」かつ「改訂明細を含まない」こと。セット群そのものは S5・C4 で全置換
 * できるようになったため編集を妨げない。最終強制はドメイン（replaceContent）が担う（ADR-0047）。
 */
export function isVariationEditable(variation: VariationDTO): boolean {
  return variation.status === "ACTIVE" && !containsRevisedLine(variation);
}

/**
 * 複製元にできるバリか判定する（C3・UI 抑止）。
 *
 * 条件は「改訂明細を含まない」ことのみ（バリエーション状態は問わない）。改訂スナップショットは
 * 改訂系譜と不可分の凍結状態で、系譜なしの新バリへ持ち越すと整合が壊れるため複製元から除く。
 * 一方、無効(INACTIVE)バリは複製元にでき（ボツ案を土台に再検討）、複製は複製元を変更しない
 * 読み取り操作なので状態を問わない（計画§複製元の適格性）。編集可否(isVariationEditable)と違い
 * ACTIVE は要求しない。
 */
export function isVariationDuplicatable(variation: VariationDTO): boolean {
  return !containsRevisedLine(variation);
}

/**
 * 得意先改訂の改訂元にできるバリか判定する（C7・UI 抑止・二重防御の外側）。
 *
 * 条件はドメイン `Estimate.reviseForCustomer` の 2 ガード「納品先宛(DELIVERY_LOCATION)」かつ
 * 「有効(ACTIVE)」の写しのみ。ドメインは「既に改訂元か（凍結済みか）」を改訂禁止条件にしていない
 * （再改訂を許す）ため、UI ゲートも凍結判定を持たない。同一納品先ベースから複数の得意先向け提案を
 * 作るのは自然な操作で、改訂は改訂元を変更しない。最終強制はドメインが担う。
 */
export function isVariationRevisableForCustomer(variation: VariationDTO): boolean {
  return variation.submissionType === "DELIVERY_LOCATION" && variation.status === "ACTIVE";
}
