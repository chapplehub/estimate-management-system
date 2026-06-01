import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { AfterRepairEstimateDetailId } from "../../values/AfterRepairEstimateDetailId";
import { EmergencyReason } from "../../values/EmergencyReason";
import { FaultDescription } from "../../values/FaultDescription";
import { AfterRepairEstimateDetail } from "../AfterRepairEstimateDetail";

function makeDetail(): AfterRepairEstimateDetail {
  return AfterRepairEstimateDetail.create({
    targetProductId: ProductId.generate(),
    faultDescription: new FaultDescription("実施済み修理: コンプレッサー交換"),
    actualRepairDate: new Date("2025-05-20T10:00:00Z"),
    emergencyReason: new EmergencyReason("夜間の業務停止につき緊急対応"),
  });
}

describe("AfterRepairEstimateDetail", () => {
  describe("create()", () => {
    it("初期化時 afterServiceWarningAcknowledged は false", () => {
      const detail = makeDetail();
      expect(detail.afterServiceWarningAcknowledged).toBe(false);
    });

    it("ID が自動生成される", () => {
      const detail = makeDetail();
      expect(detail.id).toBeInstanceOf(AfterRepairEstimateDetailId);
    });

    it("createdAt と updatedAt が同じ時刻", () => {
      const detail = makeDetail();
      expect(detail.createdAt.getTime()).toBe(detail.updatedAt.getTime());
    });
  });

  describe("reconstruct()", () => {
    it("永続化値から復元できる（warning フラグ含む）", () => {
      const detail = AfterRepairEstimateDetail.reconstruct({
        id: AfterRepairEstimateDetailId.generate(),
        targetProductId: ProductId.generate(),
        faultDescription: new FaultDescription("故障"),
        actualRepairDate: new Date("2025-05-20"),
        emergencyReason: new EmergencyReason("緊急"),
        afterServiceWarningAcknowledged: true,
        createdAt: new Date("2025-05-01"),
        updatedAt: new Date("2025-05-02"),
      });
      expect(detail.afterServiceWarningAcknowledged).toBe(true);
    });
  });

  describe("ミューテータ", () => {
    it("changeTargetProduct で対象を切り替えられる", () => {
      const detail = makeDetail();
      const newId = ProductId.generate();
      detail.changeTargetProduct(newId);
      expect(detail.targetProductId).toBe(newId);
    });

    it("changeEmergencyReason で緊急理由を更新できる", () => {
      const detail = makeDetail();
      const newReason = new EmergencyReason("追加で発生した緊急事態");
      detail.changeEmergencyReason(newReason);
      expect(detail.emergencyReason).toBe(newReason);
    });
  });

  describe("acknowledgeWarning() — §6.3 10万円超警告の確認", () => {
    it("false → true への単方向遷移", () => {
      const detail = makeDetail();
      expect(detail.afterServiceWarningAcknowledged).toBe(false);

      detail.acknowledgeWarning();

      expect(detail.afterServiceWarningAcknowledged).toBe(true);
    });

    it("既に確認済みでも再度呼んでも問題ない（冪等）", () => {
      const detail = makeDetail();
      detail.acknowledgeWarning();
      detail.acknowledgeWarning();
      expect(detail.afterServiceWarningAcknowledged).toBe(true);
    });

    it("acknowledgeWarning で updatedAt が更新される", async () => {
      const detail = makeDetail();
      const before = detail.updatedAt;
      await new Promise((r) => setTimeout(r, 5));

      detail.acknowledgeWarning();

      expect(detail.updatedAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it("取り下げ（true → false）の API は提供されない（コンパイル時保証）", () => {
      // 取り下げメソッドが意図的に存在しないことの記録テスト。
      const detail = makeDetail();
      detail.acknowledgeWarning();
      // @ts-expect-error: 取り下げメソッドは設計上提供しない
      expect(detail.revokeAcknowledgement).toBeUndefined();
    });
  });
});
