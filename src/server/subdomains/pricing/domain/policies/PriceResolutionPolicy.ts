import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import type { SellingUnitPrice } from "../values/SellingUnitPrice";

/** 価格決定における提出区分（宛先）。estimate の SubmissionType に依存せず pricing が自前で持つ（ADR-20260626-p3w）。 */
export type ResolutionAddressee = "CUSTOMER" | "DELIVERY_LOCATION";

/** {@link PriceResolutionPolicy.resolve} の入力。各層の時点解決結果（候補単価）＋メッセージ用コンテキスト。 */
export type PriceResolutionInput = {
  /** 提出区分に応じた上書き層（得意先別 or 納品先別）の時点解決結果。該当なしは null。 */
  override: SellingUnitPrice | null;
  /** 共通層の時点解決結果。該当なしは null。 */
  common: SellingUnitPrice | null;
  /** 解決対象の商品ID。解決不能メッセージのコンテキストに用いる。 */
  productId: string;
  /** 提出区分（宛先）。解決不能メッセージのコンテキストに用いる。 */
  addressee: ResolutionAddressee;
};

/**
 * 価格決定ポリシー（2段解決・純）。
 *
 * 提出区分が選んだ上書き層（得意先別 or 納品先別）を優先し、無ければ共通へフォールバックする。
 * クロス参照はしない（上書き層の選択は上流＝オーケストレーションの責務・ADR-20260624-8tg）。
 */
export class PriceResolutionPolicy {
  private constructor() {}

  static resolve(input: PriceResolutionInput): SellingUnitPrice {
    const resolved = input.override ?? input.common;
    if (resolved === null) {
      const addresseeLabel = input.addressee === "CUSTOMER" ? "得意先宛" : "納品先宛";
      throw new BusinessRuleViolationError(
        `有効な販売単価が見つかりません（商品ID: ${input.productId} / 提出区分: ${addresseeLabel}）`
      );
    }
    return resolved;
  }
}
