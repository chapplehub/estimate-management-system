import prisma from "@server/prisma";
import { CommonSellingPriceQueryService } from "@subdomains/pricing/application/queries/CommonSellingPriceQueryService";
import { CommonSellingPriceResolutionDTO } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceResolutionDTO";

/**
 * 共通販売単価の時点解決クエリサービスの Prisma 実装（ADR-0066・0067・20260624-95f）。
 *
 * `applicable_period @> $date::date` で、暦日を覆う期間行を直接1件引く（集約ロードなし）。
 * `daterange` は Prisma typed では扱えないため `$queryRaw` を使い、単価は精度保持のため
 * `selling_price::text` で受ける（ADR-0067）。`@>` 述語はインライン。共有フラグメント抽出・
 * 3層汎用化は利用者が増える A2 送り（rule of three）。
 *
 * 複数件ガードは置かない。`applicable_period` の EXCLUDE 制約が区間重複ゼロを物理保証するため
 * `@>` は構造的に最大1件で、`length > 1` の throw は到達不能・テスト不能な死にコードになる
 * （リポジトリと同じチーム方針）。`rows[0] ?? null` で先頭を取る（`findFirst` と同型）。
 */
export class PrismaCommonSellingPriceQueryService implements CommonSellingPriceQueryService {
  async resolve(input: {
    productId: string;
    date: string;
  }): Promise<CommonSellingPriceResolutionDTO | null> {
    const rows = await prisma.$queryRaw<CommonSellingPriceResolutionDTO[]>`
      SELECT selling_price::text AS "sellingPrice"
      FROM common_selling_price_periods
      WHERE product_id = ${input.productId}::uuid
        AND applicable_period @> ${input.date}::date
    `;

    return rows[0] ?? null;
  }
}
