import { Prisma } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { containsPattern } from "@server/shared/infrastructure/escapeLikePattern";
import { CustomerSellingPriceListQueryService } from "@subdomains/pricing/application/queries/CustomerSellingPriceListQueryService";
import {
  CustomerSellingPriceListDTO,
  CustomerSellingPriceListItemDTO,
  CustomerSellingPricePriceStatus,
} from "@subdomains/pricing/application/queries/dto/CustomerSellingPriceListDTO";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";

/**
 * 得意先別販売単価 保守一覧の読みモデルの Prisma 実装（ADR-0066・0067・20260627-86b・#473・#506）。
 *
 * まず `[customerCd]` で得意先を引き（無ければ `null`＝得意先不在→FE は `notFound()`）、identity を封筒に
 * 同梱する。裸配列ではなく封筒型 `| null` を返すのは、存在しない得意先で LEFT JOIN が静かに空振りし「全商品が
 * 上書きなし」に化ける契約事故を構造的に排除するため。
 *
 * 母集合=価格保守対象商品（個別商品・消耗品。セット商品を除く。区分は `ProductCategory.priceableValues()` を
 * 単一源に注入・#514）を左表に、指定得意先の現在有効な得意先別期間行を
 * `LEFT JOIN ... customer_id = $固定 AND applicable_period @> $参照日::date` で添える。得意先を JOIN 条件に
 * 固定するため他得意先の行は混入しない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため、
 * 参照日を覆う行は（得意先×商品）ごと最大1件で JOIN は最大1行に収束する。同参照日の共通単価も別 LEFT JOIN で
 * 並記し（COALESCE しない）、得意先別優遇額の比較の基準として並置する。
 *
 * 単価状態 `priceStatus` は null（現在有効な上書きなし）の内訳を区別する三状態（#506・業務要件）:
 *   - 参照日を覆う得意先別行が JOIN された → `active`
 *   - 覆う行は無いが得意先別期間行が1件でも在る（`EXISTS` の相関条件に `customer_id` を含める） → `lapsed`
 *   - 得意先別期間行が皆無 → `none`（上書きなし＝正常な既定状態。共通の `unset`＝異常状態とは別語彙）
 *
 * 検索条件（code/name の部分一致・priceStatus の絞り込み）は派生テーブルの外側 `WHERE` で適用し、FE での
 * 全件取得→絞り込みを避けて1クエリに寄せる。`daterange` は Prisma typed では扱えないため `$queryRaw`。単価は
 * 精度保持のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。共通販売単価実装との差分は複合キー
 * （得意先固定 JOIN・共通単価並記）起因のみ。
 */
export class PrismaCustomerSellingPriceListQueryService implements CustomerSellingPriceListQueryService {
  async find(input: {
    customerCode: string;
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: CustomerSellingPricePriceStatus;
  }): Promise<CustomerSellingPriceListDTO | null> {
    const customer = await prisma.customer.findUnique({
      where: { code: input.customerCode },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (customer === null) {
      return null;
    }

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

    // 母集合を価格保守対象商品（個別商品・消耗品）に限定する（セット商品を除外・#514）。
    const priceableCategories = [...ProductCategory.priceableValues()];

    const items = await prisma.$queryRaw<CustomerSellingPriceListItemDTO[]>`
      SELECT * FROM (
        SELECT p.id                    AS "productId",
               p.code                  AS "productCode",
               p.name                  AS "productName",
               p.is_active             AS "isActive",
               cust.selling_price::text AS "currentSellingPrice",
               lower(cust.applicable_period)::text AS "currentPeriodStart",
               upper(cust.applicable_period)::text AS "currentPeriodEnd",
               com.selling_price::text AS "currentCommonSellingPrice",
               CASE
                 WHEN cust.id IS NOT NULL THEN 'active'
                 WHEN EXISTS (
                   SELECT 1 FROM customer_selling_price_periods x
                   WHERE x.product_id = p.id AND x.customer_id = ${customer.id}::uuid
                 ) THEN 'lapsed'
                 ELSE 'none'
               END AS "priceStatus"
        FROM products p
        LEFT JOIN customer_selling_price_periods cust
          ON cust.product_id = p.id
          AND cust.customer_id = ${customer.id}::uuid
          AND cust.applicable_period @> ${input.referenceDate}::date
        LEFT JOIN common_selling_price_periods com
          ON com.product_id = p.id
          AND com.applicable_period @> ${input.referenceDate}::date
        WHERE p.category IN (${Prisma.join(priceableCategories)})
      ) t
      ${where}
      ORDER BY t."productCode"
    `;

    return {
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      customerIsActive: customer.isActive,
      items,
    };
  }
}
