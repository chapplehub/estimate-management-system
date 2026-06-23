import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { Currency } from "./Currency";

/**
 * 金額を表す値オブジェクト（Money パターン）。
 *
 * 内部表現は「整数の最小単位」（JPY なら銭 = 1/100 円）。
 * 浮動小数点誤差を避けるため、金額は常に整数で保持し、比率の乗算も
 * 可能な限り整数演算で行う（{@link applyRate} 参照）。ドメイン層は外部ライブラリ
 * （decimal.js 等）に依存できないため、この方針を採用している。
 *
 * 通貨をペアで保持し、異種通貨の演算・比較を実行時に禁止する。
 */
export class Money {
  private constructor(
    private readonly _minorUnits: number,
    private readonly _currency: Currency
  ) {}

  /**
   * 最小単位（銭）の整数から生成する。永続化からの復元・厳密な生成に使う。
   */
  static fromMinorUnits(minorUnits: number, currency: Currency = Currency.JPY): Money {
    if (!Number.isInteger(minorUnits)) {
      throw new InvalidArgumentError("金額（最小単位）は整数である必要があります");
    }
    return new Money(minorUnits, currency);
  }

  /**
   * 主単位（円）から生成する。通貨のスケールを超える精度（JPY なら小数3桁以上）は許可しない。
   */
  static fromMajorUnits(amount: number, currency: Currency = Currency.JPY): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidArgumentError("金額は有限の数値である必要があります");
    }
    const minorUnits = amount * currency.minorUnitsPerMajorUnit;
    const rounded = Math.round(minorUnits);
    // 丸め誤差を許容しつつ、スケールを超える精度の入力は弾く
    if (Math.abs(minorUnits - rounded) > 1e-6) {
      throw new InvalidArgumentError(
        `金額は${currency.code}の最小単位（小数${currency.minorUnitScale}桁）以下の精度では指定できません`
      );
    }
    return new Money(rounded, currency);
  }

  static zero(currency: Currency = Currency.JPY): Money {
    return new Money(0, currency);
  }

  /** 最小単位（銭）での金額。 */
  get minorUnits(): number {
    return this._minorUnits;
  }

  /** 主単位（円）での金額。小数を含みうる。 */
  get majorUnits(): number {
    return this._minorUnits / this._currency.minorUnitsPerMajorUnit;
  }

  get currency(): Currency {
    return this._currency;
  }

  isNegative(): boolean {
    return this._minorUnits < 0;
  }

  isZero(): boolean {
    return this._minorUnits === 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._minorUnits + other._minorUnits, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._minorUnits - other._minorUnits, this._currency);
  }

  /**
   * 整数倍する（数量との乗算など）。誤差は発生しない。
   */
  times(multiplier: number): Money {
    if (!Number.isInteger(multiplier)) {
      throw new InvalidArgumentError("Money.times の乗数は整数である必要があります");
    }
    return new Money(this._minorUnits * multiplier, this._currency);
  }

  /**
   * 比率 `numerator / 10^scale` を掛ける（比率の適用）。
   *
   * 整数演算 `minorUnits * numerator` を先に行い、最後に除算してから最小単位へ
   * 切り捨てる（端数は最小単位＝銭で切り捨て、ゼロ方向）。これにより浮動小数点誤差を最小化する。
   * さらに「円未満切捨」が必要な場合は呼び出し側で {@link truncateToMajorUnit} を続けて適用する。
   *
   * @param numerator 比率の分子（例: 0.95 → 9500）。
   * @param scale 比率の小数桁数（例: 小数4桁なら 4）。
   */
  applyRate(numerator: number, scale: number): Money {
    if (!Number.isInteger(numerator) || numerator < 0) {
      throw new InvalidArgumentError("比率の分子は0以上の整数である必要があります");
    }
    if (!Number.isInteger(scale) || scale < 0) {
      throw new InvalidArgumentError("比率のスケールは0以上の整数である必要があります");
    }
    const denominator = 10 ** scale;
    const result = Math.trunc((this._minorUnits * numerator) / denominator);
    return new Money(result, this._currency);
  }

  /**
   * 主単位（円）未満を切り捨てる（ゼロ方向）。
   */
  truncateToMajorUnit(): Money {
    const per = this._currency.minorUnitsPerMajorUnit;
    return new Money(Math.trunc(this._minorUnits / per) * per, this._currency);
  }

  /**
   * 主単位（円）未満を切り上げる（正方向）。消費税の端数処理 ROUND_UP 用。
   */
  ceilToMajorUnit(): Money {
    const per = this._currency.minorUnitsPerMajorUnit;
    return new Money(Math.ceil(this._minorUnits / per) * per, this._currency);
  }

  /**
   * 主単位（円）未満を四捨五入する。消費税の端数処理 ROUND 用。
   */
  roundToMajorUnit(): Money {
    const per = this._currency.minorUnitsPerMajorUnit;
    return new Money(Math.round(this._minorUnits / per) * per, this._currency);
  }

  equals(other: Money): boolean {
    return this._currency.equals(other._currency) && this._minorUnits === other._minorUnits;
  }

  /**
   * 大小を比較する。`this` が小さければ負、等しければ 0、大きければ正を返す。
   * 異種通貨の比較は実行時に禁止する（ADR-0022）。
   */
  compareTo(other: Money): number {
    this.assertComparableCurrency(other);
    return Math.sign(this._minorUnits - other._minorUnits);
  }

  /** `this > other` か。 */
  isGreaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  /** `this >= other` か（以上）。 */
  isAtLeast(other: Money): boolean {
    return this.compareTo(other) >= 0;
  }

  /** `this < other` か。 */
  isLessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  /** `this <= other` か（以下）。 */
  isAtMost(other: Money): boolean {
    return this.compareTo(other) <= 0;
  }

  toString(): string {
    return `${this.majorUnits} ${this._currency.code}`;
  }

  private assertSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new InvalidArgumentError(
        `異なる通貨同士は演算できません（${this._currency.code} と ${other._currency.code}）`
      );
    }
  }

  private assertComparableCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new InvalidArgumentError(
        `異なる通貨同士は比較できません（${this._currency.code} と ${other._currency.code}）`
      );
    }
  }
}
