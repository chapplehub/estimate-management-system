import { describe, expect, it } from "vitest";
import { Money } from "../../values/Money";
import { RevisedEstimateItemDetailId } from "../../values/RevisedEstimateItemDetailId";
import { RevisedEstimateItemDetail } from "../RevisedEstimateItemDetail";

describe("RevisedEstimateItemDetail", () => {
  describe("create()", () => {
    it("配送価格を指定して新規作成できる", () => {
      const price = Money.fromMajorUnits(1500);
      const detail = RevisedEstimateItemDetail.create(price);

      expect(detail.deliveryPrice.equals(price)).toBe(true);
      expect(detail.id).toBeInstanceOf(RevisedEstimateItemDetailId);
    });

    it("createdAt と updatedAt が同じ時刻で初期化される", () => {
      const detail = RevisedEstimateItemDetail.create(Money.fromMajorUnits(1000));
      expect(detail.createdAt.getTime()).toBe(detail.updatedAt.getTime());
    });

    it("ゼロ円の配送価格を受け入れる（販促・無償改訂の表現）", () => {
      const detail = RevisedEstimateItemDetail.create(Money.zero());
      expect(detail.deliveryPrice.isZero()).toBe(true);
    });
  });

  describe("reconstruct()", () => {
    it("永続化値から復元できる", () => {
      const id = RevisedEstimateItemDetailId.generate();
      const price = Money.fromMajorUnits(2000);
      const createdAt = new Date("2025-01-01T00:00:00Z");
      const updatedAt = new Date("2025-01-02T00:00:00Z");

      const detail = RevisedEstimateItemDetail.reconstruct(id, price, createdAt, updatedAt);

      expect(detail.id).toBe(id);
      expect(detail.deliveryPrice.equals(price)).toBe(true);
      expect(detail.createdAt).toBe(createdAt);
      expect(detail.updatedAt).toBe(updatedAt);
    });
  });

  describe("changeDeliveryPrice()", () => {
    it("配送価格を変更できる", () => {
      const detail = RevisedEstimateItemDetail.create(Money.fromMajorUnits(1000));
      const newPrice = Money.fromMajorUnits(1200);

      detail.changeDeliveryPrice(newPrice);

      expect(detail.deliveryPrice.equals(newPrice)).toBe(true);
    });

    it("変更時に updatedAt が更新される", async () => {
      const detail = RevisedEstimateItemDetail.create(Money.fromMajorUnits(1000));
      const beforeUpdatedAt = detail.updatedAt;

      // 時刻差を確実に出すために少し待つ
      await new Promise((resolve) => setTimeout(resolve, 5));
      detail.changeDeliveryPrice(Money.fromMajorUnits(1200));

      expect(detail.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
    });

    it("createdAt は変更時に変わらない", async () => {
      const detail = RevisedEstimateItemDetail.create(Money.fromMajorUnits(1000));
      const originalCreatedAt = detail.createdAt;

      await new Promise((resolve) => setTimeout(resolve, 5));
      detail.changeDeliveryPrice(Money.fromMajorUnits(2000));

      expect(detail.createdAt).toBe(originalCreatedAt);
    });
  });
});
