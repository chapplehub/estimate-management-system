import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import { DeliveryLocationSellingPricePeriodId } from "@subdomains/pricing/domain/values/DeliveryLocationSellingPricePeriodId";
import { loadDeliveryLocationSellingPriceOrThrow } from "./loadDeliveryLocationSellingPriceOrThrow";

export type EndDateDeliveryLocationSellingPricePeriodInput = {
  deliveryLocationId: string;
  productId: string;
  periodId: string;
  /** 適用終了日（今日より後・JST 暦日）。 */
  endDate: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 納品先別売単価の現在有効行を適用終了するコマンド（end-dating・独立コマンド）。
 *
 * 単価・開始日は変えず終了日のみ未来方向に確定する。入力が `{ periodId, endDate }` のみで将来行の
 * 全項目編集とは形が異なるため独立コマンドにする（ADR-0018 流・ADR-20260627-86b 軸4）。現在有効行
 * 以外への適用終了や今日以前の終了日は集約の不変条件が `BusinessRuleViolationError` で弾く。得意先別売単価
 * の適用終了コマンドと同型で、identity が複合自然キー（納品先 × 商品）である点が異なる（ADR-20260624-8tg）。
 */
export class EndDateDeliveryLocationSellingPricePeriodCommand {
  constructor(private readonly repository: DeliveryLocationSellingPriceRepository) {}

  async execute(
    input: EndDateDeliveryLocationSellingPricePeriodInput
  ): Promise<DeliveryLocationSellingPrice> {
    const aggregate = await loadDeliveryLocationSellingPriceOrThrow(
      this.repository,
      input.deliveryLocationId,
      input.productId
    );

    aggregate.endDatePeriod(
      new DeliveryLocationSellingPricePeriodId(input.periodId),
      input.endDate,
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
