import prisma from "@server/prisma";
import { DeliveryLocationSellingPriceQueryService } from "@subdomains/pricing/application/queries/DeliveryLocationSellingPriceQueryService";
import { SellingPriceResolutionDTO } from "@subdomains/pricing/application/queries/dto/SellingPriceResolutionDTO";

/**
 * 納品先別販売単価の時点解決クエリサービスの Prisma 実装（ADR-0066・0067・20260624-95f）。
 *
 * `applicable_period @> $date::date` で、暦日を覆う期間行を直接1件引く（集約ロードなし）。
 * `daterange` は Prisma typed では扱えないため `$queryRaw` を使い、単価は精度保持のため
 * `selling_price::text` で受ける（ADR-0067）。SQL は共通層（#448）・得意先別層と対称にインラインで
 * 直書きする。read 側は既存列に `@>` を当てるだけで半開区間 `[)` の生成という間違えやすい部分が無く
 * （正しさは schema の `daterange` + EXCLUDE に single-source 済み）、共有ヘルパは層判別子を infra へ
 * 再集権化する新構造を生むため畳まない（learning/consolidation-cost-does-it-spawn-structure.md）。
 *
 * 複数件ガードは置かない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため
 * `@>` は構造的に最大1件で、`length > 1` の throw は到達不能・テスト不能な死にコードになる
 * （リポジトリと同じチーム方針）。`rows[0] ?? null` で先頭を取る（`findFirst` と同型）。
 */
export class PrismaDeliveryLocationSellingPriceQueryService implements DeliveryLocationSellingPriceQueryService {
  async resolve(input: {
    deliveryLocationId: string;
    productId: string;
    date: string;
  }): Promise<SellingPriceResolutionDTO | null> {
    const rows = await prisma.$queryRaw<SellingPriceResolutionDTO[]>`
      SELECT selling_price::text AS "sellingPrice"
      FROM delivery_location_selling_price_periods
      WHERE delivery_location_id = ${input.deliveryLocationId}::uuid
        AND product_id = ${input.productId}::uuid
        AND applicable_period @> ${input.date}::date
    `;

    return rows[0] ?? null;
  }
}
