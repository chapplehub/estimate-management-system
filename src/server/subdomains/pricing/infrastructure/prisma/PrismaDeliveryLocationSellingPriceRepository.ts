import prisma from "@server/prisma";
import { applicablePeriodBounds, dateRangeValue } from "@server/shared/infrastructure/dateRange";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPriceRepository } from "@subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository";
import {
  DeliveryLocationSellingPriceMapper,
  type DeliveryLocationSellingPricePeriodRow,
} from "@subdomains/pricing/infrastructure/mappers/DeliveryLocationSellingPriceMapper";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { Prisma } from "@generated/prisma/client";

/** $transaction のコールバックに渡るトランザクションクライアント。 */
type Tx = Prisma.TransactionClient;

/**
 * 納品先別販売単価集約の Prisma リポジトリ実装。
 *
 * 共通・得意先別販売単価リポジトリと同型で、宛先が納品先（複合自然キー identity）である点だけが
 * 異なる（ADR-20260624-8tg）。適用期間（daterange）は Prisma typed では扱えないため、期間行の
 * 読み書きは `$queryRaw`/`$executeRaw` で行う（ADR-0067）。daterange の値生成・境界展開は共有
 * フラグメント（`dateRangeValue`/`applicablePeriodBounds`）に委ねる。期間行の同期は append-only で、
 * 新規 id のみを挿入し既存行には触れない（`ON CONFLICT (id) DO NOTHING`）。ドメインの変更操作が
 * addPeriod（追加）のみ・子が id 単位で内容不変ゆえ削除分岐は到達不能で、既存行を触らないため
 * 改定時に updated_at を保持できる（監査保持）。楽観ロックは親 version の条件付き更新で行う（ADR-0039）。
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
      PrismaDeliveryLocationSellingPriceRepository.translateInsertConflict(error, aggregate);
    }
  }

  /**
   * insert の例外を翻訳する。アプリ層の存在チェックをすり抜けた二重作成レースは親
   * delivery_location_selling_prices の複合 PK（delivery_location_id, product_id）衝突として P2002 で
   * 表面化するため、再試行可能な ConflictError へ翻訳する（他層リポジトリの translateInsertConflict と同型）。
   *
   * 期間行の EXCLUDE 違反（23P01）はここでは翻訳しない。insert は親 PK、update は version
   * 条件付き updateMany が同一キーの期間並行書き込みを直列化するため公開 API 経由では到達不能で、
   * トリガーするテストが書けず死にコードになる。EXCLUDE は SQL 直叩き・論理バグに対する DB 側の
   * 最後の砦として残す。
   */
  private static translateInsertConflict(
    error: unknown,
    aggregate: DeliveryLocationSellingPrice
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        `納品先 ${aggregate.deliveryLocationId.value} × 商品 ${aggregate.productId.value} の納品先別販売単価は既に登録されています。画面を再読み込みして最新の内容を確認してください。`
      );
    }
    throw error;
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
      if (result.count === 0) {
        throw new ConflictError(
          "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
        );
      }

      // 期間行は append-only で同期する。ドメインの変更操作は addPeriod（追加）のみで子は
      // id 単位で内容不変ゆえ、集約は常に DB の id を包含し「DB にあって集約に無い id（=削除）」
      // は発生しない。よって既存行に触れず新規 id のみ挿入すればよく、既存行の updated_at は
      // まったく動かない（監査保持）。
      await this.writePeriods(tx, aggregate);
    });
  }

  /**
   * 集約の全期間行を daterange 付きで挿入する（append-only）。
   *
   * 既存 id は `ON CONFLICT (id) DO NOTHING` で no-op にし、新規 id の行だけを挿入する。
   * これにより insert/update のどちらからも安全に呼べ、update では既存行の updated_at を
   * 一切動かさない。
   */
  private async writePeriods(tx: Tx, aggregate: DeliveryLocationSellingPrice): Promise<void> {
    for (const row of DeliveryLocationSellingPriceMapper.toPeriodWriteRows(aggregate)) {
      await tx.$executeRaw`
        INSERT INTO delivery_location_selling_price_periods
          (id, delivery_location_id, product_id, selling_price, applicable_period, updated_at)
        VALUES (
          ${row.id}::uuid,
          ${row.deliveryLocationId}::uuid,
          ${row.productId}::uuid,
          ${row.sellingPrice}::numeric,
          ${dateRangeValue(row.start, row.end)},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}
