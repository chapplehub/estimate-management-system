import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

/**
 * 構成明細 1 件分の商品事実（ADR-0052）。
 *
 * アプリ層が `ProductQueryService` でライブ取得（作成中は read-through・ADR-0048）して渡す。
 * estimate ドメインは Product 集約（`ProductCategory`）に依存しない（ADR-0047 の集約境界）ため、
 * 区分は VO ではなく**文字列**で受け取り、許可値と照合する。
 */
export type SetComponentFact = {
  /** 構成明細の商品 id（警告の特定・表示用）。 */
  productId: string;
  /** 商品名（警告表示用、任意）。 */
  itemName?: string;
  /** 商品区分の文字列値（"INDIVIDUAL" | "CONSUMABLE" | "SET" 等）。 */
  category: string;
  /** 有効フラグ。false は非ブロッキング警告。 */
  isActive: boolean;
};

/** 無効構成商品の警告（非ブロッキング）。 */
export type SetComponentWarning = {
  productId: string;
  itemName?: string;
  reason: "INACTIVE";
};

/**
 * セット構成の集約越え検証（ADR-0052 / ADR-0030 メソッド引数方式）。
 *
 * `Estimate` 集約が単独で判定できない「構成商品の区分・有効性」を、アプリ層が集めた
 * 商品事実（{@link SetComponentFact}）に対して純粋に判定する。ドメインポートは新設せず
 * （集約越えポートの前例なし・ADR-0052）、事実は引数で受け取るのみ。
 *
 * - **区分はハードエラー**: 構成商品は個別商品・消耗品のみ。セット商品（ネスト）や未知区分は throw。
 * - **無効構成は非ブロッキング警告**: 追加・保存は許し、warning として集約して返す。
 *
 * 集約内で完結する構造的不変条件（参照整合・排他所属・空群禁止）は `EstimateVariation` /
 * `EstimateSetGroup` 側が担保する。本ルールは集約越えの事実検証だけを担う。
 *
 * 呼び出し側は**構成明細の事実のみ**を渡す（セット群本体の商品は区分 SET であり、本ルールの
 * 許可区分検証の対象外）。
 */
export class SetComponentRule {
  /** 構成商品として許可される区分（個別商品・消耗品）。セット商品はネスト禁止で許可外。 */
  private static readonly ALLOWED_CATEGORIES: ReadonlySet<string> = new Set([
    "INDIVIDUAL",
    "CONSUMABLE",
  ]);

  /**
   * 構成明細の商品事実を検証する。区分が許可外（SET・未知含む）は即 throw。
   * 区分が通った構成のうち無効（`isActive === false`）なものを warning として集約して返す。
   *
   * 区分違反は無効警告より優先する（不正構造は保存させない）。
   */
  static validate(facts: ReadonlyArray<SetComponentFact>): SetComponentWarning[] {
    const warnings: SetComponentWarning[] = [];
    for (const fact of facts) {
      if (!SetComponentRule.ALLOWED_CATEGORIES.has(fact.category)) {
        throw new BusinessRuleViolationError(
          `セット構成に指定できない商品区分です: ${fact.category}` +
            `（構成商品は個別商品・消耗品のみ。セット商品のネストは不可）`
        );
      }
      if (!fact.isActive) {
        warnings.push({
          productId: fact.productId,
          itemName: fact.itemName,
          reason: "INACTIVE",
        });
      }
    }
    return warnings;
  }
}
