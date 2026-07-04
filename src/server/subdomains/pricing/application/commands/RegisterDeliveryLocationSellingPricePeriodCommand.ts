import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ValidationError } from "@server/shared/errors/DomainError";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

export type RegisterDeliveryLocationSellingPricePeriodInput = {
  deliveryLocationId: string;
  productId: string;
  start: string;
  end: string | null;
  /** 通貨スケール固定の10進文字列（float を経由しない・ADR-0022）。 */
  price: string;
  /** 参照日（今日・JST 暦日）。Server Action がサーバー生成して詰める（ADR-20260627-86b）。 */
  referenceDate: string;
  /** 既存集約へ追加する場合の編集画面表示時 version（楽観ロック・ADR-0039）。未設定への初回登録では不要。 */
  expectedVersion?: number;
};

/**
 * 納品先別売単価の適用期間行を登録するコマンド。
 *
 * 母集合は納品先 × 商品で「未設定（集約が無い）」組み合わせが初期は多数を占める。集約が無ければ
 * 新規作成して insert（version 1 始まり）、既に在れば期間を追加して update（expectedVersion で
 * 楽観ロック）する。insert/update の選択はインフラ関心としてここで吸収する。開始日 ≥ 今日・重複禁止の
 * 不変条件は集約の `addPeriod` が参照日を使って強制する。戻り値は登録後の集約（ADR-0038）。
 * 得意先別売単価の登録コマンドと同型で、identity が複合自然キー（納品先 × 商品）である点が異なる
 * （ADR-20260624-8tg）。
 */
export class RegisterDeliveryLocationSellingPricePeriodCommand {
  constructor(
    private readonly repository: DeliveryLocationSellingPriceRepository,
    private readonly productQueryService: ProductQueryService
  ) {}

  async execute(
    input: RegisterDeliveryLocationSellingPricePeriodInput
  ): Promise<DeliveryLocationSellingPrice> {
    const deliveryLocationId = new DeliveryLocationId(input.deliveryLocationId);
    const productId = new ProductId(input.productId);
    const period = ApplicablePeriod.create({ start: input.start, end: input.end });
    const price = SellingUnitPrice.fromMoney(Money.fromDecimalString(input.price));

    const existing = await this.repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    );
    if (existing === null) {
      // 新規作成分岐でのみ商品区分をライブ取得する。区分不変ゆえ既存集約は必ず非セットで、
      // 更新経路での取得は無駄なクエリになるため取得しない（ADR-0030）。セット商品拒否は
      // 集約の構造的不変条件として `create` に置く（ファクトリガード・#531）。
      const product = await this.productQueryService.findById(input.productId);
      if (product === null) {
        throw new ValidationError(`商品が存在しません: ${input.productId}`);
      }
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.from(product.category)
      );
      aggregate.addPeriod(period, price, input.referenceDate);
      await this.repository.insert(aggregate);
      return aggregate;
    }

    // 既存集約への追加は version を渡した楽観ロックが必須。未指定を `?? 0` で吸収すると 1 始まりの
    // 実 version と永久に一致せず必ず ConflictError（「他のユーザーが更新」の誤表示）になるため、
    // 入力契約違反として ValidationError で早期に弾く（silent conflict を loud failure へ）。
    if (input.expectedVersion === undefined) {
      throw new ValidationError(
        "既存の納品先別販売単価へ期間を追加するには expectedVersion（編集画面表示時の version）が必要です"
      );
    }

    existing.addPeriod(period, price, input.referenceDate);
    await this.repository.update(existing, input.expectedVersion);
    return existing;
  }
}
