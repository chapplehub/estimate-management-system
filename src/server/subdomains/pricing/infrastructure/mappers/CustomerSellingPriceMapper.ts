import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { CustomerSellingPricePeriodId } from "@subdomains/pricing/domain/values/CustomerSellingPricePeriodId";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

/**
 * `$queryRaw` で読み出した適用期間行の生データ。
 *
 * `daterange` の合成文字列をパースせず、`lower()`/`upper()` で下端・上端を別カラムに
 * 展開して受ける（上端は無期限なら NULL）。`selling_price` は精度保持のため `::text` で受ける。
 */
export interface CustomerSellingPricePeriodRow {
  id: string;
  start: string;
  end: string | null;
  sellingPrice: string;
}

/** `$executeRaw` で書き込む適用期間行（daterange は SQL 側で生成する）。 */
export interface CustomerSellingPricePeriodWriteRow {
  id: string;
  customerId: string;
  productId: string;
  sellingPrice: string;
  start: string;
  end: string | null;
}

/**
 * 得意先別販売単価集約と DB 行の相互変換。
 *
 * `applicable_period`（daterange）は Prisma typed では扱えないため、Repository が
 * `$queryRaw`/`$executeRaw` で取り出した素の行（{@link CustomerSellingPricePeriodRow}）と
 * ドメインの橋渡しのみを担う。範囲型の SQL 生成・展開は共有フラグメント（dateRange）と
 * Repository 側に閉じる（ADR-0067）。
 */
export class CustomerSellingPriceMapper {
  /** 親の存在（得意先 × 商品）と期間行の生データから集約を再構成する。 */
  static toDomain(
    customerId: string,
    productId: string,
    rows: CustomerSellingPricePeriodRow[]
  ): CustomerSellingPrice {
    return CustomerSellingPrice.reconstruct(
      new CustomerId(customerId),
      new ProductId(productId),
      rows.map((row) => ({
        id: new CustomerSellingPricePeriodId(row.id),
        period: ApplicablePeriod.create({ start: row.start, end: row.end }),
        // ::text で受けた10進文字列を Number 経由（float64）にせず Money へ厳密変換する。
        price: SellingUnitPrice.fromMoney(Money.fromDecimalString(row.sellingPrice)),
      }))
    );
  }

  /** 集約の各期間行を書き込み用の素の行へ変換する。 */
  static toPeriodWriteRows(aggregate: CustomerSellingPrice): CustomerSellingPricePeriodWriteRow[] {
    const customerId = aggregate.customerId.value;
    const productId = aggregate.productId.value;
    return aggregate.periods.map((row) => {
      const money = row.price.money;
      return {
        id: row.id.value,
        customerId,
        productId,
        // NUMERIC 列へ渡す10進文字列（通貨スケールで桁を固定し浮動小数の混入を防ぐ）
        sellingPrice: money.majorUnits.toFixed(money.currency.minorUnitScale),
        start: row.period.start,
        end: row.period.end,
      };
    });
  }
}
