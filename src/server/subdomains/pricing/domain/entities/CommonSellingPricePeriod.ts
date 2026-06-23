import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CommonSellingPricePeriodId } from "../values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";

/**
 * 共通販売単価の適用期間行（{@link CommonSellingPrice} 集約の子エンティティ）。
 *
 * 「ある適用期間にこの単価」を表す1行。サロゲート identity を持ち、差分 upsert
 * （ADR-0032）で DB 行と対応づけられる。集約外から直接生成・操作させない（ADR-0027）ため、
 * 生成は集約ルートの `addPeriod` 経由（集約内ファクトリ・ADR-0036）に限る。
 */
export class CommonSellingPricePeriod {
  private constructor(
    private readonly _id: CommonSellingPricePeriodId,
    private readonly _period: ApplicablePeriod,
    private readonly _price: SellingUnitPrice
  ) {}

  /** 新規の期間行を生成する（identity を採番）。 */
  static create(period: ApplicablePeriod, price: SellingUnitPrice): CommonSellingPricePeriod {
    return new CommonSellingPricePeriod(CommonSellingPricePeriodId.generate(), period, price);
  }

  /** 永続化からの再構成（identity を保つ）。 */
  static reconstruct(
    id: CommonSellingPricePeriodId,
    period: ApplicablePeriod,
    price: SellingUnitPrice
  ): CommonSellingPricePeriod {
    return new CommonSellingPricePeriod(id, period, price);
  }

  get id(): CommonSellingPricePeriodId {
    return this._id;
  }

  get period(): ApplicablePeriod {
    return this._period;
  }

  get price(): SellingUnitPrice {
    return this._price;
  }
}
