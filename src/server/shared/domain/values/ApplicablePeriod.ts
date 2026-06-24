import { ValidationError } from "@server/shared/errors/DomainError";

/**
 * 適用期間を表す値オブジェクト（半開区間 `[開始, 終了)`）。
 *
 * 開始日を含み、終了日を含まない。上端は無期限（`end = null`）を表現でき、
 * `9999-12-31` のような番兵値も NULL も使わない（ADR-0067）。
 *
 * 境界は ISO-8601 の日付文字列 `"YYYY-MM-DD"` で保持する。ISO 日付は
 * 辞書順と日付順が一致するため、半開区間の判定を単純な文字列比較で行え、
 * TZ・時刻を境界判定に持ち込まない。PostgreSQL の `daterange`（`[2025-07-01,)`）
 * とも 1:1 で対応する。
 */
export class ApplicablePeriod {
  private static readonly ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  private constructor(
    private readonly _start: string,
    private readonly _end: string | null
  ) {}

  static create(params: { start: string; end: string | null }): ApplicablePeriod {
    ApplicablePeriod.assertIsoDate(params.start, "適用開始日");
    if (params.end !== null) {
      ApplicablePeriod.assertIsoDate(params.end, "適用終了日");
      if (params.start >= params.end) {
        throw new ValidationError(
          `適用開始日は適用終了日より前である必要があります: ${params.start} >= ${params.end}`
        );
      }
    }
    return new ApplicablePeriod(params.start, params.end);
  }

  /** `"YYYY-MM-DD"` 形式かつ暦上実在する日付であることを検証する（UTC で round-trip 確認）。 */
  private static assertIsoDate(value: string, label: string): void {
    const matched = ApplicablePeriod.ISO_DATE.exec(value);
    if (matched === null) {
      throw new ValidationError(`${label}は YYYY-MM-DD 形式である必要があります: ${value}`);
    }
    const [, year, month, day] = matched;
    const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const roundTrip =
      utc.getUTCFullYear() === Number(year) &&
      utc.getUTCMonth() === Number(month) - 1 &&
      utc.getUTCDate() === Number(day);
    if (!roundTrip) {
      throw new ValidationError(`${label}は実在する日付である必要があります: ${value}`);
    }
  }

  /** 適用開始日（`"YYYY-MM-DD"`・下端は閉）。 */
  get start(): string {
    return this._start;
  }

  /** 適用終了日（`"YYYY-MM-DD"`・上端は開）。無期限なら `null`。 */
  get end(): string | null {
    return this._end;
  }

  /** 開始日・終了日がともに等しいか（無期限と有界を区別する）。 */
  equals(other: ApplicablePeriod): boolean {
    return this._start === other._start && this._end === other._end;
  }

  /** 指定日（`"YYYY-MM-DD"`）が区間に含まれるか（`開始 <= date < 終了`）。 */
  contains(date: string): boolean {
    if (date < this._start) {
      return false;
    }
    if (this._end !== null && date >= this._end) {
      return false;
    }
    return true;
  }

  /**
   * 他の区間と重なるか。半開区間 `[開始, 終了)` のため端点の共有は重なりとしない
   * （隣接区間 `[..,08-01)` と `[08-01,..)` は重ならない）。`end = null` は上端無限大とみなす。
   */
  overlaps(other: ApplicablePeriod): boolean {
    return (
      ApplicablePeriod.startBeforeEnd(this._start, other._end) &&
      ApplicablePeriod.startBeforeEnd(other._start, this._end)
    );
  }

  /** `start < end` を判定する。`end = null`（無期限上端）は常に true。 */
  private static startBeforeEnd(start: string, end: string | null): boolean {
    return end === null || start < end;
  }
}
