import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { FaultDescription } from "../../values/FaultDescription";
import { RepairEstimateDetailId } from "../../values/RepairEstimateDetailId";
import { RepairEstimateDetail } from "../RepairEstimateDetail";

describe("RepairEstimateDetail", () => {
  describe("create()", () => {
    it("必須項目を指定して作成できる", () => {
      const productId = ProductId.generate();
      const fault = new FaultDescription("コンプレッサー故障");
      const date = new Date("2025-06-01T00:00:00Z");

      const detail = RepairEstimateDetail.create({
        targetProductId: productId,
        faultDescription: fault,
        scheduledRepairDate: date,
      });

      expect(detail.targetProductId).toBe(productId);
      expect(detail.faultDescription).toBe(fault);
      expect(detail.scheduledRepairDate).toBe(date);
      expect(detail.id).toBeInstanceOf(RepairEstimateDetailId);
    });

    it("createdAt と updatedAt が同じ時刻", () => {
      const detail = RepairEstimateDetail.create({
        targetProductId: ProductId.generate(),
        faultDescription: new FaultDescription("故障"),
        scheduledRepairDate: new Date(),
      });
      expect(detail.createdAt.getTime()).toBe(detail.updatedAt.getTime());
    });
  });

  describe("reconstruct()", () => {
    it("永続化値から復元できる", () => {
      const id = RepairEstimateDetailId.generate();
      const detail = RepairEstimateDetail.reconstruct({
        id,
        targetProductId: ProductId.generate(),
        faultDescription: new FaultDescription("故障"),
        scheduledRepairDate: new Date("2025-06-01"),
        createdAt: new Date("2025-05-01"),
        updatedAt: new Date("2025-05-02"),
      });
      expect(detail.id).toBe(id);
    });
  });

  describe("ミューテータ", () => {
    function makeDetail() {
      return RepairEstimateDetail.create({
        targetProductId: ProductId.generate(),
        faultDescription: new FaultDescription("初期故障"),
        scheduledRepairDate: new Date("2025-06-01"),
      });
    }

    it("changeTargetProduct で対象を切り替えられる", async () => {
      const detail = makeDetail();
      const before = detail.updatedAt;
      await new Promise((r) => setTimeout(r, 5));

      const newId = ProductId.generate();
      detail.changeTargetProduct(newId);

      expect(detail.targetProductId).toBe(newId);
      expect(detail.updatedAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it("changeFaultDescription で故障内容を更新できる", () => {
      const detail = makeDetail();
      const updated = new FaultDescription("追加故障");
      detail.changeFaultDescription(updated);
      expect(detail.faultDescription).toBe(updated);
    });

    it("changeScheduledRepairDate で予定日を更新できる", () => {
      const detail = makeDetail();
      const newDate = new Date("2025-07-15");
      detail.changeScheduledRepairDate(newDate);
      expect(detail.scheduledRepairDate).toBe(newDate);
    });
  });
});
