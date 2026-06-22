import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { describe, expect, it } from "vitest";
import { EstimateApprovalExemption } from "../EstimateApprovalExemption";
import { EstimateApprovalExemptionId } from "../../values/approval/EstimateApprovalExemptionId";
import { EstimateExemptionReason } from "../../values/approval/EstimateExemptionReason";
import { EstimateVariationId } from "../../values/EstimateVariationId";

describe("EstimateApprovalExemption", () => {
  describe("create()", () => {
    it("バリエーション・免除理由・免除実施者を保持する", () => {
      const variationId = EstimateVariationId.generate();
      const exemptedBy = EmployeeId.generate();

      const exemption = EstimateApprovalExemption.create(
        variationId,
        EstimateExemptionReason.CONSUMABLE_ONLY,
        exemptedBy
      );

      expect(exemption.variationId.equals(variationId)).toBe(true);
      expect(exemption.reason.equals(EstimateExemptionReason.CONSUMABLE_ONLY)).toBe(true);
      expect(exemption.exemptedByEmployeeId.equals(exemptedBy)).toBe(true);
    });

    it("UUIDv7 形式の id を採番する", () => {
      const exemption = EstimateApprovalExemption.create(
        EstimateVariationId.generate(),
        EstimateExemptionReason.BELOW_THRESHOLD,
        EmployeeId.generate()
      );

      expect(exemption.id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("免除日時（createdAt）を設定する", () => {
      const exemption = EstimateApprovalExemption.create(
        EstimateVariationId.generate(),
        EstimateExemptionReason.AFTER_REPAIR,
        EmployeeId.generate()
      );

      expect(exemption.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("reconstruct()", () => {
    it("永続化された全フィールドを復元する", () => {
      const id = EstimateApprovalExemptionId.generate();
      const variationId = EstimateVariationId.generate();
      const exemptedBy = EmployeeId.generate();
      const createdAt = new Date("2026-06-19T09:00:00Z");

      const exemption = EstimateApprovalExemption.reconstruct({
        id,
        variationId,
        reason: EstimateExemptionReason.BELOW_THRESHOLD,
        exemptedByEmployeeId: exemptedBy,
        createdAt,
      });

      expect(exemption.id.equals(id)).toBe(true);
      expect(exemption.variationId.equals(variationId)).toBe(true);
      expect(exemption.reason.equals(EstimateExemptionReason.BELOW_THRESHOLD)).toBe(true);
      expect(exemption.exemptedByEmployeeId.equals(exemptedBy)).toBe(true);
      expect(exemption.createdAt.getTime()).toBe(createdAt.getTime());
    });
  });
});
