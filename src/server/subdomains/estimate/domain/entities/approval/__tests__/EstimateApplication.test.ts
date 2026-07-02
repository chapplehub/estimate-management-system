import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { EstimateApplication } from "../EstimateApplication";
import { ApplicationStatus } from "../../../values/approval/ApplicationStatus";
import { ApprovalChainPlan } from "../../../values/approval/ApprovalChainPlan";
import { ApprovalStepStatus } from "../../../values/approval/ApprovalStepStatus";
import { EstimateApprovalStepId } from "../../../values/approval/EstimateApprovalStepId";
import { EstimateVariationId } from "../../../values/EstimateVariationId";
import { RejectionComment } from "../../../values/approval/RejectionComment";

const buildPlan = (roleIds = [RoleId.generate()], goal = PositionId.generate()) =>
  ApprovalChainPlan.create(goal, roleIds);

const buildApp = (stepCount: number) =>
  EstimateApplication.create({
    variationId: EstimateVariationId.generate(),
    attempt: 1,
    applicantEmployeeId: EmployeeId.generate(),
    plan: buildPlan(Array.from({ length: stepCount }, () => RoleId.generate())),
  });

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

  describe("状態導出（§3.6）- 初期状態", () => {
    it("申請は PENDING、先頭ステップのみ AWAITING・残りは NOT_STARTED", () => {
      const app = buildApp(3);

      expect(app.applicationStatus.equals(ApplicationStatus.PENDING)).toBe(true);
      expect(app.stepStatus(app.steps[0].id).equals(ApprovalStepStatus.AWAITING)).toBe(true);
      expect(app.stepStatus(app.steps[1].id).equals(ApprovalStepStatus.NOT_STARTED)).toBe(true);
      expect(app.stepStatus(app.steps[2].id).equals(ApprovalStepStatus.NOT_STARTED)).toBe(true);
    });
  });

  describe("approve()", () => {
    it("先頭ステップを承認すると当該は APPROVED・次が AWAITING に前進する", () => {
      const app = buildApp(3);

      app.approve(app.steps[0].id, EmployeeId.generate());

      expect(app.stepStatus(app.steps[0].id).equals(ApprovalStepStatus.APPROVED)).toBe(true);
      expect(app.stepStatus(app.steps[1].id).equals(ApprovalStepStatus.AWAITING)).toBe(true);
      expect(app.applicationStatus.equals(ApplicationStatus.PENDING)).toBe(true);
    });

    it("全ステップを順に承認すると申請が APPROVED になる", () => {
      const app = buildApp(2);

      app.approve(app.steps[0].id, EmployeeId.generate());
      app.approve(app.steps[1].id, EmployeeId.generate());

      expect(app.applicationStatus.equals(ApplicationStatus.APPROVED)).toBe(true);
      expect(app.steps.every((s) => s.isApproved())).toBe(true);
    });

    it("1ステップ申請は先頭承認だけで APPROVED（常に最低1段・ADR-0003）", () => {
      const app = buildApp(1);

      app.approve(app.steps[0].id, EmployeeId.generate());

      expect(app.applicationStatus.equals(ApplicationStatus.APPROVED)).toBe(true);
    });

    it("AWAITING でないステップ（後続）の承認は拒否する", () => {
      const app = buildApp(2);

      expect(() => app.approve(app.steps[1].id, EmployeeId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });

    it("既に承認済みのステップの再承認は拒否する", () => {
      const app = buildApp(2);
      app.approve(app.steps[0].id, EmployeeId.generate());

      expect(() => app.approve(app.steps[0].id, EmployeeId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });

    it("この申請に属さない stepId は拒否する", () => {
      const app = buildApp(1);

      expect(() => app.approve(EstimateApprovalStepId.generate(), EmployeeId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("reject()", () => {
    it("差戻すと当該ステップは REJECTED・申請は REJECTED になる", () => {
      const app = buildApp(2);

      app.reject(app.steps[0].id, EmployeeId.generate(), new RejectionComment("金額の根拠不明"));

      expect(app.stepStatus(app.steps[0].id).equals(ApprovalStepStatus.REJECTED)).toBe(true);
      expect(app.applicationStatus.equals(ApplicationStatus.REJECTED)).toBe(true);
    });

    it("AWAITING でないステップの差戻は拒否する", () => {
      const app = buildApp(2);

      expect(() =>
        app.reject(app.steps[1].id, EmployeeId.generate(), new RejectionComment("不可"))
      ).toThrow(BusinessRuleViolationError);
    });

    it("差戻後は後続ステップを承認できない（申請が PENDING でないため）", () => {
      const app = buildApp(2);
      app.reject(app.steps[0].id, EmployeeId.generate(), new RejectionComment("差戻"));

      expect(() => app.approve(app.steps[1].id, EmployeeId.generate())).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("withdraw()", () => {
    it("取下げると申請は WITHDRAWN になる（最優先）", () => {
      const app = buildApp(2);

      app.withdraw(app.applicantEmployeeId);

      expect(app.applicationStatus.equals(ApplicationStatus.WITHDRAWN)).toBe(true);
      expect(app.withdrawal).not.toBeNull();
    });

    it("一部承認済みでも取下できる（PENDING の間）", () => {
      const app = buildApp(2);
      app.approve(app.steps[0].id, EmployeeId.generate());

      app.withdraw(app.applicantEmployeeId);

      expect(app.applicationStatus.equals(ApplicationStatus.WITHDRAWN)).toBe(true);
    });

    it("既に取下済みの申請の再取下は拒否する", () => {
      const app = buildApp(1);
      app.withdraw(app.applicantEmployeeId);

      expect(() => app.withdraw(app.applicantEmployeeId)).toThrow(BusinessRuleViolationError);
    });

    it("承認完了済み（PENDING でない）の取下は拒否する", () => {
      const app = buildApp(1);
      app.approve(app.steps[0].id, EmployeeId.generate());

      expect(() => app.withdraw(app.applicantEmployeeId)).toThrow(BusinessRuleViolationError);
    });

    it("申請者本人でない従業員による取下は拒否する（§7.3）", () => {
      const app = buildApp(2);

      expect(() => app.withdraw(EmployeeId.generate())).toThrow(BusinessRuleViolationError);
      expect(app.withdrawal).toBeNull();
    });
  });
});
