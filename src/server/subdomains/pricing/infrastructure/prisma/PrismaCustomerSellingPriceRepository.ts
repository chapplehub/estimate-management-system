import prisma from "@server/prisma";
import { applicablePeriodBounds } from "@server/shared/infrastructure/dateRange";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { CustomerSellingPriceRepository } from "@subdomains/pricing/domain/repositories/CustomerSellingPriceRepository";
import {
  CustomerSellingPriceMapper,
  type CustomerSellingPricePeriodRow,
} from "@subdomains/pricing/infrastructure/mappers/CustomerSellingPriceMapper";
import {
  appendPeriodRows,
  assertVersionBumped,
  translateInsertConflict,
  type Tx,
} from "@subdomains/pricing/infrastructure/prisma/sellingPricePeriodPersistence";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * 得意先別販売単価集約の Prisma リポジトリ実装。
 *
 * 共通販売単価リポジトリと同型で、宛先が得意先（複合自然キー identity）である点だけが異なる
 * （ADR-20260624-8tg）。適用期間（daterange）は Prisma typed では扱えないため、期間行の読み出しは
 * `$queryRaw`・境界展開は `applicablePeriodBounds` に委ねる（ADR-0067）。期間行の書き込み（append-only
 * INSERT）・P2002 の ConflictError 翻訳・楽観ロックの version 判定は、3層で共通の永続化ヘルパ
 * `sellingPricePeriodPersistence` に委譲する（#458）。期間行の同期は append-only で、新規 id のみを
 * 挿入し既存行には触れない（`ON CONFLICT (id) DO NOTHING`）。ドメインの変更操作が addPeriod（追加）
 * のみ・子が id 単位で内容不変ゆえ削除分岐は到達不能で、既存行を触らないため改定時に updated_at を
 * 保持できる（監査保持）。楽観ロックは親 version の条件付き更新で行う（ADR-0039）。
 */
export class PrismaCustomerSellingPriceRepository implements CustomerSellingPriceRepository {
  async findByCustomerIdAndProductId(
    customerId: CustomerId,
    productId: ProductId
  ): Promise<CustomerSellingPrice | null> {
    // 複合PK (customer_id, product_id) は一意なので findFirst で 0/1 行に定まる。Prisma の複合
    // findUnique キー（customerId_productId）は命名規約に抵触するため、スカラー条件で引く。
    const parent = await prisma.customerSellingPrice.findFirst({
      where: { customerId: customerId.value, productId: productId.value },
    });
    if (parent === null) {
      return null;
    }

    const rows = await prisma.$queryRaw<CustomerSellingPricePeriodRow[]>`
      SELECT id::text AS id,
             ${applicablePeriodBounds},
             selling_price::text AS "sellingPrice"
      FROM customer_selling_price_periods
      WHERE customer_id = ${customerId.value}::uuid AND product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    return CustomerSellingPriceMapper.toDomain(customerId.value, productId.value, rows);
  }

  async insert(aggregate: CustomerSellingPrice): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.customerSellingPrice.create({
          data: { customerId: aggregate.customerId.value, productId: aggregate.productId.value },
        });
        await this.writePeriods(tx, aggregate);
      });
    } catch (error) {
      // アプリ層の存在チェックをすり抜けた二重作成レースは親 customer_selling_prices の複合 PK
      // （customer_id, product_id）衝突として P2002 で表面化するため、再試行可能な ConflictError へ
      // 翻訳する。期間行の EXCLUDE 違反（23P01）は翻訳しない: insert は親 PK、update は version
      // 条件付き updateMany が同一キーの並行書き込みを直列化するため公開 API からは到達不能で、
      // DB 側の最後の砦として残す。
      translateInsertConflict(
        error,
        `得意先 ${aggregate.customerId.value} × 商品 ${aggregate.productId.value} の得意先別販売単価は既に登録されています。画面を再読み込みして最新の内容を確認してください。`
      );
    }
  }

  async update(aggregate: CustomerSellingPrice, expectedVersion: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // WHERE 複合キー AND version の条件付き UPDATE で「比較→更新」を原子化し version を +1。
      // count = 0 は version 不一致（先行更新）と行消失（削除済み）の両方を覆う（ADR-0039）。
      const result = await tx.customerSellingPrice.updateMany({
        where: {
          customerId: aggregate.customerId.value,
          productId: aggregate.productId.value,
          version: expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      assertVersionBumped(result.count);

      // 期間行は append-only で同期する。ドメインの変更操作は addPeriod（追加）のみで子は
      // id 単位で内容不変ゆえ、集約は常に DB の id を包含し「DB にあって集約に無い id（=削除）」
      // は発生しない。よって既存行に触れず新規 id のみ挿入すればよく、既存行の updated_at は
      // まったく動かない（監査保持）。
      await this.writePeriods(tx, aggregate);
    });
  }

  /** 集約の全期間行を append-only で同期する（共通ヘルパへ委譲）。 */
  private async writePeriods(tx: Tx, aggregate: CustomerSellingPrice): Promise<void> {
    await appendPeriodRows(
      tx,
      {
        table: "customer_selling_price_periods",
        keyColumns: ["customer_id", "product_id"],
        valueColumn: "selling_price",
      },
      CustomerSellingPriceMapper.toPeriodWriteRows(aggregate).map((row) => ({
        id: row.id,
        keyValues: [row.customerId, row.productId],
        value: row.sellingPrice,
        start: row.start,
        end: row.end,
      }))
    );
  }
}
