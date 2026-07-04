import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import { DeliveryLocationSellingPricePeriodId } from "@subdomains/pricing/domain/values/DeliveryLocationSellingPricePeriodId";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { loadDeliveryLocationSellingPriceOrThrow } from "./loadDeliveryLocationSellingPriceOrThrow";

export type EditDeliveryLocationSellingPricePeriodInput = {
  deliveryLocationId: string;
  productId: string;
  periodId: string;
  start: string;
  end: string | null;
  /** 通貨スケール固定の10進文字列。 */
  price: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 納品先別売単価の将来行を編集するコマンド（全項目）。
 *
 * 集約を取得し（無ければ NotFoundEntityError）、`editPeriod` で将来行のみ差し替える。現在有効・
 * 失効の行への編集や開始日が今日より前の指定は集約の不変条件が `BusinessRuleViolationError` で弾く
 * （参照日に依存・ADR-20260627-86b）。戻り値は編集後の集約。得意先別売単価の編集コマンドと同型で、
 * identity が複合自然キー（納品先 × 商品）である点が異なる（ADR-20260624-8tg）。
 */
export class EditDeliveryLocationSellingPricePeriodCommand {
  constructor(private readonly repository: DeliveryLocationSellingPriceRepository) {}

  async execute(
    input: EditDeliveryLocationSellingPricePeriodInput
  ): Promise<DeliveryLocationSellingPrice> {
    const aggregate = await loadDeliveryLocationSellingPriceOrThrow(
      this.repository,
      input.deliveryLocationId,
      input.productId
    );

    const period = ApplicablePeriod.create({ start: input.start, end: input.end });
    const price = SellingUnitPrice.fromMoney(Money.fromDecimalString(input.price));
    aggregate.editPeriod(
      new DeliveryLocationSellingPricePeriodId(input.periodId),
      { period, price },
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
