import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { EstimateApprovalStep } from "../EstimateApprovalStep";
import { EstimateApprovalStepId } from "../../values/EstimateApprovalStepId";
import { RejectionComment } from "../../values/RejectionComment";
import { StepApproval } from "../../values/StepApproval";
import { StepRejection } from "../../values/StepRejection";

describe("EstimateApprovalStep", () => {
  describe("create() - 生成骨格", () => {
    it("役割・ステップ順を保持し、UUIDv7 の id を採番する", () => {
      const roleId = RoleId.generate();

      const step = EstimateApprovalStep.create(roleId, 1);

      expect(step.roleId.equals(roleId)).toBe(true);
      expect(step.stepOrder).toBe(1);
      expect(step.id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("生成直後は未決定（承認も差戻もない）", () => {
      const step = EstimateApprovalStep.create(RoleId.generate(), 1);

      expect(step.isApproved()).toBe(false);
      expect(step.isRejected()).toBe(false);
      expect(step.isDecided()).toBe(false);
    });
  });

  describe("reconstruct() - 述語", () => {
    it("承認行があれば isApproved/isDecided が true", () => {
      const step = EstimateApprovalStep.reconstruct({
        id: EstimateApprovalStepId.generate(),
        stepOrder: 1,
        roleId: RoleId.generate(),
        approval: StepApproval.create(EmployeeId.generate(), new Date("2026-06-19T09:00:00Z")),
        rejection: null,
      });

      expect(step.isApproved()).toBe(true);
      expect(step.isRejected()).toBe(false);
      expect(step.isDecided()).toBe(true);
    });

    it("差戻行があれば isRejected/isDecided が true", () => {
      const step = EstimateApprovalStep.reconstruct({
        id: EstimateApprovalStepId.generate(),
        stepOrder: 2,
        roleId: RoleId.generate(),
        approval: null,
        rejection: StepRejection.create(
          EmployeeId.generate(),
          new RejectionComment("要修正"),
          new Date("2026-06-19T09:00:00Z")
        ),
      });

      expect(step.isRejected()).toBe(true);
      expect(step.isApproved()).toBe(false);
      expect(step.isDecided()).toBe(true);
    });
  });
});
