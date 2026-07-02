import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { CustomerSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CustomerSellingPriceRepository";
import { CustomerSellingPricePeriodId } from "@subdomains/pricing/domain/values/CustomerSellingPricePeriodId";
import { loadCustomerSellingPriceOrThrow } from "./loadCustomerSellingPriceOrThrow";

export type DeleteCustomerSellingPricePeriodInput = {
  customerId: string;
  productId: string;
  periodId: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める。 */
  referenceDate: string;
  /** 編集画面表示時の version（楽観ロック・ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 得意先別売単価の未来開始行を削除するコマンド（誤入力の訂正）。
 *
 * 現在有効・失効の行は過去そのもの／既発行見積が時点解決した履歴のため削除できない。状態違反は
 * 集約の不変条件が `BusinessRuleViolationError` で弾く（参照日に依存・ADR-20260627-86b）。共通売単価
 * の削除コマンドと同型で、identity が複合自然キー（得意先 × 商品）である点が異なる（ADR-20260624-8tg）。
 */
export class DeleteCustomerSellingPricePeriodCommand {
  constructor(private readonly repository: CustomerSellingPriceRepository) {}

  async execute(input: DeleteCustomerSellingPricePeriodInput): Promise<CustomerSellingPrice> {
    const aggregate = await loadCustomerSellingPriceOrThrow(
      this.repository,
      input.customerId,
      input.productId
    );

    aggregate.deletePeriod(new CustomerSellingPricePeriodId(input.periodId), input.referenceDate);

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
