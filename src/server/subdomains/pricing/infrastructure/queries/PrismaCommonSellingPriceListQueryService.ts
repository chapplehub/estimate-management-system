import prisma from "@server/prisma";
import { CommonSellingPriceListQueryService } from "@subdomains/pricing/application/queries/CommonSellingPriceListQueryService";
import { CommonSellingPriceListItemDTO } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";

/**
 * 共通売単価 保守一覧の読みモデルの Prisma 実装（ADR-0066・0067・20260627-86b）。
 *
 * 母集合=全商品を左表に、現在有効な期間行を `LEFT JOIN ... applicable_period @> $参照日::date` で
 * 添える。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため、参照日を覆う行は商品
 * ごと最大1件で、JOIN は商品ごと最大1行に収束する（複数件ガードは到達不能ゆえ置かない）。覆う行が
 * 無ければ単価は NULL となり、未設定・将来のみ・失効のみが一様に「現在有効単価なし」として現れる。
 *
 * `daterange` は Prisma typed では扱えないため `$queryRaw`。単価は精度保持のため `::text`。参照日は
 * アプリ注入で `CURRENT_DATE`（DB サーバー TZ 依存）を使わない。
 */
export class PrismaCommonSellingPriceListQueryService implements CommonSellingPriceListQueryService {
  async list(input: { referenceDate: string }): Promise<CommonSellingPriceListItemDTO[]> {
    return prisma.$queryRaw<CommonSellingPriceListItemDTO[]>`
      SELECT p.id                    AS "productId",
             p.code                  AS "productCode",
             p.name                  AS "productName",
             p.is_active             AS "isActive",
             per.selling_price::text AS "currentSellingPrice"
      FROM products p
      LEFT JOIN common_selling_price_periods per
        ON per.product_id = p.id
        AND per.applicable_period @> ${input.referenceDate}::date
      ORDER BY p.code
    `;
  }
}
