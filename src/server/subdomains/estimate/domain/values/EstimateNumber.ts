import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";
import { EstimateType } from "./EstimateType";

type EstimateNumberPrefix = "N" | "R" | "A";

/**
 * 見積番号の値オブジェクト（§2 見積番号の採番ルール）。
 *
 * 形式: `[接頭辞1文字][年度2桁][連番5桁]` = 計 8 文字（例: `N2500001`）。
 *
 * 公開ファクトリは `parse(text)` のみ。連番の払い出し（次番号生成）は
 * `fiscalYear + estimateType` 単位の横断ポリシーとしてリポジトリ層の責務であり、
 * 本 VO は「保存済み採番値の検証・分解」に責務を限定する。
 *
 * 年度 2 桁→4 桁の復元は `2000 + YY` 固定。Prisma `VarChar(8)` + 2 桁年度は
 * 構造的に 100 年（2000〜2099）が上限であり、現在日時依存のスライディングは
 * 過去レコードの復元が時刻に依存するため不採用。
 */
export class EstimateNumber extends ValueObject<string, "EstimateNumber"> {
  static readonly LENGTH = 8;
  static readonly SEQUENCE_MIN = 1;
  static readonly SEQUENCE_MAX = 99999;
  static readonly PATTERN = /^[NRA]\d{7}$/;
  private static readonly CENTURY_BASE = 2000;

  private readonly _prefix: EstimateNumberPrefix;
  private readonly _estimateType: EstimateType;
  private readonly _fiscalYear: FiscalYear;
  private readonly _sequence: number;

  private constructor(value: string) {
    super(value);
    // super で validate を通過済みのため、以下の分解は安全に行える
    this._prefix = value[0] as EstimateNumberPrefix;
    this._estimateType = EstimateType.fromPrefix(this._prefix);
    const yearShort = Number.parseInt(value.substring(1, 3), 10);
    this._fiscalYear = new FiscalYear(EstimateNumber.CENTURY_BASE + yearShort);
    this._sequence = Number.parseInt(value.substring(3), 10);
  }

  /** 唯一の公開ファクトリ。永続化値の検証・分解に使用する。 */
  static parse(text: string): EstimateNumber {
    return new EstimateNumber(text);
  }

  get value(): string {
    return this._value;
  }

  get prefix(): EstimateNumberPrefix {
    return this._prefix;
  }

  get estimateType(): EstimateType {
    return this._estimateType;
  }

  get fiscalYear(): FiscalYear {
    return this._fiscalYear;
  }

  /** 連番（1〜99999、先頭ゼロを除去した整数）。 */
  get sequence(): number {
    return this._sequence;
  }

  protected validate(value: string): void {
    if (value.length !== EstimateNumber.LENGTH) {
      throw new ValidationError(
        `見積番号は${EstimateNumber.LENGTH}文字である必要があります: ${value}`
      );
    }
    if (!EstimateNumber.PATTERN.test(value)) {
      throw new ValidationError(`見積番号の形式が正しくありません: ${value}`);
    }
    const sequence = Number.parseInt(value.substring(3), 10);
    if (sequence < EstimateNumber.SEQUENCE_MIN) {
      throw new ValidationError(
        `見積番号の連番は${EstimateNumber.SEQUENCE_MIN}以上である必要があります: ${value}`
      );
    }
  }
}
