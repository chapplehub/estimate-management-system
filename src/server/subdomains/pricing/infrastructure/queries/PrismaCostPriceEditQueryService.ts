import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { CostPriceEditQueryService } from "@subdomains/pricing/application/queries/CostPriceEditQueryService";
import {
  CostPriceEditDTO,
  CostPriceEditPeriodDTO,
} from "@subdomains/pricing/application/queries/dto/CostPriceEditDTO";

/**
 * 原価 編集読みモデルの Prisma 実装（ADR-0066・0067・0039・20260627-86b・#500）。
 * `PrismaCommonSellingPriceEditQueryService` の同型ミラー（ADR-20260627-a5c・値カラムのみ相違）。
 *
 * route の `[productCd]` をキーに商品を引き（無ければ `null`＝商品不在→FE は `notFound()`）、商品 identity
 * （id/code/name/isActive）を同梱して返す。これで FE 側の code→id 解決・商品名の二重取得を不要にする。
 *
 * 親（`cost_prices`）を Prisma typed で引いて version を取る。未登録なら version=null＝新規登録
 * モードで、periods は空配列になる。期間行は `$queryRaw` で `lower(applicable_period)` 昇順に取る
 * （`daterange` は typed 不可）。各行の時点状態は daterange 演算で算出する: `@> 参照日`＝現在有効、
 * `lower > 参照日`＝将来、それ以外＝失効。集約の `ApplicablePeriod.contains`・一覧の `@>` と同一の半開
 * 区間意味論で判定を揃える。単価は精度保持のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。
 */
export class PrismaCostPriceEditQueryService implements CostPriceEditQueryService {
  async find(input: {
    productCode: string;
    referenceDate: string;
  }): Promise<CostPriceEditDTO | null> {
    const product = await prisma.product.findUnique({
      where: { code: input.productCode },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (product === null) {
      return null;
    }

    const parent = await prisma.costPrice.findUnique({
      where: { productId: product.id },
      select: { version: true },
    });

    const periods =
      parent === null
        ? []
        : await prisma.$queryRaw<CostPriceEditPeriodDTO[]>`
            SELECT id::text AS "periodId",
                   ${applicablePeriodBounds},
                   cost_price::text AS "costPrice",
                   CASE
                     WHEN applicable_period @> ${input.referenceDate}::date THEN 'active'
                     WHEN lower(applicable_period) > ${input.referenceDate}::date THEN 'future'
                     ELSE 'expired'
                   END AS "status"
            FROM cost_price_periods
            WHERE product_id = ${product.id}::uuid
            ORDER BY lower(applicable_period)
          `;

    return {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      isActive: product.isActive,
      version: parent?.version ?? null,
      periods,
    };
  }
}
