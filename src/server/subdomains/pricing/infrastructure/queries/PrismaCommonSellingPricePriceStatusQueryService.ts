import prisma from "@server/prisma";
import { CommonSellingPricePriceStatusQueryService } from "@subdomains/pricing/application/queries/CommonSellingPricePriceStatusQueryService";
import { CommonSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";

/**
 * 単一商品 priceStatus 読みモデルの Prisma 実装（#487）。
 *
 * 保守一覧（#473・`PrismaCommonSellingPriceListQueryService`）の三状態 CASE 式を単一商品にミラーする:
 *   - 参照日を覆う期間行が JOIN された（`per.id IS NOT NULL`） → `active`
 *   - 覆う行は無いが期間行が1件でも在る（`EXISTS`） → `lapsed`（失効中）
 *   - 期間行が皆無 → `unset`（未設定）
 * `applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため、参照日を覆う行は商品ごと最大1件。
 *
 * 商品コードで商品行を引き当てられなければ `null`（＝商品不在）。母集合フィルタ（セット除外）は置かない:
 * canHavePrice の判定は消費側（詳細ページ）の責務（#487 判断2）で、本 read は素の三状態のみ返す。
 * `daterange` は Prisma typed では扱えないため `$queryRaw`。参照日はアプリ注入で `CURRENT_DATE` を使わない。
 */
export class PrismaCommonSellingPricePriceStatusQueryService implements CommonSellingPricePriceStatusQueryService {
  async find(input: {
    productCode: string;
    referenceDate: string;
  }): Promise<CommonSellingPricePriceStatus | null> {
    const rows = await prisma.$queryRaw<{ priceStatus: CommonSellingPricePriceStatus }[]>`
      SELECT CASE
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
      WHERE p.code = ${input.productCode}
    `;

    return rows[0]?.priceStatus ?? null;
  }
}
