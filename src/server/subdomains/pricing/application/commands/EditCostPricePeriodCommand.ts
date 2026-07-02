import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostPriceRepository } from "@subdomains/pricing/domain/repositories/CostPriceRepository";
import { CostPricePeriodId } from "@subdomains/pricing/domain/values/CostPricePeriodId";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { loadCostPriceOrThrow } from "./loadCostPriceOrThrow";

export type EditCostPricePeriodInput = {
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
 * 原価の将来行を編集するコマンド（全項目）。
 *
 * 集約を取得し（無ければ NotFoundEntityError）、`editPeriod` で将来行のみ差し替える。現在有効・
 * 失効の行への編集や開始日が今日より前の指定は集約の不変条件が `BusinessRuleViolationError` で弾く
 * （参照日に依存・ADR-20260627-86b）。戻り値は編集後の集約。
 */
export class EditCostPricePeriodCommand {
  constructor(private readonly repository: CostPriceRepository) {}

  async execute(input: EditCostPricePeriodInput): Promise<CostPrice> {
    const aggregate = await loadCostPriceOrThrow(this.repository, input.productId);

    const period = ApplicablePeriod.create({ start: input.start, end: input.end });
    const price = CostUnitPrice.fromMoney(Money.fromDecimalString(input.price));
    aggregate.editPeriod(
      new CostPricePeriodId(input.periodId),
      { period, price },
      input.referenceDate
    );

    await this.repository.update(aggregate, input.expectedVersion);
    return aggregate;
  }
}
