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

/** {@link PriceResolutionPolicy.tryResolve} の入力。候補単価のみで足り、メッセージ用コンテキストは持たない。 */
export type PriceResolutionCandidates = {
  /** 提出区分に応じた上書き層（得意先別 or 納品先別）の時点解決結果。該当なしは null。 */
  override: SellingUnitPrice | null;
  /** 共通層の時点解決結果。該当なしは null。 */
  common: SellingUnitPrice | null;
};

/**
 * {@link PriceResolutionPolicy.tryResolve} の結果。
 *
 * 読み取り契機（単価乖離・解決不能の可視化）では「解決できたか否か」を throw ではなく値で返す。
 * `resolve` の throw 経路（書き込み契機の拒否）とは別経路で、解決不能を CONTEXT の独立状態として運ぶ
 * （失効/未設定 3状態クエリ #487 と同構図）。
 */
export type PriceResolutionOutcome =
  | { kind: "RESOLVED"; unitPrice: SellingUnitPrice }
  | { kind: "UNRESOLVABLE" };

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

  /**
   * 非 throw 版の2段解決（読み取り契機・単価乖離/解決不能の可視化用）。
   *
   * `resolve` と同じ `override ?? common` の先勝ちだが、両方 null でも throw せず `UNRESOLVABLE` を返す。
   * 表示のたびに解決を再実行する派生状態（ADR-20260710-fg7）の判定土台で、書き込み契機の拒否には使わない。
   */
  static tryResolve(input: PriceResolutionCandidates): PriceResolutionOutcome {
    const resolved = input.override ?? input.common;
    if (resolved === null) {
      return { kind: "UNRESOLVABLE" };
    }
    return { kind: "RESOLVED", unitPrice: resolved };
  }
}
