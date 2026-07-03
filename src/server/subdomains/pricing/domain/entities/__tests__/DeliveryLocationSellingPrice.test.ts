import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { DeliveryLocationSellingPricePeriodId } from "../../values/DeliveryLocationSellingPricePeriodId";
import { SellingUnitPrice } from "../../values/SellingUnitPrice";
import { DeliveryLocationSellingPrice } from "../DeliveryLocationSellingPrice";

const deliveryLocationId = DeliveryLocationId.generate();
const productId = ProductId.generate();
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("DeliveryLocationSellingPrice 集約", () => {
  describe("生成", () => {
    it("納品先ID×商品IDで空の集約を生成できる", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      expect(aggregate.deliveryLocationId.equals(deliveryLocationId)).toBe(true);
      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(0);
    });

    it("消耗品でも空の集約を生成できる（価格保守対象商品・#531）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.CONSUMABLE
      );
      expect(aggregate.periods).toHaveLength(0);
    });

    it("セット商品区分では納品先別販売単価集約を生成できない（ValidationError・#531）", () => {
      // 価格を持てない商品（現状はセット商品）は生成入口で拒否する（canHavePrice ガード）。
      expect(() =>
        DeliveryLocationSellingPrice.create(deliveryLocationId, productId, ProductCategory.SET)
      ).toThrow(ValidationError);
    });
  });

  describe("addPeriod — 適用期間行の追加", () => {
    it("期間行を追加でき、期間と単価が保持される", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));

      expect(aggregate.periods).toHaveLength(1);
      const row = aggregate.periods[0];
      expect(row.period.equals(period("2025-07-01", "2025-10-01"))).toBe(true);
      expect(row.price.equals(price(1000))).toBe(true);
    });

    it("採番された identity が各行に付与される", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
      aggregate.addPeriod(period("2025-10-01", null), price(1200));

      const [a, b] = aggregate.periods;
      expect(a.id.equals(b.id)).toBe(false);
    });

    it("重ならない期間は複数追加できる（隣接含む）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
      aggregate.addPeriod(period("2025-10-01", null), price(1200));

      expect(aggregate.periods).toHaveLength(2);
    });

    it("既存期間と重複する期間は BusinessRuleViolationError", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));

      expect(() => aggregate.addPeriod(period("2025-09-01", "2025-12-01"), price(1100))).toThrow(
        BusinessRuleViolationError
      );
      // 失敗時は追加されない
      expect(aggregate.periods).toHaveLength(1);
    });

    it("無期限行があるとき、その開始日以降に重なる期間は弾く", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", null), price(1000));

      expect(() => aggregate.addPeriod(period("2030-01-01", "2030-02-01"), price(1100))).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("reconstruct — 永続化からの再構成", () => {
    it("VO記述子から identity を保って再構成できる", () => {
      const id1 = DeliveryLocationSellingPricePeriodId.generate();
      const id2 = DeliveryLocationSellingPricePeriodId.generate();
      const aggregate = DeliveryLocationSellingPrice.reconstruct(deliveryLocationId, productId, [
        { id: id1, period: period("2025-07-01", "2025-10-01"), price: price(1000) },
        { id: id2, period: period("2025-10-01", null), price: price(1200) },
      ]);

      expect(aggregate.deliveryLocationId.equals(deliveryLocationId)).toBe(true);
      expect(aggregate.productId.equals(productId)).toBe(true);
      expect(aggregate.periods).toHaveLength(2);
      expect(aggregate.periods[0].id.equals(id1)).toBe(true);
      expect(aggregate.periods[1].price.equals(price(1200))).toBe(true);
    });
  });
});
