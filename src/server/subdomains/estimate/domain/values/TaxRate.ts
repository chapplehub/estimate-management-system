import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 消費税率値オブジェクト。
 *
 * DB スキーマの `tax_rate Decimal(4,3)` と整合。0以上、小数点以下3桁まで。
 * 例: 0.08（8%）、0.1（10%）。
 *
 * 設計判断: 税率マスタ（TaxRate エンティティ・着手順序 item 12）とは別に、見積が保持する
 * 税率スナップショット（Estimate.tax_rate）や §8 の金額計算で使う「税率という値」を表す
 * 値オブジェクトとして estimate サブドメインに置く。マスタ実装時に共有方針を再検討する。
 *
 * Money への乗算は整数演算で行うため、分子（value を 10^SCALE 倍した整数）を
 * {@link numerator} として公開する。
 */
export class TaxRate extends ValueObject<number, "TaxRate"> {
  /** 小数点以下の桁数（Decimal(4,3) の 3）。 */
  static readonly SCALE = 3;
  /** Decimal(4,3) の最大値（整数部1桁＋小数3桁）。 */
  private static readonly MAX = 9.999;

  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  /** value を 10^SCALE 倍した整数。例: 0.1 → 100。Money.applyRate に渡す。 */
  get numerator(): number {
    return Math.round(this._value * 10 ** TaxRate.SCALE);
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError("消費税率は有効な数値で指定してください");
    }
    if (value < 0) {
      throw new ValidationError("消費税率は0以上で指定してください");
    }
    if (value > TaxRate.MAX) {
      throw new ValidationError(`消費税率は${TaxRate.MAX}以下で指定してください`);
    }
    const decimalPart = value.toString().split(".")[1];
    if (decimalPart && decimalPart.length > TaxRate.SCALE) {
      throw new ValidationError(`消費税率は小数点以下${TaxRate.SCALE}桁までで指定してください`);
    }
  }
}
