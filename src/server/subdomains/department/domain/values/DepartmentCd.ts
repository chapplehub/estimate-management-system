import { ValidationError } from "@server/shared/errors/DomainError";
import { StringValueObject } from "@server/shared/StringValueObject";

/**
 * 部署コード値オブジェクト
 *
 * 形式: DEPT + 3桁の数字（DEPT001 〜 DEPT999）
 */
export class DepartmentCd extends StringValueObject<"DepartmentCd"> {
  private static readonly PREFIX = "DEPT";
  private static readonly NUMERIC_LENGTH = 3;
  private static readonly TOTAL_LENGTH = 7; // "DEPT" + 3桁 = 7文字
  private static readonly NUMERIC_MIN = 1;
  private static readonly NUMERIC_MAX = Math.pow(10, DepartmentCd.NUMERIC_LENGTH) - 1;

  protected static readonly REGEX = new RegExp(
    `^${DepartmentCd.PREFIX}\\d{${DepartmentCd.NUMERIC_LENGTH}}$`,
    "i"
  );
  protected static readonly MIN_LENGTH = DepartmentCd.TOTAL_LENGTH;
  protected static readonly MAX_LENGTH = DepartmentCd.TOTAL_LENGTH;
  protected static readonly ERROR_MESSAGE_EMPTY = "部署コードは必須です";
  protected static readonly ERROR_MESSAGE_TOO_SHORT =
    "部署コードは DEPT + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_TOO_LONG =
    "部署コードは DEPT + 3桁の数字である必要があります";
  protected static readonly ERROR_MESSAGE_INVALID_FORMAT =
    "部署コードは DEPT + 3桁の数字である必要があります";

  constructor(value: string) {
    super(value.toUpperCase().trim());
  }

  get numericPart(): number {
    return DepartmentCd.extractNumericPart(this._value);
  }

  protected validate(value: string): void {
    // 基本的な長さチェックと正規表現チェックは親クラスで実行
    super.validate(value);

    // 数値部分の範囲チェック（DEPT000を弾くため）
    const numericPart = DepartmentCd.extractNumericPart(value);
    if (numericPart < DepartmentCd.NUMERIC_MIN) {
      throw new ValidationError(
        `部署コードは ${DepartmentCd.NUMERIC_MIN} 以上である必要があります`
      );
    }
    if (numericPart > DepartmentCd.NUMERIC_MAX) {
      throw new ValidationError(
        `部署コードは ${DepartmentCd.NUMERIC_MAX} 以下である必要があります`
      );
    }
  }

  /**
   * 文字列から数値部分を抽出（内部用ヘルパー）
   * @param value 部署コード文字列（例: "DEPT001"）
   * @returns 数値部分（例: 1）
   */
  private static extractNumericPart(value: string): number {
    return parseInt(value.substring(DepartmentCd.PREFIX.length), 10);
  }

  /**
   * 数値から部署コードを生成（ユーティリティメソッド）
   */
  static fromNumber(num: number): DepartmentCd {
    if (num < DepartmentCd.NUMERIC_MIN || num > DepartmentCd.NUMERIC_MAX) {
      throw new ValidationError(
        `部署コードは ${DepartmentCd.NUMERIC_MIN} 〜 ${DepartmentCd.NUMERIC_MAX} の範囲である必要があります`
      );
    }

    const paddedNumber = num.toString().padStart(DepartmentCd.NUMERIC_LENGTH, "0");
    return new DepartmentCd(`${DepartmentCd.PREFIX}${paddedNumber}`);
  }
}
