import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { DeliveryLocationSellingPricePeriodId } from "../values/DeliveryLocationSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";
import { DeliveryLocationSellingPricePeriod } from "./DeliveryLocationSellingPricePeriod";

/** 永続化からの再構成に渡す適用期間行の記述子（子エンティティ型を露出しないため VO で受ける）。 */
export interface DeliveryLocationSellingPricePeriodSnapshot {
  id: DeliveryLocationSellingPricePeriodId;
  period: ApplicablePeriod;
  price: SellingUnitPrice;
}

/**
 * 納品先別販売単価集約（集約ルート）。
 *
 * 納品先 × 商品（identity = 複合自然キー {@link DeliveryLocationId} × {@link ProductId}）で適用期間行の
 * コレクションを内包する。「同一の納品先・商品内で適用期間が重複してはならない」という不変条件を
 * `addPeriod` の `overlaps` 判定で集約内に構造保証する（ADR-0066・0029）。共通・得意先別と同型だが
 * 宛先が納品先である別集約として実装する（ADR-20260624-8tg）。DB の EXCLUDE 制約（ADR-0067）は
 * 並行競合に対する二重防御の最後の砦。
 */
export class DeliveryLocationSellingPrice {
  static readonly ENTITY_NAME = "納品先別販売単価";

  private constructor(
    private readonly _deliveryLocationId: DeliveryLocationId,
    private readonly _productId: ProductId,
    private readonly _periods: DeliveryLocationSellingPricePeriod[]
  ) {}

  /** 空の集約を生成する。 */
  static create(
    deliveryLocationId: DeliveryLocationId,
    productId: ProductId
  ): DeliveryLocationSellingPrice {
    return new DeliveryLocationSellingPrice(deliveryLocationId, productId, []);
  }

  /**
   * 永続化から再構成する。DB の EXCLUDE 制約で重複ゼロが保証済みのため、
   * ここでは overlaps を再検証しない（状態の復元に徹する）。
   */
  static reconstruct(
    deliveryLocationId: DeliveryLocationId,
    productId: ProductId,
    rows: ReadonlyArray<DeliveryLocationSellingPricePeriodSnapshot>
  ): DeliveryLocationSellingPrice {
    const periods = rows.map((row) =>
      DeliveryLocationSellingPricePeriod.reconstruct(row.id, row.period, row.price)
    );
    return new DeliveryLocationSellingPrice(deliveryLocationId, productId, periods);
  }

  /**
   * 適用期間行を追加する。既存のどの期間とも重ならない場合のみ許す。
   * 重なる場合は不変条件違反として {@link BusinessRuleViolationError} を投げ、集約は変更しない。
   */
  addPeriod(period: ApplicablePeriod, price: SellingUnitPrice): void {
    const overlapping = this._periods.find((row) => row.period.overlaps(period));
    if (overlapping !== undefined) {
      throw new BusinessRuleViolationError(
        `${DeliveryLocationSellingPrice.ENTITY_NAME}の適用期間が既存の期間と重複しています`
      );
    }
    this._periods.push(DeliveryLocationSellingPricePeriod.create(period, price));
  }

  get deliveryLocationId(): DeliveryLocationId {
    return this._deliveryLocationId;
  }

  get productId(): ProductId {
    return this._productId;
  }

  /** 適用期間行（読み取り専用ビュー）。 */
  get periods(): readonly DeliveryLocationSellingPricePeriod[] {
    return this._periods;
  }
}
