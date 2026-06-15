import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Money } from "../values/Money";

/**
 * 導出に必要な構成明細の射影。EstimateItem はこの構造に適合する（finalAmount / sortOrder
 * ゲッターを持つ）ため、Policy は EstimateItem に依存せず純粋に保てる。
 */
export type SetGroupMember = {
  finalAmount: Money;
  sortOrder: number;
};

/** セット群の導出値（非永続・読み取り専用）。 */
export type SetGroupDerivation = {
  /** 金額 = 構成明細 finalAmount の合計。 */
  amount: Money;
  /** 表示位置 = 構成明細 sortOrder の最小値。 */
  sortOrder: number;
};

/**
 * セット群の金額・表示位置の導出ポリシー（ADR-0047 / ADR-0023）。
 *
 * セット群は価格・並び順・金額を**持たない**（薄い衛星）。金額は構成明細の finalAmount 合計、
 * 表示位置は構成明細の最小 sortOrder から**導出**する。導出値は永続化せず読み取り専用とする
 * （ADR-0033 と両立: 永続化する派生列はゼロ）。
 *
 * `LineItemAmountPolicy` / `EstimateAmountPolicy` と同じ Policy パターン。EstimateVariation が
 * 構成明細 id を実体へ解決して本ポリシーに渡す。
 */
export class SetGroupDerivationPolicy {
  private constructor() {}

  static derive(members: ReadonlyArray<SetGroupMember>): SetGroupDerivation {
    if (members.length === 0) {
      throw new BusinessRuleViolationError("構成明細が空のセット群は導出できません（空群禁止）");
    }
    const amount = members.reduce((acc, m) => acc.add(m.finalAmount), Money.zero());
    const sortOrder = Math.min(...members.map((m) => m.sortOrder));
    return { amount, sortOrder };
  }
}
