import { Money } from "@server/shared/domain/values/Money";
import { ValidationError } from "@server/shared/errors/DomainError";

/**
 * 共通販売単価の単価を表す値オブジェクト。
 *
 * 金額は {@link Money}（JPY・最小単位整数）で保持し、浮動小数点誤差を避ける（ADR-0022）。
 * 非負の不変条件を持つ。
 */
export class SellingUnitPrice {
  private constructor(private readonly _amount: Money) {}

  /** {@link Money} から生成する。負の金額は許容しない。 */
  static fromMoney(amount: Money): SellingUnitPrice {
    if (amount.isNegative()) {
      throw new ValidationError("共通販売単価は0以上で指定してください");
    }
    return new SellingUnitPrice(amount);
  }

  /** 主単位（円）から生成する。 */
  static fromMajorUnits(amount: number): SellingUnitPrice {
    return SellingUnitPrice.fromMoney(Money.fromMajorUnits(amount));
  }

  /** 金額（{@link Money}）。 */
  get money(): Money {
    return this._amount;
  }

  /** 主単位（円）での金額。 */
  get majorUnits(): number {
    return this._amount.majorUnits;
  }

  equals(other: SellingUnitPrice): boolean {
    return this._amount.equals(other._amount);
  }
}
