import prisma from "@server/prisma";
import { CostPriceQueryService } from "@subdomains/pricing/application/queries/CostPriceQueryService";
import { CostPriceResolutionDTO } from "@subdomains/pricing/application/queries/dto/CostPriceResolutionDTO";

/**
 * 原価の時点解決クエリサービスの Prisma 実装（ADR-0066・0067・20260624-95f・20260627-a5c）。
 *
 * `applicable_period @> $date::date` で、暦日を覆う期間行を直接1件引く（集約ロードなし）。
 * `daterange` は Prisma typed では扱えないため `$queryRaw` を使い、原価は精度保持のため
 * `cost_price::text` で受ける（ADR-0067）。`@>` 述語はインライン。
 *
 * 複数件ガードは置かない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため
 * `@>` は構造的に最大1件で、`length > 1` の throw は到達不能・テスト不能な死にコードになる
 * （リポジトリと同じチーム方針）。`rows[0] ?? null` で先頭を取る（`findFirst` と同型）。
 */
export class PrismaCostPriceQueryService implements CostPriceQueryService {
  async resolve(input: {
    productId: string;
    date: string;
  }): Promise<CostPriceResolutionDTO | null> {
    const rows = await prisma.$queryRaw<CostPriceResolutionDTO[]>`
      SELECT cost_price::text AS "costPrice"
      FROM cost_price_periods
      WHERE product_id = ${input.productId}::uuid
        AND applicable_period @> ${input.date}::date
    `;

    return rows[0] ?? null;
  }
}
