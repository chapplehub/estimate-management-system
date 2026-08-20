import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CostPricePeriodId } from "../values/CostPricePeriodId";
import { CostUnitPrice } from "../values/CostUnitPrice";

/**
 * 原価の適用期間行（{@link CostPrice} 集約の子エンティティ）。
 *
 * 「ある適用期間にこの原価」を表す1行。サロゲート identity を持ち、差分 upsert
 * （ADR-0032）で DB 行と対応づけられる。集約外から直接生成・操作させない（ADR-0027）ため、
 * 生成は集約ルートの `addPeriod` 経由（集約内ファクトリ・ADR-0036）に限る。
 */
export class CostPricePeriod {
  private constructor(
    private readonly _id: CostPricePeriodId,
    private _period: ApplicablePeriod,
    private _price: CostUnitPrice
  ) {}

  /** 新規の期間行を生成する（identity を採番）。 */
  static create(period: ApplicablePeriod, price: CostUnitPrice): CostPricePeriod {
    return new CostPricePeriod(CostPricePeriodId.generate(), period, price);
  }

  /** 永続化からの再構成（identity を保つ）。 */
  static reconstruct(
    id: CostPricePeriodId,
    period: ApplicablePeriod,
    price: CostUnitPrice
  ): CostPricePeriod {
    return new CostPricePeriod(id, period, price);
  }

  /**
   * 期間と単価を差し替える（将来行の編集用・集約ルートからのみ呼ぶ）。
   * 行状態ガード（将来行限定）は集約ルート側の不変条件で守るため、ここでは状態を見ない。
   */
  changeTo(period: ApplicablePeriod, price: CostUnitPrice): void {
    this._period = period;
    this._price = price;
  }

  /**
   * 終了日のみを差し替える（適用終了用・集約ルートからのみ呼ぶ）。
   * 開始日・単価は変えない。状態ガード（現在有効行限定）は集約ルート側で守る。
   */
  endDateOn(endDate: string): void {
    this._period = ApplicablePeriod.create({ start: this._period.start, end: endDate });
  }

  get id(): CostPricePeriodId {
    return this._id;
  }

  get period(): ApplicablePeriod {
    return this._period;
  }

  get price(): CostUnitPrice {
    return this._price;
  }
}
