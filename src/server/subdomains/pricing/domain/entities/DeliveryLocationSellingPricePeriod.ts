import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { DeliveryLocationSellingPricePeriodId } from "../values/DeliveryLocationSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";

/**
 * 納品先別販売単価の適用期間行（{@link DeliveryLocationSellingPrice} 集約の子エンティティ）。
 *
 * 「ある適用期間にこの単価」を表す1行。サロゲート identity を持ち、差分 upsert
 * （ADR-0032）で DB 行と対応づけられる。集約外から直接生成・操作させない（ADR-0027）ため、
 * 生成は集約ルートの `addPeriod` 経由（集約内ファクトリ・ADR-0036）に限る。
 */
export class DeliveryLocationSellingPricePeriod {
  private constructor(
    private readonly _id: DeliveryLocationSellingPricePeriodId,
    private readonly _period: ApplicablePeriod,
    private readonly _price: SellingUnitPrice
  ) {}

  /** 新規の期間行を生成する（identity を採番）。 */
  static create(
    period: ApplicablePeriod,
    price: SellingUnitPrice
  ): DeliveryLocationSellingPricePeriod {
    return new DeliveryLocationSellingPricePeriod(
      DeliveryLocationSellingPricePeriodId.generate(),
      period,
      price
    );
  }

  /** 永続化からの再構成（identity を保つ）。 */
  static reconstruct(
    id: DeliveryLocationSellingPricePeriodId,
    period: ApplicablePeriod,
    price: SellingUnitPrice
  ): DeliveryLocationSellingPricePeriod {
    return new DeliveryLocationSellingPricePeriod(id, period, price);
  }

  get id(): DeliveryLocationSellingPricePeriodId {
    return this._id;
  }

  get period(): ApplicablePeriod {
    return this._period;
  }

  get price(): SellingUnitPrice {
    return this._price;
  }
}
