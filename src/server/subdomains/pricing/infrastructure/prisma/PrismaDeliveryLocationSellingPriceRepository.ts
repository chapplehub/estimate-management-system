import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import {
  DeliveryLocationSellingPriceMapper,
  type DeliveryLocationSellingPricePeriodRow,
} from "@subdomains/pricing/infrastructure/mappers/DeliveryLocationSellingPriceMapper";
import {
  appendPeriodRows,
  assertVersionBumped,
  syncPeriodRows,
  translateInsertConflict,
  type Tx,
} from "@subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * 納品先別販売単価集約の Prisma リポジトリ実装。
 *
 * 共通・得意先別販売単価リポジトリと同型で、宛先が納品先（複合自然キー identity）である点だけが
 * 異なる（ADR-20260624-8tg）。適用期間（daterange）は Prisma typed では扱えないため、期間行の
 * 読み出しは `$queryRaw`・境界展開は `applicablePeriodBounds` に委ねる（ADR-0067）。期間行の書き込み・
 * P2002 の ConflictError 翻訳・楽観ロックの version 判定は、3層で共通の永続化ヘルパ
 * `sellingPricePeriodPersistence` に委譲する（#458）。
 *
 * insert は新規作成ゆえ衝突が無く append-only（`ON CONFLICT (id) DO NOTHING`）で足りる。update は
 * 編集・適用終了・削除を伴うため差分 sync（`syncPeriodRows`）で DB を集約の現在状態へ収束させる:
 * 既存 id は値が変わった行だけ in-place 更新し（無変更行は `updated_at` 据え置き＝監査保持）、
 * 集約から消えた id の行は削除する（ADR-0032）。楽観ロックは親 version の条件付き更新（ADR-0039）。
 */
export class PrismaDeliveryLocationSellingPriceRepository implements DeliveryLocationSellingPriceRepository {
  async findByDeliveryLocationIdAndProductId(
    deliveryLocationId: DeliveryLocationId,
    productId: ProductId
  ): Promise<DeliveryLocationSellingPrice | null> {
    // 複合PK (delivery_location_id, product_id) は一意なので findFirst で 0/1 行に定まる。Prisma の
    // 複合 findUnique キー（deliveryLocationId_productId）は命名規約に抵触するため、スカラー条件で引く。
    const parent = await prisma.deliveryLocationSellingPrice.findFirst({
      where: { deliveryLocationId: deliveryLocationId.value, productId: productId.value },
    });
    if (parent === null) {
      return null;
    }

    const rows = await prisma.$queryRaw<DeliveryLocationSellingPricePeriodRow[]>`
      SELECT id::text AS id,
             ${applicablePeriodBounds},
             selling_price::text AS "sellingPrice"
      FROM delivery_location_selling_price_periods
      WHERE delivery_location_id = ${deliveryLocationId.value}::uuid AND product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    return DeliveryLocationSellingPriceMapper.toDomain(
      deliveryLocationId.value,
      productId.value,
      rows
    );
  }

  async insert(aggregate: DeliveryLocationSellingPrice): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.deliveryLocationSellingPrice.create({
          data: {
            deliveryLocationId: aggregate.deliveryLocationId.value,
            productId: aggregate.productId.value,
          },
        });
        await this.writePeriods(tx, aggregate);
      });
    } catch (error) {
      // アプリ層の存在チェックをすり抜けた二重作成レースは親 delivery_location_selling_prices の
      // 複合 PK（delivery_location_id, product_id）衝突として P2002 で表面化するため、再試行可能な
      // ConflictError へ翻訳する。期間行の EXCLUDE 違反（23P01）は翻訳しない: insert は親 PK、update は
      // version 条件付き updateMany が同一キーの並行書き込みを直列化するため公開 API からは到達不能で、
      // DB 側の最後の砦として残す。
      translateInsertConflict(
        error,
        `納品先 ${aggregate.deliveryLocationId.value} × 商品 ${aggregate.productId.value} の納品先別販売単価は既に登録されています。画面を再読み込みして最新の内容を確認してください。`
      );
    }
  }

  async update(aggregate: DeliveryLocationSellingPrice, expectedVersion: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // WHERE 複合キー AND version の条件付き UPDATE で「比較→更新」を原子化し version を +1。
      // count = 0 は version 不一致（先行更新）と行消失（削除済み）の両方を覆う（ADR-0039）。
      const result = await tx.deliveryLocationSellingPrice.updateMany({
        where: {
          deliveryLocationId: aggregate.deliveryLocationId.value,
          productId: aggregate.productId.value,
          version: expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      assertVersionBumped(result.count);

      // 期間行は差分 sync で集約の現在状態へ収束させる（編集の in-place 更新・適用終了・削除を反映）。
      // 値が変わった行だけ updated_at が前進し、無変更行は据え置かれる（監査保持）。
      await syncPeriodRows(
        tx,
        PrismaDeliveryLocationSellingPriceRepository.PERIOD_TABLE,
        [aggregate.deliveryLocationId.value, aggregate.productId.value],
        this.toWriteRows(aggregate)
      );
    });
  }

  async delete(aggregate: DeliveryLocationSellingPrice, expectedVersion: number): Promise<void> {
    // WHERE 複合キー AND version の条件付き削除で「比較→削除」を原子化する。count = 0 は
    // version 不一致（並行更新・例: 最終行削除中の期間追加）と行消失の両方を覆い ConflictError
    // へ翻訳する（ADR-0039）。親 1 行の削除で FK onDelete: Cascade が期間行も掃くため子は書かない。
    const result = await prisma.deliveryLocationSellingPrice.deleteMany({
      where: {
        deliveryLocationId: aggregate.deliveryLocationId.value,
        productId: aggregate.productId.value,
        version: expectedVersion,
      },
    });
    assertVersionBumped(result.count);
  }

  private static readonly PERIOD_TABLE = {
    table: "delivery_location_selling_price_periods",
    keyColumns: ["delivery_location_id", "product_id"],
    valueColumn: "selling_price",
  } as const;

  /** 集約の全期間行を append-only で挿入する（新規作成専用・共通ヘルパへ委譲）。 */
  private async writePeriods(tx: Tx, aggregate: DeliveryLocationSellingPrice): Promise<void> {
    await appendPeriodRows(
      tx,
      PrismaDeliveryLocationSellingPriceRepository.PERIOD_TABLE,
      this.toWriteRows(aggregate)
    );
  }

  /** 集約の期間行を永続化ヘルパの行形式へ変換する。 */
  private toWriteRows(aggregate: DeliveryLocationSellingPrice) {
    return DeliveryLocationSellingPriceMapper.toPeriodWriteRows(aggregate).map((row) => ({
      id: row.id,
      keyValues: [row.deliveryLocationId, row.productId],
      value: row.sellingPrice,
      start: row.start,
      end: row.end,
    }));
  }
}
