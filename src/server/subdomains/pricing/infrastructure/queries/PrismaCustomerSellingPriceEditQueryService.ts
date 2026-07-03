import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { CustomerSellingPriceEditQueryService } from "@subdomains/pricing/application/queries/CustomerSellingPriceEditQueryService";
import {
  CustomerSellingPriceEditDTO,
  CustomerSellingPriceEditPeriodDTO,
} from "@subdomains/pricing/application/queries/dto/CustomerSellingPriceEditDTO";

/**
 * 得意先別販売単価 編集読みモデルの Prisma 実装（ADR-0066・0067・0039・20260627-86b・#473・#506）。
 *
 * route の `[customerCd]`/`[productCd]` をキーに得意先・商品を引き（どちらか無ければ `null`＝不在→FE は
 * `notFound()`。どちらが不在かは区別しない——共通販売単価も区別しない）、両 identity を同梱して返す。これで
 * FE 側の code→id 解決・名称の二重取得を不要にする。有効フラグは接頭辞命名（customerIsActive/productIsActive）で
 * 載せ、エンティティが2つ載る DTO の自己記述性を確保する。
 *
 * 親（`customer_selling_prices`）を複合キー（customer_id, product_id）で引いて version を取る。複合 PK は
 * 一意だが Prisma の複合 `findUnique` キーは命名規約に抵触するため `findFirst` のスカラー条件で引く
 * （Repository と同方針）。上書きなし（集約なし）なら version=null＝新規登録モードで periods は空配列になる。
 * この安全性は #512 の不変条件「集約が存在する ⇔ 期間行が1件以上」に依拠する。
 *
 * 期間行は `$queryRaw` で `lower(applicable_period)` 昇順に取る（`daterange` は typed 不可）。各行の時点状態は
 * daterange 演算で算出する: `@> 参照日`＝現在有効、`lower > 参照日`＝将来、それ以外＝失効。集約の
 * `ApplicablePeriod.contains`・一覧の `@>` と同一の半開区間意味論で判定を揃える。単価は精度保持のため
 * `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。共通販売単価実装との差分は複合キー起因のみ。
 */
export class PrismaCustomerSellingPriceEditQueryService implements CustomerSellingPriceEditQueryService {
  async find(input: {
    customerCode: string;
    productCode: string;
    referenceDate: string;
  }): Promise<CustomerSellingPriceEditDTO | null> {
    const customer = await prisma.customer.findUnique({
      where: { code: input.customerCode },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (customer === null) {
      return null;
    }

    const product = await prisma.product.findUnique({
      where: { code: input.productCode },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (product === null) {
      return null;
    }

    // 複合 PK (customer_id, product_id) は一意なので findFirst で 0/1 行に定まる（Repository と同方針）。
    const parent = await prisma.customerSellingPrice.findFirst({
      where: { customerId: customer.id, productId: product.id },
      select: { version: true },
    });

    const periods =
      parent === null
        ? []
        : await prisma.$queryRaw<CustomerSellingPriceEditPeriodDTO[]>`
            SELECT id::text AS "periodId",
                   ${applicablePeriodBounds},
                   selling_price::text AS "sellingPrice",
                   CASE
                     WHEN applicable_period @> ${input.referenceDate}::date THEN 'active'
                     WHEN lower(applicable_period) > ${input.referenceDate}::date THEN 'future'
                     ELSE 'expired'
                   END AS "status"
            FROM customer_selling_price_periods
            WHERE customer_id = ${customer.id}::uuid AND product_id = ${product.id}::uuid
            ORDER BY lower(applicable_period)
          `;

    return {
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      customerIsActive: customer.isActive,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      productIsActive: product.isActive,
      version: parent?.version ?? null,
      periods,
    };
  }
}
