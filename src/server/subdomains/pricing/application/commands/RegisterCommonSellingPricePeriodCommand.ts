import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type RegisterCommonSellingPricePeriodInput = {
  productId: string;
  start: string;
  end: string | null;
  /** 通貨スケール固定の10進文字列（float を経由しない・ADR-0022）。 */
  price: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める（ADR-20260627-86b）。 */
  referenceDate: string;
  /** 既存集約へ追加する場合の編集画面表示時 version（楽観ロック・ADR-0039）。未設定商品への初回登録では不要。 */
  expectedVersion?: number;
};

/**
 * 共通売単価の適用期間行を登録するコマンド。
 *
 * 母集合は全商品で「未設定（集約が無い）」商品が初期は多数を占める。集約が無ければ新規作成して
 * insert（version 1 始まり）、既に在れば期間を追加して update（expectedVersion で楽観ロック）する。
 * insert/update の選択はインフラ関心としてここで吸収する。開始日 ≥ 今日・重複禁止の不変条件は
 * 集約の `addPeriod` が参照日を使って強制する。戻り値は登録後の集約（ADR-0038）。
 */
export class RegisterCommonSellingPricePeriodCommand {
  constructor(private readonly repository: CommonSellingPriceRepository) {}

  async execute(input: RegisterCommonSellingPricePeriodInput): Promise<CommonSellingPrice> {
    const productId = new ProductId(input.productId);
    const period = ApplicablePeriod.create({ start: input.start, end: input.end });
    const price = SellingUnitPrice.fromMoney(Money.fromDecimalString(input.price));

    const existing = await this.repository.findByProductId(productId);
    if (existing === null) {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period, price, input.referenceDate);
      await this.repository.insert(aggregate);
      return aggregate;
    }

    existing.addPeriod(period, price, input.referenceDate);
    await this.repository.update(existing, input.expectedVersion ?? 0);
    return existing;
  }
}
