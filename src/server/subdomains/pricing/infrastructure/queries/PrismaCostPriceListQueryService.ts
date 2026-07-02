import { Prisma } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { containsPattern } from "@server/shared/infrastructure/escapeLikePattern";
import { CostPriceListQueryService } from "@subdomains/pricing/application/queries/CostPriceListQueryService";
import {
  CostPriceListItemDTO,
  CostPricePriceStatus,
} from "@subdomains/pricing/application/queries/dto/CostPriceListItemDTO";

/**
 * 原価 保守一覧の読みモデルの Prisma 実装（ADR-0066・0067・20260627-86b・#500）。
 * `PrismaCommonSellingPriceListQueryService` の同型ミラー（ADR-20260627-a5c・値カラムのみ相違）。
 *
 * 母集合=全商品を左表に、現在有効な期間行を `LEFT JOIN ... applicable_period @> $参照日::date` で
 * 添える。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため、参照日を覆う行は商品
 * ごと最大1件で、JOIN は商品ごと最大1行に収束する（複数件ガードは到達不能ゆえ置かない）。
 *
 * 単価状態 `priceStatus` は null（現在有効原価なし）の内訳を区別する三状態:
 *   - 参照日を覆う行が JOIN された → `active`
 *   - 覆う行は無いが期間行が1件でも在る（`EXISTS`） → `lapsed`（失効中）
 *   - 期間行が皆無 → `unset`（未設定）
 *
 * 検索条件（code/name の部分一致・priceStatus の絞り込み）は派生テーブルの外側 `WHERE` で適用し、
 * FE での全件取得→絞り込みを避けて1クエリに寄せる。`daterange` は Prisma typed では扱えないため
 * `$queryRaw`。単価は精度保持のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。
 */
export class PrismaCostPriceListQueryService implements CostPriceListQueryService {
  async list(input: {
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: CostPricePriceStatus;
  }): Promise<CostPriceListItemDTO[]> {
    const conditions: Prisma.Sql[] = [];
    if (input.code) {
      conditions.push(Prisma.sql`t."productCode" ILIKE ${containsPattern(input.code)} ESCAPE '\\'`);
    }
    if (input.name) {
      conditions.push(Prisma.sql`t."productName" ILIKE ${containsPattern(input.name)} ESCAPE '\\'`);
    }
    if (input.priceStatus) {
      conditions.push(Prisma.sql`t."priceStatus" = ${input.priceStatus}`);
    }
    const where =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    return prisma.$queryRaw<CostPriceListItemDTO[]>`
      SELECT * FROM (
        SELECT p.id                 AS "productId",
               p.code               AS "productCode",
               p.name               AS "productName",
               p.is_active          AS "isActive",
               per.cost_price::text AS "currentCostPrice",
               lower(per.applicable_period)::text AS "currentPeriodStart",
               upper(per.applicable_period)::text AS "currentPeriodEnd",
               CASE
                 WHEN per.id IS NOT NULL THEN 'active'
                 WHEN EXISTS (
                   SELECT 1 FROM cost_price_periods x WHERE x.product_id = p.id
                 ) THEN 'lapsed'
                 ELSE 'unset'
               END AS "priceStatus"
        FROM products p
        LEFT JOIN cost_price_periods per
          ON per.product_id = p.id
          AND per.applicable_period @> ${input.referenceDate}::date
      ) t
      ${where}
      ORDER BY t."productCode"
    `;
  }
}
