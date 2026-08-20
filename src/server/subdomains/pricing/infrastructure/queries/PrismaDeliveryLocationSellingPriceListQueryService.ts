import { Prisma } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { containsPattern } from "@server/shared/infrastructure/escapeLikePattern";
import { DeliveryLocationSellingPriceListQueryService } from "@subdomains/pricing/application/queries/DeliveryLocationSellingPriceListQueryService";
import {
  DeliveryLocationSellingPriceListDTO,
  DeliveryLocationSellingPriceListItemDTO,
  DeliveryLocationSellingPricePriceStatus,
} from "@subdomains/pricing/application/queries/dto/DeliveryLocationSellingPriceListDTO";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";

/**
 * 納品先別販売単価 保守一覧の読みモデルの Prisma 実装（ADR-0066・0067・20260627-86b・#473・#546）。
 *
 * まず `[deliveryLocationCd]` で納品先を引き（無ければ `null`＝納品先不在→FE は `notFound()`）、納品先自身の
 * identity と**親得意先の identity（`customer` リレーションを select）** を封筒に同梱する。親得意先を載せるのは
 * 納品先が親得意先の文脈無しに保守画面ヘッダで意味を成さないため（得意先別 #506 からの唯一の形状差・#473
 * 素描画方針）。裸配列ではなく封筒型 `| null` を返すのは、存在しない納品先で LEFT JOIN が静かに空振りし「全商品
 * が上書きなし」に化ける契約事故を構造的に排除するため。
 *
 * 母集合=価格保守対象商品（個別商品・消耗品。セット商品を除く。区分は `ProductCategory.priceableValues()` を
 * 単一源に注入・#514）を左表に、指定納品先の現在有効な納品先別期間行を
 * `LEFT JOIN ... delivery_location_id = $固定 AND applicable_period @> $参照日::date` で添える。納品先を JOIN
 * 条件に固定するため他納品先の行は混入しない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証する
 * ため、参照日を覆う行は（納品先×商品）ごと最大1件で JOIN は最大1行に収束する。同参照日の共通単価も別
 * LEFT JOIN で並記し（COALESCE しない）、納品先別優遇額の比較の基準として並置する。並記は共通のみ（納品先宛の
 * 価格解決連鎖は `納品先別 ?? 共通` で得意先別は連鎖に入らない）。
 *
 * 単価状態 `priceStatus` は null（現在有効な上書きなし）の内訳を区別する三状態（#546・業務要件）:
 *   - 参照日を覆う納品先別行が JOIN された → `active`
 *   - 覆う行は無いが納品先別期間行が1件でも在る（`EXISTS` の相関条件に `delivery_location_id` を含める） → `lapsed`
 *   - 納品先別期間行が皆無 → `none`（上書きなし＝正常な既定状態）
 *
 * 検索条件（code/name の部分一致・priceStatus の絞り込み）は派生テーブルの外側 `WHERE` で適用し、FE での
 * 全件取得→絞り込みを避けて1クエリに寄せる。`daterange` は Prisma typed では扱えないため `$queryRaw`。単価は
 * 精度保持のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。得意先別実装との差分は宛先キー
 * （納品先固定 JOIN）と親得意先 identity 同梱起因のみ。
 */
export class PrismaDeliveryLocationSellingPriceListQueryService implements DeliveryLocationSellingPriceListQueryService {
  async find(input: {
    deliveryLocationCode: string;
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: DeliveryLocationSellingPricePriceStatus;
  }): Promise<DeliveryLocationSellingPriceListDTO | null> {
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

    const items = await prisma.$queryRaw<DeliveryLocationSellingPriceListItemDTO[]>`
      SELECT * FROM (
        SELECT p.id                    AS "productId",
               p.code                  AS "productCode",
               p.name                  AS "productName",
               p.is_active             AS "isActive",
               dl.selling_price::text  AS "currentSellingPrice",
               lower(dl.applicable_period)::text AS "currentPeriodStart",
               upper(dl.applicable_period)::text AS "currentPeriodEnd",
               com.selling_price::text AS "currentCommonSellingPrice",
               CASE
                 WHEN dl.id IS NOT NULL THEN 'active'
                 WHEN EXISTS (
                   SELECT 1 FROM delivery_location_selling_price_periods x
                   WHERE x.product_id = p.id AND x.delivery_location_id = ${deliveryLocation.id}::uuid
                 ) THEN 'lapsed'
                 ELSE 'none'
               END AS "priceStatus"
        FROM products p
        LEFT JOIN delivery_location_selling_price_periods dl
          ON dl.product_id = p.id
          AND dl.delivery_location_id = ${deliveryLocation.id}::uuid
          AND dl.applicable_period @> ${input.referenceDate}::date
        LEFT JOIN common_selling_price_periods com
          ON com.product_id = p.id
          AND com.applicable_period @> ${input.referenceDate}::date
        WHERE p.category IN (${Prisma.join(priceableCategories)})
      ) t
      ${where}
      ORDER BY t."productCode"
    `;

    return {
      deliveryLocationId: deliveryLocation.id,
      deliveryLocationCode: deliveryLocation.code,
      deliveryLocationName: deliveryLocation.name,
      deliveryLocationIsActive: deliveryLocation.isActive,
      customerId: deliveryLocation.customer.id,
      customerCode: deliveryLocation.customer.code,
      customerName: deliveryLocation.customer.name,
      items,
    };
  }
}
