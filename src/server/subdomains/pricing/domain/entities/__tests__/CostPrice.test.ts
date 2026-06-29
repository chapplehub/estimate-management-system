import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { CostPricePeriodId } from "../../values/CostPricePeriodId";
import { CostUnitPrice } from "../../values/CostUnitPrice";
import { CostPrice } from "../CostPrice";

const productId = ProductId.generate();
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("CostPrice 集約", () => {
  describe("生成", () => {
    it("商品IDで空の集約を生成できる", () => {
      const aggregate = CostPrice.create(productId);
      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(0);
    });
  });

  describe("addPeriod — 適用期間行の追加", () => {
    it("期間行を追加でき、期間と原価が保持される", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));

      expect(aggregate.periods).toHaveLength(1);
      const row = aggregate.periods[0];
      expect(row.period.equals(period("2026-04-01", "2026-10-01"))).toBe(true);
      expect(row.price.equals(cost(600))).toBe(true);
    });

    it("採番された identity が各行に付与される", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
      aggregate.addPeriod(period("2026-10-01", null), cost(700));

      const [a, b] = aggregate.periods;
      expect(a.id.equals(b.id)).toBe(false);
    });

    it("重ならない期間は複数追加できる（隣接含む）", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
      aggregate.addPeriod(period("2026-10-01", null), cost(700));

      expect(aggregate.periods).toHaveLength(2);
    });

    it("0円の原価も保存できる（非複合品の本物の0）", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", null), cost(0));

      expect(aggregate.periods[0].price.equals(cost(0))).toBe(true);
    });

    it("既存期間と重複する期間は BusinessRuleViolationError", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));

      expect(() => aggregate.addPeriod(period("2026-09-01", "2026-12-01"), cost(650))).toThrow(
        BusinessRuleViolationError
      );
      // 失敗時は追加されない
      expect(aggregate.periods).toHaveLength(1);
    });

    it("無期限行があるとき、その開始日以降に重なる期間は弾く", () => {
      const aggregate = CostPrice.create(productId);
      aggregate.addPeriod(period("2026-04-01", null), cost(600));

      expect(() => aggregate.addPeriod(period("2030-01-01", "2030-02-01"), cost(650))).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("reconstruct — 永続化からの再構成", () => {
    it("VO記述子から identity を保って再構成できる", () => {
      const id1 = CostPricePeriodId.generate();
      const id2 = CostPricePeriodId.generate();
      const aggregate = CostPrice.reconstruct(productId, [
        { id: id1, period: period("2026-04-01", "2026-10-01"), price: cost(600) },
        { id: id2, period: period("2026-10-01", null), price: cost(700) },
      ]);

      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(2);
      expect(aggregate.periods[0].id.equals(id1)).toBe(true);
      expect(aggregate.periods[1].price.equals(cost(700))).toBe(true);
    });
  });
});
