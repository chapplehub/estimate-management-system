import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";
import type { Money } from "@server/shared/domain/values/Money";

const VALID_VALUES = ["ROUND_DOWN", "ROUND_UP", "ROUND"] as const;
type TaxRoundingTypeValue = (typeof VALID_VALUES)[number];

/**
 * 消費税の端数処理区分値オブジェクト（§8.3）。
 *
 * ROUND_DOWN: 切捨
 * ROUND_UP:   切上
 * ROUND:      四捨五入
 *
 * 消費税額（円未満の端数を含みうる Money）を、区分に応じて円単位へ丸める責務を持つ。
 */
export class TaxRoundingType extends ValueObject<string, "TaxRoundingType"> {
  static readonly ROUND_DOWN = new TaxRoundingType("ROUND_DOWN");
  static readonly ROUND_UP = new TaxRoundingType("ROUND_UP");
  static readonly ROUND = new TaxRoundingType("ROUND");

  private constructor(value: string) {
    super(value);
  }

  get value(): string {
    return this._value;
  }

  static from(value: string): TaxRoundingType {
    switch (value) {
      case "ROUND_DOWN":
        return TaxRoundingType.ROUND_DOWN;
      case "ROUND_UP":
        return TaxRoundingType.ROUND_UP;
      case "ROUND":
        return TaxRoundingType.ROUND;
      default:
        throw new ValidationError(
          `不正な端数処理区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }

  protected validate(value: string): void {
    if (!VALID_VALUES.includes(value as TaxRoundingTypeValue)) {
      throw new ValidationError(
        `不正な端数処理区分です: ${value}（有効値: ${VALID_VALUES.join(", ")}）`
      );
    }
  }

  /**
   * 税額（円未満の端数を含みうる Money）を、この区分に従って円単位へ丸める。
   *
   * TODO(あなたへ): この本体を実装してください（5〜8行程度）。
   *
   * Money は丸めプリミティブを3つ提供しています:
   *   - money.truncateToMajorUnit()  … 円未満を切り捨て（ゼロ方向）
   *   - money.ceilToMajorUnit()      … 円未満を切り上げ（正方向）
   *   - money.roundToMajorUnit()     … 円未満を四捨五入
   *
   * この3区分（ROUND_DOWN / ROUND_UP / ROUND）を上記メソッドへ振り分けてください。
   * 設計上の論点:
   *   - 全区分を明示的に網羅し、想定外の値には例外を投げるか（防御的）、
   *     それとも switch の default は from() で弾いている前提で省くか。
   *   - this._value で分岐するか、ProductCategory のように区分ごとの判定メソッドを足すか。
   */
  applyTo(taxAmount: Money): Money {
    switch (this._value) {
      case "ROUND_DOWN":
        return taxAmount.truncateToMajorUnit();
      case "ROUND_UP":
        return taxAmount.ceilToMajorUnit();
      case "ROUND":
        return taxAmount.roundToMajorUnit();
      default:
        throw new ValidationError(
          `不正な端数処理区分です: ${this._value}（有効値: ${VALID_VALUES.join(", ")}）`
        );
    }
  }
}
