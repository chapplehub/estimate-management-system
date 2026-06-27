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
    private readonly _period: ApplicablePeriod,
    private readonly _price: CostUnitPrice
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
