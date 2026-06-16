import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";

/**
 * 編集可能なバリか判定する（UI 抑止・二重防御の外側）。
 *
 * 条件は「有効（ACTIVE）」かつ「改訂明細を含まない」こと。改訂明細は
 * revisedDeliveryPrice を持つ通常明細（§8.4）で、セット群の構成明細としても現れ得るため
 * 構成内まで走査する。セット群そのものは S5・C4 で全置換できるようになったため編集を妨げない。
 * 最終強制はドメイン（replaceContent）が担う（ADR-0047）。
 */
export function isVariationEditable(variation: VariationDTO): boolean {
  if (variation.status !== "ACTIVE") return false;
  return variation.lines.every((node) =>
    node.kind === "setGroup"
      ? node.components.every((c) => c.revisedDeliveryPrice === null)
      : node.revisedDeliveryPrice === null
  );
}
