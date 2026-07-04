import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { DeliveryLocationSellingPriceEditQueryService } from "@subdomains/pricing/application/queries/DeliveryLocationSellingPriceEditQueryService";
import {
  DeliveryLocationSellingPriceEditDTO,
  DeliveryLocationSellingPriceEditPeriodDTO,
} from "@subdomains/pricing/application/queries/dto/DeliveryLocationSellingPriceEditDTO";

/**
 * 納品先別販売単価 編集読みモデルの Prisma 実装（ADR-0066・0067・0039・20260627-86b・#473・#546）。
 *
 * route の `[deliveryLocationCd]`/`[productCd]` をキーに納品先・商品を引き（どちらか無ければ `null`＝不在→FE は
 * `notFound()`。どちらが不在かは区別しない）、納品先・商品・**親得意先**の identity を同梱して返す。これで
 * FE 側の code→id 解決・名称の二重取得を不要にする。納品先の親得意先は `customer` リレーションを select して
 * 載せる（得意先別 #506 からの唯一の形状差）。有効フラグは接頭辞命名（deliveryLocationIsActive/productIsActive）
 * で載せ、3エンティティが載る DTO の自己記述性を確保する（親得意先の有効フラグは保守判断に不要のため同梱しない）。
 *
 * 親（`delivery_location_selling_prices`）を複合キー（delivery_location_id, product_id）で引いて version を取る。
 * 複合 PK は一意だが Prisma の複合 `findUnique` キーは命名規約に抵触するため `findFirst` のスカラー条件で引く
 * （Repository と同方針）。上書きなし（集約なし）なら version=null＝新規登録モードで periods は空配列になる。
 * この安全性は #512 の不変条件「集約が存在する ⇔ 期間行が1件以上」に依拠する。
 *
 * 期間行は `$queryRaw` で `lower(applicable_period)` 昇順に取る（`daterange` は typed 不可）。各行の時点状態は
 * daterange 演算で算出する: `@> 参照日`＝現在有効、`lower > 参照日`＝将来、それ以外＝失効。集約の
 * `ApplicablePeriod.contains`・一覧の `@>` と同一の半開区間意味論で判定を揃える。単価は精度保持のため
 * `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。得意先別実装との差分は宛先キーと親得意先 identity
 * 同梱起因のみ。
 */
export class PrismaDeliveryLocationSellingPriceEditQueryService implements DeliveryLocationSellingPriceEditQueryService {
  async find(input: {
    deliveryLocationCode: string;
    productCode: string;
    referenceDate: string;
  }): Promise<DeliveryLocationSellingPriceEditDTO | null> {
    const deliveryLocation = await prisma.deliveryLocation.findUnique({
      where: { code: input.deliveryLocationCode },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        customer: { select: { id: true, code: true, name: true } },
      },
    });
    if (deliveryLocation === null) {
      return null;
    }

    const product = await prisma.product.findUnique({
      where: { code: input.productCode },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (product === null) {
      return null;
    }

    // 複合 PK (delivery_location_id, product_id) は一意なので findFirst で 0/1 行に定まる（Repository と同方針）。
    const parent = await prisma.deliveryLocationSellingPrice.findFirst({
      where: { deliveryLocationId: deliveryLocation.id, productId: product.id },
      select: { version: true },
    });

    const periods =
      parent === null
        ? []
        : await prisma.$queryRaw<DeliveryLocationSellingPriceEditPeriodDTO[]>`
            SELECT id::text AS "periodId",
                   ${applicablePeriodBounds},
                   selling_price::text AS "sellingPrice",
                   CASE
                     WHEN applicable_period @> ${input.referenceDate}::date THEN 'active'
                     WHEN lower(applicable_period) > ${input.referenceDate}::date THEN 'future'
                     ELSE 'expired'
                   END AS "status"
            FROM delivery_location_selling_price_periods
            WHERE delivery_location_id = ${deliveryLocation.id}::uuid AND product_id = ${product.id}::uuid
            ORDER BY lower(applicable_period)
          `;

    return {
      deliveryLocationId: deliveryLocation.id,
      deliveryLocationCode: deliveryLocation.code,
      deliveryLocationName: deliveryLocation.name,
      deliveryLocationIsActive: deliveryLocation.isActive,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      productIsActive: product.isActive,
      customerId: deliveryLocation.customer.id,
      customerCode: deliveryLocation.customer.code,
      customerName: deliveryLocation.customer.name,
      version: parent?.version ?? null,
      periods,
    };
  }
}
