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

  /**
   * {@link Money} から生成する。負の金額は許容しない。
   *
   * 生成口は `Money` 引数のみとする。number↔金額の変換と精度ガードは `Money`
   * （`fromMajorUnits`/`fromDecimalString`）へ集約し、価格 VO は受け取った `Money` に
   * 「非負」不変条件だけを課す（number ドアを VO 層で二重に開けない）。
   */
  static fromMoney(amount: Money): SellingUnitPrice {
    if (amount.isNegative()) {
      throw new ValidationError("共通販売単価は0以上で指定してください");
    }
    return new SellingUnitPrice(amount);
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
