import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CommonSellingPriceRepository";
import {
  CommonSellingPriceMapper,
  type CommonSellingPricePeriodRow,
} from "@subdomains/pricing/infrastructure/mappers/CommonSellingPriceMapper";
import {
  appendPeriodRows,
  assertVersionBumped,
  syncPeriodRows,
  translateInsertConflict,
  type Tx,
} from "@subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * 共通販売単価集約の Prisma リポジトリ実装。
 *
 * 適用期間（daterange）は Prisma typed では扱えないため、期間行の読み出しは `$queryRaw` で行い、
 * 境界展開は共有フラグメント `applicablePeriodBounds` に委ねる（ADR-0067）。期間行の書き込み
 * （append-only INSERT）・P2002 の ConflictError 翻訳・楽観ロックの version 判定は、3層で共通の
 * 永続化ヘルパ `sellingPricePeriodPersistence` に委譲する（#458）。
 *
 * insert は新規作成ゆえ衝突が無く append-only（`ON CONFLICT (id) DO NOTHING`）で足りる。update は
 * 編集・適用終了・削除を伴うため差分 sync（`syncPeriodRows`）で DB を集約の現在状態へ収束させる:
 * 既存 id は値が変わった行だけ in-place 更新し（無変更行は `updated_at` 据え置き＝監査保持）、
 * 集約から消えた id の行は削除する（ADR-0032）。楽観ロックは親 version の条件付き更新（ADR-0039）。
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
             ${applicablePeriodBounds},
             selling_price::text AS "sellingPrice"
      FROM common_selling_price_periods
      WHERE product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    return CommonSellingPriceMapper.toDomain(productId.value, rows);
  }

  async insert(aggregate: CommonSellingPrice): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.commonSellingPrice.create({ data: { productId: aggregate.productId.value } });
        await this.writePeriods(tx, aggregate);
      });
    } catch (error) {
      // アプリ層の存在チェックをすり抜けた二重作成レースは親 common_selling_prices の
      // PK（product_id）衝突として P2002 で表面化するため、再試行可能な ConflictError へ翻訳する。
      // 期間行の EXCLUDE 違反（23P01）は翻訳しない: insert は親 PK、update は version 条件付き
      // updateMany が同一商品の並行書き込みを直列化するため公開 API からは到達不能で、DB 側の
      // 最後の砦として残す。
      translateInsertConflict(
        error,
        `商品 ${aggregate.productId.value} の共通販売単価は既に登録されています。画面を再読み込みして最新の内容を確認してください。`
      );
    }
  }

  async update(aggregate: CommonSellingPrice, expectedVersion: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // WHERE productId AND version の条件付き UPDATE で「比較→更新」を原子化し version を +1。
      // count = 0 は version 不一致（先行更新）と行消失（削除済み）の両方を覆う（ADR-0039）。
      const result = await tx.commonSellingPrice.updateMany({
        where: { productId: aggregate.productId.value, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      assertVersionBumped(result.count);

      // 期間行は差分 sync で集約の現在状態へ収束させる（編集の in-place 更新・適用終了・削除を反映）。
      // 値が変わった行だけ updated_at が前進し、無変更行は据え置かれる（監査保持）。
      await syncPeriodRows(
        tx,
        PrismaCommonSellingPriceRepository.PERIOD_TABLE,
        [aggregate.productId.value],
        this.toWriteRows(aggregate)
      );
    });
  }

  private static readonly PERIOD_TABLE = {
    table: "common_selling_price_periods",
    keyColumns: ["product_id"],
    valueColumn: "selling_price",
  } as const;

  /** 集約の全期間行を append-only で挿入する（新規作成専用・共通ヘルパへ委譲）。 */
  private async writePeriods(tx: Tx, aggregate: CommonSellingPrice): Promise<void> {
    await appendPeriodRows(
      tx,
      PrismaCommonSellingPriceRepository.PERIOD_TABLE,
      this.toWriteRows(aggregate)
    );
  }

  /** 集約の期間行を永続化ヘルパの行形式へ変換する。 */
  private toWriteRows(aggregate: CommonSellingPrice) {
    return CommonSellingPriceMapper.toPeriodWriteRows(aggregate).map((row) => ({
      id: row.id,
      keyValues: [row.productId],
      value: row.sellingPrice,
      start: row.start,
      end: row.end,
    }));
  }
}
