import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { CommonSellingPricePeriodId } from "@subdomains/pricing/domain/values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type EditCommonSellingPricePeriodInput = {
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
 * 共通売単価の将来行を編集するコマンド（全項目）。
 *
 * 集約を取得し（無ければ NotFoundEntityError）、`editPeriod` で将来行のみ差し替える。現在有効・
 * 失効の行への編集や開始日が今日より前の指定は集約の不変条件が `BusinessRuleViolationError` で弾く
 * （参照日に依存・ADR-20260627-86b）。戻り値は編集後の集約。
 */
export class EditCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: EditCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const productId = new ProductId(input.productId);
    const aggregate = await this.repository.findByProductId(productId);
    if (aggregate === null) {
      throw new NotFoundEntityError(CommonSellingPrice, { productId: input.productId });
    }

    const period = ApplicablePeriod.create({ start: input.start, end: input.end });
    const price = SellingUnitPrice.fromMoney(Money.fromDecimalString(input.price));
    aggregate.editPeriod(
      new CommonSellingPricePeriodId(input.periodId),
      { period, price },
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
