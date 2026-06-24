import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CustomerSellingPricePeriodId } from "../values/CustomerSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";

/**
 * 得意先別販売単価の適用期間行（{@link CustomerSellingPrice} 集約の子エンティティ）。
 *
 * 「ある適用期間にこの単価」を表す1行。サロゲート identity を持ち、差分 upsert
 * （ADR-0032）で DB 行と対応づけられる。集約外から直接生成・操作させない（ADR-0027）ため、
 * 生成は集約ルートの `addPeriod` 経由（集約内ファクトリ・ADR-0036）に限る。
 */
export class CustomerSellingPricePeriod {
  private constructor(
    private readonly _id: CustomerSellingPricePeriodId,
    private readonly _period: ApplicablePeriod,
    private readonly _price: SellingUnitPrice
  ) {}

  /** 新規の期間行を生成する（identity を採番）。 */
  static create(period: ApplicablePeriod, price: SellingUnitPrice): CustomerSellingPricePeriod {
    return new CustomerSellingPricePeriod(CustomerSellingPricePeriodId.generate(), period, price);
  }

  /** 永続化からの再構成（identity を保つ）。 */
  static reconstruct(
    id: CustomerSellingPricePeriodId,
    period: ApplicablePeriod,
    price: SellingUnitPrice
  ): CustomerSellingPricePeriod {
    return new CustomerSellingPricePeriod(id, period, price);
  }

  get id(): CustomerSellingPricePeriodId {
    return this._id;
  }

  get period(): ApplicablePeriod {
    return this._period;
  }

  get price(): SellingUnitPrice {
    return this._price;
  }
}
