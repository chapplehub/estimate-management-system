import { InvalidArgumentError } from "@server/shared/errors/DomainError";

/**
 * 通貨を表す値オブジェクト（Money パターンの通貨単位）。
 *
 * 通貨ごとに「最小単位のスケール（主単位を小数何桁まで分割するか）」を持つ。
 * Money はこのスケールを参照して、内部表現（整数の最小単位）と主単位（円）を相互変換する。
 *
 * 設計判断: 本システムの JPY は scale=2（銭精度）で定義する。
 * ISO 4217 では JPY の最小単位は 0 桁（円）だが、DB スキーマが金額を Decimal(12,2)
 * で保持しており、単価などに銭（小数2桁）が入りうるため、それに合わせて scale=2 とする。
 * なお §8.1 の計算途中の端数処理は「1円未満切捨」であり、銭精度の保持と切り捨て単位は別概念。
 */
export class Currency {
  /** 日本円。最小単位は銭（1/100 円）。 */
  static readonly JPY = new Currency("JPY", 2);

  private constructor(
    private readonly _code: string,
    private readonly _minorUnitScale: number
  ) {
    if (!Number.isInteger(_minorUnitScale) || _minorUnitScale < 0) {
      throw new InvalidArgumentError("通貨の最小単位スケールは0以上の整数である必要があります");
    }
  }

  /** 通貨コード（ISO 4217 形式の3文字）。例: "JPY" */
  get code(): string {
    return this._code;
  }

  /** 主単位を小数何桁まで分割するか。例: JPY=2（銭） */
  get minorUnitScale(): number {
    return this._minorUnitScale;
  }

  /** 主単位1あたりの最小単位数。例: JPY=100（1円=100銭） */
  get minorUnitsPerMajorUnit(): number {
    return 10 ** this._minorUnitScale;
  }

  equals(other: Currency): boolean {
    return this._code === other._code;
  }

  toString(): string {
    return this._code;
  }
}
