import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 掛率（明細レベルの割引率）値オブジェクト。
 *
 * DB スキーマの `discount_rate Decimal(5,4)`（デフォルト 1.0 = 値引なし）と整合。
 * 0 より大きく、小数点以下4桁まで。例: 0.95（5%引き）、1.0（値引なし）。
 *
 * Money への乗算は浮動小数点誤差を避けるため整数演算で行う。そのため
 * 分子（value を 10^SCALE 倍した整数）を {@link numerator} として公開する。
 */
export class DiscountRate extends ValueObject<number, "DiscountRate"> {
  /** 小数点以下の桁数（Decimal(5,4) の 4）。 */
  static readonly SCALE = 4;
  /** Decimal(5,4) の最大値（整数部1桁＋小数4桁）。 */
  private static readonly MAX = 9.9999;

  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  /** value を 10^SCALE 倍した整数。例: 0.95 → 9500。Money.applyRate に渡す。 */
  get numerator(): number {
    return Math.round(this._value * 10 ** DiscountRate.SCALE);
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError("掛率は有効な数値で指定してください");
    }
    if (value <= 0) {
      throw new ValidationError("掛率は0より大きい値で指定してください");
    }
    if (value > DiscountRate.MAX) {
      throw new ValidationError(`掛率は${DiscountRate.MAX}以下で指定してください`);
    }
    const decimalPart = value.toString().split(".")[1];
    if (decimalPart && decimalPart.length > DiscountRate.SCALE) {
      throw new ValidationError(`掛率は小数点以下${DiscountRate.SCALE}桁までで指定してください`);
    }
  }
}
