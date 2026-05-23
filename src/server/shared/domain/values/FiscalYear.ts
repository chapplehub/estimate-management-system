import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 年度（4月始まり）を表す値オブジェクト。
 *
 * 内部値は西暦4桁数値（例: 2025）。`toShortString()` で下2桁文字列（"25"）を返し、
 * 見積番号 §2 の年度部および将来の年度横断機能（税率マスタ・締切管理等）で共有する。
 *
 * `from(date)` は JST 基準で年度を導出する。ドメイン層は外部依存禁止のため、
 * Date オブジェクトの UTC ミリ秒に +9h オフセットを加えた純関数として実装する
 * （実行環境TZや `process.env.TZ` に依存しない）。
 */
export class FiscalYear extends ValueObject<number, "FiscalYear"> {
  /** 年度開始月（4月始まり）。 */
  static readonly FISCAL_START_MONTH = 4;

  private static readonly MIN_YEAR = 1900;
  private static readonly MAX_YEAR = 2999;
  private static readonly JST_OFFSET_MS = 9 * 60 * 60 * 1000;

  constructor(value: number) {
    super(value);
  }

  get value(): number {
    return this._value;
  }

  /** 下2桁ゼロ詰め（例: 2025 → "25"、2007 → "07"、2100 → "00"）。 */
  toShortString(): string {
    return String(this._value % 100).padStart(2, "0");
  }

  /**
   * 任意の Date から JST 基準で年度を導出する。
   *
   * 例: 2025-03-31 23:59 JST → 2024 年度 / 2025-04-01 00:00 JST → 2025 年度。
   */
  static from(date: Date): FiscalYear {
    const jstDate = new Date(date.getTime() + FiscalYear.JST_OFFSET_MS);
    const month = jstDate.getUTCMonth() + 1;
    const year = jstDate.getUTCFullYear();
    const fiscalYear = month < FiscalYear.FISCAL_START_MONTH ? year - 1 : year;
    return new FiscalYear(fiscalYear);
  }

  protected validate(value: number): void {
    if (!Number.isInteger(value)) {
      throw new ValidationError(`年度は整数である必要があります: ${value}`);
    }
    if (value < FiscalYear.MIN_YEAR || value > FiscalYear.MAX_YEAR) {
      throw new ValidationError(
        `年度は${FiscalYear.MIN_YEAR}〜${FiscalYear.MAX_YEAR}の範囲である必要があります: ${value}`
      );
    }
  }
}
