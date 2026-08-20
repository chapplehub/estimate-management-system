import prisma from "@server/prisma";
import { CustomerSellingPriceQueryService } from "@subdomains/pricing/application/queries/CustomerSellingPriceQueryService";
import { SellingPriceResolutionDTO } from "@subdomains/pricing/application/queries/dto/SellingPriceResolutionDTO";

/**
 * 得意先別販売単価の時点解決クエリサービスの Prisma 実装（ADR-0066・0067・20260624-95f）。
 *
 * `applicable_period @> $date::date` で、暦日を覆う期間行を直接1件引く（集約ロードなし）。
 * `daterange` は Prisma typed では扱えないため `$queryRaw` を使い、単価は精度保持のため
 * `selling_price::text` で受ける（ADR-0067）。SQL は共通層（#448）と対称にインラインで直書きする。
 * read 側は既存列に `@>` を当てるだけで半開区間 `[)` の生成という間違えやすい部分が無く（正しさは
 * schema の `daterange` + EXCLUDE に single-source 済み）、共有ヘルパに畳むと層判別子を infra に
 * 再集権化する新構造を生むため畳まない（learning/consolidation-cost-does-it-spawn-structure.md）。
 *
 * 複数件ガードは置かない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため
 * `@>` は構造的に最大1件で、`length > 1` の throw は到達不能・テスト不能な死にコードになる
 * （リポジトリと同じチーム方針）。`rows[0] ?? null` で先頭を取る（`findFirst` と同型）。
 */
export class PrismaCustomerSellingPriceQueryService implements CustomerSellingPriceQueryService {
  async resolve(input: {
    customerId: string;
    productId: string;
    date: string;
  }): Promise<SellingPriceResolutionDTO | null> {
    const rows = await prisma.$queryRaw<SellingPriceResolutionDTO[]>`
      SELECT selling_price::text AS "sellingPrice"
      FROM customer_selling_price_periods
      WHERE customer_id = ${input.customerId}::uuid
        AND product_id = ${input.productId}::uuid
        AND applicable_period @> ${input.date}::date
    `;

    return rows[0] ?? null;
  }
}
