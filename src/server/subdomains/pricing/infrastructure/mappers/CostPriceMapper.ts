import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostPricePeriodId } from "@subdomains/pricing/domain/values/CostPricePeriodId";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";

/**
 * `$queryRaw` で読み出した適用期間行の生データ。
 *
 * `daterange` の合成文字列をパースせず、`lower()`/`upper()` で下端・上端を別カラムに
 * 展開して受ける（上端は無期限なら NULL）。`cost_price` は精度保持のため `::text` で受ける。
 */
export interface CostPricePeriodRow {
  id: string;
  start: string;
  end: string | null;
  costPrice: string;
}

/** `$executeRaw` で書き込む適用期間行（daterange は SQL 側で生成する）。 */
export interface CostPricePeriodWriteRow {
  id: string;
  productId: string;
  costPrice: string;
  start: string;
  end: string | null;
}

/**
 * 原価集約と DB 行の相互変換。
 *
 * `applicable_period`（daterange）は Prisma typed では扱えないため、Repository が
 * `$queryRaw`/`$executeRaw` で取り出した素の行（{@link CostPricePeriodRow}）と
 * ドメインの橋渡しのみを担う。範囲型の SQL 生成・展開は Repository 側に閉じる（ADR-0067）。
 * `CommonSellingPriceMapper` と同型（ADR-20260627-a5c）。
 */
export class CostPriceMapper {
  /** 親の存在と期間行の生データから集約を再構成する。 */
  static toDomain(productId: string, rows: CostPricePeriodRow[]): CostPrice {
    return CostPrice.reconstruct(
      new ProductId(productId),
      rows.map((row) => ({
        id: new CostPricePeriodId(row.id),
        period: ApplicablePeriod.create({ start: row.start, end: row.end }),
        // ::text で受けた10進文字列を Number 経由（float64）にせず Money へ厳密変換する。
        price: CostUnitPrice.fromMoney(Money.fromDecimalString(row.costPrice)),
      }))
    );
  }

  /** 集約の各期間行を書き込み用の素の行へ変換する。 */
  static toPeriodWriteRows(aggregate: CostPrice): CostPricePeriodWriteRow[] {
    const productId = aggregate.productId.value;
    return aggregate.periods.map((row) => {
      const money = row.price.money;
      return {
        id: row.id.value,
        productId,
        // NUMERIC 列へ渡す10進文字列（通貨スケールで桁を固定し浮動小数の混入を防ぐ）
        costPrice: money.majorUnits.toFixed(money.currency.minorUnitScale),
        start: row.period.start,
        end: row.period.end,
      };
    });
  }
}
