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
    const today = "2025-06-01";

    it("期間行を追加でき、期間と単価が保持される", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);

      expect(aggregate.periods).toHaveLength(1);
      const row = aggregate.periods[0];
      expect(row.period.equals(period("2025-07-01", "2025-10-01"))).toBe(true);
      expect(row.price.equals(price(1000))).toBe(true);
    });

    it("採番された identity が各行に付与される", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);

      const [a, b] = aggregate.periods;
      expect(a.id.equals(b.id)).toBe(false);
    });

    it("重ならない期間は複数追加できる（隣接含む）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);

      expect(aggregate.periods).toHaveLength(2);
    });

    it("既存期間と重複する期間は BusinessRuleViolationError", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);

      expect(() =>
        aggregate.addPeriod(period("2025-09-01", "2025-12-01"), price(1100), today)
      ).toThrow(BusinessRuleViolationError);
      // 失敗時は追加されない
      expect(aggregate.periods).toHaveLength(1);
    });

    it("無期限行があるとき、その開始日以降に重なる期間は弾く", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() =>
        aggregate.addPeriod(period("2030-01-01", "2030-02-01"), price(1100), today)
      ).toThrow(BusinessRuleViolationError);
    });

    it("開始日が今日と同じなら追加できる（境界・以上）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period(today, null), price(1000), today);

      expect(aggregate.periods).toHaveLength(1);
    });

    it("開始日が今日より前なら BusinessRuleViolationError（過去への後付け登録を禁止）", () => {
      const aggregate = CommonSellingPrice.create(productId);

      expect(() => aggregate.addPeriod(period("2025-05-31", null), price(1000), today)).toThrow(
        BusinessRuleViolationError
      );
      expect(aggregate.periods).toHaveLength(0);
    });
  });

  describe("editPeriod — 将来行の全項目編集", () => {
    const today = "2025-06-01";

    it("将来行の期間と単価を差し替えられる（identity は保持）", () => {
      const aggregate = CommonSellingPrice.create(productId);
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
      const aggregate = CommonSellingPrice.create(productId);
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
      const aggregate = CommonSellingPrice.create(productId);
      // 今日 ≥ 終了 = 失効
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() =>
        aggregate.editPeriod(id, { period: period("2025-07-01", null), price: price(1500) }, today)
      ).toThrow(BusinessRuleViolationError);
    });

    it("存在しない periodId は BusinessRuleViolationError", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() =>
        aggregate.editPeriod(
          CommonSellingPricePeriodId.generate(),
          { period: period("2025-08-01", null), price: price(1500) },
          today
        )
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe("endDatePeriod — 現在有効行の適用終了", () => {
    const today = "2025-06-01";

    it("現在有効行に終了日を設定でき、開始日・単価は変わらない", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      aggregate.endDatePeriod(id, "2025-09-01", today);

      const row = aggregate.periods[0];
      expect(row.period.equals(period("2025-04-01", "2025-09-01"))).toBe(true);
      expect(row.price.equals(price(1000))).toBe(true);
      expect(row.id.equals(id)).toBe(true);
    });

    it("終了日が今日以前なら不可（過去の被覆を遡及削除させない）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      // 終了日=今日は半開区間 [start, 今日) となり今日が被覆外＝遡及削除になるため不可
      expect(() => aggregate.endDatePeriod(id, today, today)).toThrow(BusinessRuleViolationError);
    });

    it("将来行には適用終了できない（編集で対応する）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("失効行には適用終了できない", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行を既存終了日より後へは延長できない（短縮のみ許可）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      // 既存 end=2025-07-01 を 2025-12-01 へ動かすのは延長＝適用終了の意味に反するため不可
      expect(() => aggregate.endDatePeriod(id, "2025-12-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行で既存終了日と同一の終了日は不可（短縮になっていない）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.endDatePeriod(id, "2025-07-01", today)).toThrow(
        BusinessRuleViolationError
      );
    });

    it("有界の現在有効行を既存終了日より手前へは短縮できる", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", "2025-07-01"), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      aggregate.endDatePeriod(id, "2025-06-15", today);

      expect(aggregate.periods[0].period.equals(period("2025-04-01", "2025-06-15"))).toBe(true);
    });
  });

  describe("deletePeriod — 未来開始行の削除", () => {
    const today = "2025-06-01";

    it("将来行を削除できる（誤入力訂正）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), today);
      aggregate.addPeriod(period("2025-10-01", null), price(1200), today);
      const id = aggregate.periods[0].id;

      aggregate.deletePeriod(id, today);

      expect(aggregate.periods).toHaveLength(1);
      expect(aggregate.periods[0].period.equals(period("2025-10-01", null))).toBe(true);
    });

    it("現在有効行は削除できない（BusinessRuleViolationError）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.deletePeriod(id, today)).toThrow(BusinessRuleViolationError);
      expect(aggregate.periods).toHaveLength(1);
    });

    it("失効行は削除できない（BusinessRuleViolationError）", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-01-01", "2025-04-01"), price(1000), "2024-12-01");
      const id = aggregate.periods[0].id;

      expect(() => aggregate.deletePeriod(id, today)).toThrow(BusinessRuleViolationError);
      expect(aggregate.periods).toHaveLength(1);
    });

    it("存在しない periodId は BusinessRuleViolationError", () => {
      const aggregate = CommonSellingPrice.create(productId);
      aggregate.addPeriod(period("2025-07-01", null), price(1000), today);

      expect(() => aggregate.deletePeriod(CommonSellingPricePeriodId.generate(), today)).toThrow(
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
