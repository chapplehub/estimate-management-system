import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { EstimateApplication } from "../EstimateApplication";
import { ApprovalChainPlan } from "../../values/ApprovalChainPlan";
import { EstimateVariationId } from "../../values/EstimateVariationId";

const buildPlan = (roleIds = [RoleId.generate()], goal = PositionId.generate()) =>
  ApprovalChainPlan.create(goal, roleIds);

describe("EstimateApplication", () => {
  describe("create() - 申請の事前生成（§6.3 / §12）", () => {
    it("申請の属性を保持する", () => {
      const variationId = EstimateVariationId.generate();
      const applicant = EmployeeId.generate();
      const goal = PositionId.generate();

      const application = EstimateApplication.create({
        variationId,
        attempt: 1,
        applicantEmployeeId: applicant,
        plan: buildPlan([RoleId.generate()], goal),
      });

      expect(application.variationId.equals(variationId)).toBe(true);
      expect(application.attempt).toBe(1);
      expect(application.applicantEmployeeId.equals(applicant)).toBe(true);
      expect(application.finalApprovalPositionId.equals(goal)).toBe(true);
      expect(application.id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("計画の役割列から全ステップを事前生成し、stepOrder を 1 始まりの連番で付ける", () => {
      const role1 = RoleId.generate();
      const role2 = RoleId.generate();
      const role3 = RoleId.generate();

      const application = EstimateApplication.create({
        variationId: EstimateVariationId.generate(),
        attempt: 1,
        applicantEmployeeId: EmployeeId.generate(),
        plan: buildPlan([role1, role2, role3]),
      });

      expect(application.steps).toHaveLength(3);
      expect(application.steps.map((s) => s.stepOrder)).toEqual([1, 2, 3]);
      expect(application.steps[0].roleId.equals(role1)).toBe(true);
      expect(application.steps[1].roleId.equals(role2)).toBe(true);
      expect(application.steps[2].roleId.equals(role3)).toBe(true);
    });

    it("生成直後は取下されていない", () => {
      const application = EstimateApplication.create({
        variationId: EstimateVariationId.generate(),
        attempt: 1,
        applicantEmployeeId: EmployeeId.generate(),
        plan: buildPlan(),
      });

      expect(application.withdrawal).toBeNull();
    });

    it("各ステップは生成直後すべて未決定", () => {
      const application = EstimateApplication.create({
        variationId: EstimateVariationId.generate(),
        attempt: 2,
        applicantEmployeeId: EmployeeId.generate(),
        plan: buildPlan([RoleId.generate(), RoleId.generate()]),
      });

      expect(application.steps.every((s) => !s.isDecided())).toBe(true);
    });
  });

  describe("steps の不変性", () => {
    it("取得した配列を破壊しても内部状態は変わらない", () => {
      const application = EstimateApplication.create({
        variationId: EstimateVariationId.generate(),
        attempt: 1,
        applicantEmployeeId: EmployeeId.generate(),
        plan: buildPlan([RoleId.generate()]),
      });

      const steps = application.steps as unknown[];
      steps.pop();

      expect(application.steps).toHaveLength(1);
    });
  });
});
