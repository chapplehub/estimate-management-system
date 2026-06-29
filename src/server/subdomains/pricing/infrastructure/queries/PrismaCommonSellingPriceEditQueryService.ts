import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { CommonSellingPriceEditQueryService } from "@subdomains/pricing/application/queries/CommonSellingPriceEditQueryService";
import {
  CommonSellingPriceEditDTO,
  CommonSellingPriceEditPeriodDTO,
} from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";

/**
 * 共通売単価 編集読みモデルの Prisma 実装（ADR-0066・0067・0039・20260627-86b）。
 *
 * 親（`common_selling_prices`）を Prisma typed で引いて version を取り（未登録なら null＝新規登録モード）、
 * 期間行は `$queryRaw` で `lower(applicable_period)` 昇順に取る（`daterange` は typed 不可）。各行の時点
 * 状態は daterange 演算で算出する: `@> 参照日`＝現在有効、`lower > 参照日`＝将来、それ以外＝失効。
 * 集約の `ApplicablePeriod.contains`・一覧の `@>` と同一の半開区間意味論で判定を揃える。単価は精度保持
 * のため `::text`。参照日はアプリ注入で `CURRENT_DATE` を使わない。
 */
export class PrismaCommonSellingPriceEditQueryService implements CommonSellingPriceEditQueryService {
  async find(input: {
    productId: string;
    referenceDate: string;
  }): Promise<CommonSellingPriceEditDTO | null> {
    const parent = await prisma.commonSellingPrice.findUnique({
      where: { productId: input.productId },
      select: { version: true },
    });
    if (parent === null) {
      return null;
    }

    const periods = await prisma.$queryRaw<CommonSellingPriceEditPeriodDTO[]>`
      SELECT id::text AS "periodId",
             ${applicablePeriodBounds},
             selling_price::text AS "sellingPrice",
             CASE
               WHEN applicable_period @> ${input.referenceDate}::date THEN 'active'
               WHEN lower(applicable_period) > ${input.referenceDate}::date THEN 'future'
               ELSE 'expired'
             END AS "status"
      FROM common_selling_price_periods
      WHERE product_id = ${input.productId}::uuid
      ORDER BY lower(applicable_period)
    `;

    return { productId: input.productId, version: parent.version, periods };
  }
}
