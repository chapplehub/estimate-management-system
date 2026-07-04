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
    const today = "2025-06-01";

    it("期間行を追加でき、期間と単価が保持される", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);

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
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);

      const [a, b] = aggregate.periods;
      expect(a.id.equals(b.id)).toBe(false);
    });

    it("重ならない期間は複数追加できる（隣接含む）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);

      expect(aggregate.periods).toHaveLength(2);
    });

    it("既存期間と重複する期間は BusinessRuleViolationError", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);

      expect(() =>
        aggregate.addPeriod(period("2025-09-01", "2025-12-01"), price(1100), today)
      ).toThrow(BusinessRuleViolationError);
      // 失敗時は追加されない
      expect(aggregate.periods).toHaveLength(1);
    });

    it("無期限行があるとき、その開始日以降に重なる期間は弾く", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() =>
        aggregate.addPeriod(period("2030-01-01", "2030-02-01"), price(1100), today)
      ).toThrow(BusinessRuleViolationError);
    });

    it("開始日が今日と同じなら追加できる（境界・以上）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period(today, null), price(1000), today);

      expect(aggregate.periods).toHaveLength(1);
    });

    it("開始日が今日より前なら BusinessRuleViolationError（過去への後付け登録を禁止）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );

      expect(() => aggregate.addPeriod(period("2025-05-31", null), price(1000), today)).toThrow(
        BusinessRuleViolationError
      );
      expect(aggregate.periods).toHaveLength(0);
    });
  });

  describe("editPeriod — 将来行の全項目編集", () => {
    const today = "2025-06-01";

    it("将来行の期間と単価を差し替えられる（identity は保持）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      const id = aggregate.periods[0].id;

      aggregate.editPeriod(
        id,
        { period: period("2025-08-01", "2025-11-01"), price: price(1500) },
        today
      );

      const row = aggregate.periods[0];
      expect(row.id.equals(id)).toBe(true);
      expect(row.period.equals(period("2025-08-01", "2025-11-01"))).toBe(true);
      expect(row.price.equals(price(1500))).toBe(true);
    });

    it("現在有効行は編集できない（BusinessRuleViolationError・単価ロック）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      // 開始 ≤ 今日 < 終了 = 現在有効
      aggregate.addPeriod(period("2025-05-01", "2025-12-01"), price(1000), "2025-04-01");
      const id = aggregate.periods[0].id;

      expect(() =>
        aggregate.editPeriod(id, { period: period("2025-07-01", null), price: price(1500) }, today)
      ).toThrow(BusinessRuleViolationError);
      // 失敗時は元のまま
      expect(aggregate.periods[0].period.equals(period("2025-05-01", "2025-12-01"))).toBe(true);
      expect(aggregate.periods[0].price.equals(price(1000))).toBe(true);
    });

    it("失効行は編集できない（BusinessRuleViolationError）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      // 今日 ≥ 終了 = 失効
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() =>
        aggregate.editPeriod(id, { period: period("2025-07-01", null), price: price(1500) }, today)
      ).toThrow(BusinessRuleViolationError);
    });

    it("存在しない periodId は BusinessRuleViolationError", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() =>
        aggregate.editPeriod(
          DeliveryLocationSellingPricePeriodId.generate(),
          { period: period("2025-08-01", null), price: price(1500) },
          today
        )
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe("endDatePeriod — 現在有効行の適用終了", () => {
    const today = "2025-06-01";

    it("現在有効行に終了日を設定でき、開始日・単価は変わらない", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      aggregate.endDatePeriod(id, "2025-09-01", today);

      const row = aggregate.periods[0];
      expect(row.period.equals(period("2025-04-01", "2025-09-01"))).toBe(true);
      expect(row.price.equals(price(1000))).toBe(true);
      expect(row.id.equals(id)).toBe(true);
    });

    it("終了日が今日以前なら不可（過去の被覆を遡及削除させない）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, today, today)).toThrow(BusinessRuleViolationError);
    });

    it("将来行には適用終了できない（編集で対応する）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("失効行には適用終了できない", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行を既存終了日より後へは延長できない（短縮のみ許可）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行で既存終了日と同一の終了日は不可（短縮になっていない）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-07-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行を既存終了日より手前へは短縮できる", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      aggregate.endDatePeriod(id, "2025-06-15", today);

      expect(aggregate.periods[0].period.equals(period("2025-04-01", "2025-06-15"))).toBe(true);
    });

    it("実在しない日付の終了日は形式エラー（短縮判定より前に弾く）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "9999-99-99", today)).toThrow(ValidationError);
    });

    it("空文字の終了日は形式エラー（今日比較より前に弾く）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "", today)).toThrow(ValidationError);
    });
  });

  describe("deletePeriod — 未来開始行の削除", () => {
    const today = "2025-06-01";

    it("将来行を削除できる（誤入力訂正）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);
      const id = aggregate.periods[0].id;

      aggregate.deletePeriod(id, today);

      expect(aggregate.periods).toHaveLength(1);
      expect(aggregate.periods[0].period.equals(period("2025-10-01", null))).toBe(true);
    });

    it("現在有効行は削除できない（BusinessRuleViolationError）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.deletePeriod(id, today)).toThrow(BusinessRuleViolationError);
      expect(aggregate.periods).toHaveLength(1);
    });

    it("失効行は削除できない（BusinessRuleViolationError）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.deletePeriod(id, today)).toThrow(BusinessRuleViolationError);
      expect(aggregate.periods).toHaveLength(1);
    });

    it("存在しない periodId は BusinessRuleViolationError", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() =>
        aggregate.deletePeriod(DeliveryLocationSellingPricePeriodId.generate(), today)
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe("currentValidPeriod — 現在有効行の照会", () => {
    const today = "2025-06-01";

    it("現在有効行（開始 ≤ 今日 < 終了）を返す", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", "2025-12-01"), price(1000), "2025-03-01");

      const row = aggregate.currentValidPeriod(today);

      expect(row).toBeDefined();
      expect(row?.period.equals(period("2025-04-01", "2025-12-01"))).toBe(true);
      expect(row?.price.equals(price(1000))).toBe(true);
    });

    it("無期限の現在有効行（開始 ≤ 今日・終了なし）を返す", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");

      const row = aggregate.currentValidPeriod(today);

      expect(row?.period.equals(period("2025-04-01", null))).toBe(true);
    });

    it("現在有効行が無ければ undefined（将来行・失効行のみ）", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01"); // 失効
      aggregate.addPeriod(period("2025-07-01", null), price(1200), today); // 将来

      expect(aggregate.currentValidPeriod(today)).toBeUndefined();
    });

    it("空集約では undefined", () => {
      const aggregate = DeliveryLocationSellingPrice.create(
        deliveryLocationId,
        productId,
        ProductCategory.INDIVIDUAL
      );
      expect(aggregate.currentValidPeriod(today)).toBeUndefined();
    });
  });

  describe("isEmpty — 空集約の判定", () => {
    it("期間行が0件なら true（未設定＝空集約シェル）", () => {
      const aggregate = DeliveryLocationSellingPrice.reconstruct(deliveryLocationId, productId, []);
      expect(aggregate.isEmpty).toBe(true);
    });

    it("期間行が1件以上あれば false", () => {
      const aggregate = DeliveryLocationSellingPrice.reconstruct(deliveryLocationId, productId, [
        {
          id: DeliveryLocationSellingPricePeriodId.generate(),
          period: period("2025-07-01", null),
          price: price(1000),
        },
      ]);
      expect(aggregate.isEmpty).toBe(false);
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
