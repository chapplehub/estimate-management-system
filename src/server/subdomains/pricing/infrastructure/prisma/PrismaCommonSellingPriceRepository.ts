import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import {
  CommonSellingPriceMapper,
  type CommonSellingPricePeriodRow,
} from "@subdomains/pricing/infrastructure/mappers/CommonSellingPriceMapper";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import type { Prisma } from "@generated/prisma/client";

/** $transaction のコールバックに渡るトランザクションクライアント。 */
type Tx = Prisma.TransactionClient;

/**
 * 共通販売単価集約の Prisma リポジトリ実装。
 *
 * 適用期間（daterange）は Prisma typed では扱えないため、期間行の読み書きは
 * `$queryRaw`/`$executeRaw` で行う（ADR-0067）。期間行の同期は EXCLUDE 制約の
 * 瞬間衝突を避けるため、トランザクション内で「全削除 → ドメインの identity を
 * 再利用して全挿入」とする（identity は保たれる・ADR-0032 / Estimate 集約と同型）。
 * 楽観ロックは親 version の条件付き更新で行う（ADR-0039）。
 */
export class PrismaCommonSellingPriceRepository implements CommonSellingPriceRepository {
  async findByProductId(productId: ProductId): Promise<CommonSellingPrice | null> {
    const parent = await prisma.commonSellingPrice.findUnique({
      where: { productId: productId.value },
    });
    if (parent === null) {
      return null;
    }

    const rows = await prisma.$queryRaw<CommonSellingPricePeriodRow[]>`
      SELECT id::text AS id,
             lower(applicable_period)::text AS start,
             upper(applicable_period)::text AS "end",
             selling_price::text AS "sellingPrice"
      FROM common_selling_price_periods
      WHERE product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    return CommonSellingPriceMapper.toDomain(productId.value, rows);
  }

  async insert(aggregate: CommonSellingPrice): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.commonSellingPrice.create({ data: { productId: aggregate.productId.value } });
      await this.writePeriods(tx, aggregate);
    });
  }

  async update(aggregate: CommonSellingPrice, expectedVersion: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // WHERE productId AND version の条件付き UPDATE で「比較→更新」を原子化し version を +1。
      // count = 0 は version 不一致（先行更新）と行消失（削除済み）の両方を覆う（ADR-0039）。
      const result = await tx.commonSellingPrice.updateMany({
        where: { productId: aggregate.productId.value, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictError(
          "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
        );
      }

      // 期間行は全削除してから再挿入する。EXCLUDE の瞬間衝突を避けつつ identity は再利用する。
      await tx.commonSellingPricePeriod.deleteMany({
        where: { productId: aggregate.productId.value },
      });
      await this.writePeriods(tx, aggregate);
    });
  }

  /** 集約の全期間行を daterange 付きで挿入する。 */
  private async writePeriods(tx: Tx, aggregate: CommonSellingPrice): Promise<void> {
    for (const row of CommonSellingPriceMapper.toPeriodWriteRows(aggregate)) {
      await tx.$executeRaw`
        INSERT INTO common_selling_price_periods
          (id, product_id, selling_price, applicable_period, updated_at)
        VALUES (
          ${row.id}::uuid,
          ${row.productId}::uuid,
          ${row.sellingPrice}::numeric,
          daterange(${row.start}::date, ${row.end}::date, '[)'),
          CURRENT_TIMESTAMP
        )
      `;
    }
  }
}
