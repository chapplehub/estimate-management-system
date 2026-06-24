import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { CommonSellingPricePeriodId } from "../../values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "../../values/SellingUnitPrice";
import { CommonSellingPrice } from "../CommonSellingPrice";

const productId = ProductId.generate();
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("CommonSellingPrice 集約", () => {
  describe("生成", () => {
    it("商品IDで空の集約を生成できる", () => {
      const aggregate = CommonSellingPrice.create(productId);
      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(0);
    });
  });

  describe("addPeriod — 適用期間行の追加", () => {
    it("期間行を追加でき、期間と単価が保持される", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));

      expect(aggregate.periods).toHaveLength(1);
      const row = aggregate.periods[0];
      expect(row.period.equals(period("2025-07-01", "2025-10-01"))).toBe(true);
      expect(row.price.equals(price(1000))).toBe(true);
    });

    it("採番された identity が各行に付与される", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
      aggregate.addPeriod(period("2025-10-01", null), price(1200));

      const [a, b] = aggregate.periods;
      expect(a.id.equals(b.id)).toBe(false);
    });

    it("重ならない期間は複数追加できる（隣接含む）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
      aggregate.addPeriod(period("2025-10-01", null), price(1200));

      expect(aggregate.periods).toHaveLength(2);
    });

    it("既存期間と重複する期間は BusinessRuleViolationError", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));

      expect(() => aggregate.addPeriod(period("2025-09-01", "2025-12-01"), price(1100))).toThrow(
        BusinessRuleViolationError
      );
      // 失敗時は追加されない
      expect(aggregate.periods).toHaveLength(1);
    });

    it("無期限行があるとき、その開始日以降に重なる期間は弾く", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", null), price(1000));

      expect(() => aggregate.addPeriod(period("2030-01-01", "2030-02-01"), price(1100))).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("reconstruct — 永続化からの再構成", () => {
    it("VO記述子から identity を保って再構成できる", () => {
      const id1 = CommonSellingPricePeriodId.generate();
      const id2 = CommonSellingPricePeriodId.generate();
      const aggregate = CommonSellingPrice.reconstruct(productId, [
        { id: id1, period: period("2025-07-01", "2025-10-01"), price: price(1000) },
        { id: id2, period: period("2025-10-01", null), price: price(1200) },
      ]);

      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(2);
      expect(aggregate.periods[0].id.equals(id1)).toBe(true);
      expect(aggregate.periods[1].price.equals(price(1200))).toBe(true);
    });
  });
});
