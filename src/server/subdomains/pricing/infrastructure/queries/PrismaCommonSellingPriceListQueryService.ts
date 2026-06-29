import { Prisma } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { CommonSellingPriceListQueryService } from "@subdomains/pricing/application/queries/CommonSellingPriceListQueryService";
import {
  CommonSellingPriceListItemDTO,
  CommonSellingPricePriceStatus,
} from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";

/**
 * 共通売単価 保守一覧の読みモデルの Prisma 実装（ADR-0066・0067・20260627-86b・#473）。
 *
 * 母集合=全商品を左表に、現在有効な期間行を `LEFT JOIN ... applicable_period @> $参照日::date` で
 * 添える。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため、参照日を覆う行は商品
 * ごと最大1件で、JOIN は商品ごと最大1行に収束する（複数件ガードは到達不能ゆえ置かない）。
 *
 * 単価状態 `priceStatus` は null（現在有効単価なし）の内訳を区別する三状態（#473・業務要件）:
 *   - 参照日を覆う行が JOIN された → `active`
 *   - 覆う行は無いが期間行が1件でも在る（`EXISTS`） → `lapsed`（失効中）
 *   - 期間行が皆無 → `unset`（未設定）
 * これは ADR-20260627-86b の「未設定の内訳は持たず null に畳む」判断を更新（supersede）する。
 *
 * 検索条件（code/name の部分一致・priceStatus の絞り込み）は派生テーブルの外側 `WHERE` で適用し、
 * FE での全件取得→絞り込みを避けて1クエリに寄せる。`daterange` は Prisma typed では扱えないため
 * `$queryRaw`。単価は精度保持のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。
 */
export class PrismaCommonSellingPriceListQueryService implements CommonSellingPriceListQueryService {
  async list(input: {
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: CommonSellingPricePriceStatus;
  }): Promise<CommonSellingPriceListItemDTO[]> {
    const conditions: Prisma.Sql[] = [];
    if (input.code) {
      conditions.push(Prisma.sql`t."productCode" ILIKE ${`%${input.code}%`}`);
    }
    if (input.name) {
      conditions.push(Prisma.sql`t."productName" ILIKE ${`%${input.name}%`}`);
    }
    if (input.priceStatus) {
      conditions.push(Prisma.sql`t."priceStatus" = ${input.priceStatus}`);
    }
    const where =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    return prisma.$queryRaw<CommonSellingPriceListItemDTO[]>`
      SELECT * FROM (
        SELECT p.id                    AS "productId",
               p.code                  AS "productCode",
               p.name                  AS "productName",
               p.is_active             AS "isActive",
               per.selling_price::text AS "currentSellingPrice",
               CASE
                 WHEN per.id IS NOT NULL THEN 'active'
                 WHEN EXISTS (
                   SELECT 1 FROM common_selling_price_periods x WHERE x.product_id = p.id
                 ) THEN 'lapsed'
                 ELSE 'unset'
               END AS "priceStatus"
        FROM products p
        LEFT JOIN common_selling_price_periods per
          ON per.product_id = p.id
          AND per.applicable_period @> ${input.referenceDate}::date
      ) t
      ${where}
      ORDER BY t."productCode"
    `;
  }
}
