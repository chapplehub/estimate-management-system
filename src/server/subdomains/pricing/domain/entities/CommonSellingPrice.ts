import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CommonSellingPricePeriodId } from "../values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "../values/SellingUnitPrice";
import { CommonSellingPricePeriod } from "./CommonSellingPricePeriod";

/** 永続化からの再構成に渡す適用期間行の記述子（子エンティティ型を露出しないため VO で受ける）。 */
export interface CommonSellingPricePeriodSnapshot {
  id: CommonSellingPricePeriodId;
  period: ApplicablePeriod;
  price: SellingUnitPrice;
}

/**
 * 共通販売単価集約（集約ルート）。
 *
 * 商品単位（identity = {@link ProductId}）で適用期間行のコレクションを内包する。
 * 「同一商品内で適用期間が重複してはならない」という不変条件を `addPeriod` の
 * `overlaps` 判定で集約内に構造保証する（ADR-0066・0029）。DB の EXCLUDE 制約
 * （ADR-0067）は並行競合に対する二重防御の最後の砦。
 */
export class CommonSellingPrice {
  static readonly ENTITY_NAME = "共通販売単価";

  private constructor(
    private readonly _productId: ProductId,
    private readonly _periods: CommonSellingPricePeriod[]
  ) {}

  /** 空の集約を生成する。 */
  static create(productId: ProductId): CommonSellingPrice {
    return new CommonSellingPrice(productId, []);
  }

  /**
   * 永続化から再構成する。DB の EXCLUDE 制約で重複ゼロが保証済みのため、
   * ここでは overlaps を再検証しない（状態の復元に徹する）。
   */
  static reconstruct(
    productId: ProductId,
    rows: ReadonlyArray<CommonSellingPricePeriodSnapshot>
  ): CommonSellingPrice {
    const periods = rows.map((row) =>
      CommonSellingPricePeriod.reconstruct(row.id, row.period, row.price)
    );
    return new CommonSellingPrice(productId, periods);
  }

  /**
   * 適用期間行を追加する。既存のどの期間とも重ならない場合のみ許す。
   * 重なる場合は不変条件違反として {@link BusinessRuleViolationError} を投げ、集約は変更しない。
   */
  addPeriod(period: ApplicablePeriod, price: SellingUnitPrice): void {
    const overlapping = this._periods.find((row) => row.period.overlaps(period));
    if (overlapping !== undefined) {
      throw new BusinessRuleViolationError(
        `${CommonSellingPrice.ENTITY_NAME}の適用期間が既存の期間と重複しています`
      );
    }
    this._periods.push(CommonSellingPricePeriod.create(period, price));
  }

  get productId(): ProductId {
    return this._productId;
  }

  /** 適用期間行（読み取り専用ビュー）。 */
  get periods(): readonly CommonSellingPricePeriod[] {
    return this._periods;
  }
}
