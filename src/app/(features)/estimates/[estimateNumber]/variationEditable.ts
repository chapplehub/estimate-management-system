import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";

/**
 * 編集可能なバリか判定する（UI 抑止・二重防御の外側）。
 *
 * 条件は「改訂に関与しない(revisionRole=NONE)」かつ「有効(ACTIVE)」こと。改訂元
 * (REVISION_SOURCE)は凍結されメモ以外編集不可（メモは別経路の「メモを編集」で扱う・
 * ADR-0059）、改訂先(REVISION_TARGET)は行構成固定で粒度別編集は #390 に委ねるため、
 * いずれも本ボタンの対象外。従来の改訂明細(revisedDeliveryPrice)走査は改訂元の凍結を
 * 検知できず無効な「内容を編集」を出していた（本 issue のバグ）ため revisionRole に置換した。
 * 最終強制はドメイン（editableVariationOrThrow）が担う（二重防御）。
 */
export function isVariationEditable(variation: VariationDTO): boolean {
  return variation.revisionRole === "NONE" && variation.status === "ACTIVE";
}

/**
 * 複製元にできるバリか判定する（C3・UI 抑止）。
 *
 * 条件は「改訂先(REVISION_TARGET)でない」ことのみ（バリエーション状態は問わない）。改訂先の
 * 改訂スナップショット（deliveryPrice）は改訂系譜と不可分の凍結状態で、系譜なしの新バリへ
 * 持ち越すと整合が壊れるため複製元から除く。改訂元(REVISION_SOURCE)・通常(NONE)は素の土台
 * として複製でき、無効(INACTIVE)バリも複製元にできる（複製は複製元を変更しない読み取り操作）。
 * 編集可否(isVariationEditable)と違い ACTIVE は要求しない。
 */
export function isVariationDuplicatable(variation: VariationDTO): boolean {
  return variation.revisionRole !== "REVISION_TARGET";
}

/**
 * 得意先改訂の改訂元にできるバリか判定する（C7・UI 抑止・二重防御の外側）。
 *
 * 条件はドメイン `Estimate.reviseForCustomer` の 2 ガード「納品先宛(DELIVERY_LOCATION)」かつ
 * 「有効(ACTIVE)」の写しのみ。ドメインは「既に改訂元か（凍結済みか）」を改訂禁止条件にしていない
 * （再改訂を許す）ため、UI ゲートも revisionRole を見ない。同一納品先ベースから複数の得意先向け
 * 提案を作るのは自然な操作で、改訂は改訂元を変更しない。最終強制はドメインが担う。
 */
export function isVariationRevisableForCustomer(variation: VariationDTO): boolean {
  return variation.submissionType === "DELIVERY_LOCATION" && variation.status === "ACTIVE";
}
