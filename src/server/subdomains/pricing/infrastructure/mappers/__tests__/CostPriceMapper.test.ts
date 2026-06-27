import { Money } from "@server/shared/domain/values/Money";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { describe, expect, it } from "vitest";
import { CostPriceMapper } from "../CostPriceMapper";

const VALID_UUID_V7 = "019573a0-7a00-7000-8000-000000000001";

describe("CostPriceMapper", () => {
  describe("toDomain — 生データから集約の再構成", () => {
    it("上端有界の期間行を集約へ復元する", () => {
      const productId = ProductId.generate();
      const aggregate = CostPriceMapper.toDomain(productId.value, [
        { id: VALID_UUID_V7, start: "2026-04-01", end: "2026-10-01", costPrice: "600.00" },
      ]);

      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(1);
      const row = aggregate.periods[0];
      expect(row.period.start).toBe("2026-04-01");
      expect(row.period.end).toBe("2026-10-01");
      expect(row.price.equals(CostUnitPrice.fromMoney(Money.fromMajorUnits(600)))).toBe(true);
    });

    it("上端 unbounded（end=null）を無期限として復元する", () => {
      const productId = ProductId.generate();
      const aggregate = CostPriceMapper.toDomain(productId.value, [
        { id: VALID_UUID_V7, start: "2026-04-01", end: null, costPrice: "600.00" },
      ]);

      expect(aggregate.periods[0].period.end).toBeNull();
    });

    it("10進文字列を float を経由せず厳密に Money へ変換する（銭精度）", () => {
      const productId = ProductId.generate();
      const aggregate = CostPriceMapper.toDomain(productId.value, [
        { id: VALID_UUID_V7, start: "2026-04-01", end: null, costPrice: "1234.56" },
      ]);

      expect(aggregate.periods[0].price.majorUnits).toBe(1234.56);
    });
  });

  describe("toPeriodWriteRows — 集約から書き込み用の素の行", () => {
    it("期間と原価を通貨スケール固定の10進文字列で書き出す", () => {
      const productId = ProductId.generate();
      const aggregate = CostPriceMapper.toDomain(productId.value, [
        { id: VALID_UUID_V7, start: "2026-04-01", end: null, costPrice: "600.00" },
      ]);

      const rows = CostPriceMapper.toPeriodWriteRows(aggregate);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: VALID_UUID_V7,
        productId: productId.value,
        costPrice: "600.00",
        start: "2026-04-01",
        end: null,
      });
    });
  });
});
