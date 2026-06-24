import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { describe, expect, it } from "vitest";
import { OccurredAt } from "../OccurredAt";
import { StepApproval } from "../StepApproval";

describe("StepApproval", () => {
  describe("create()", () => {
    it("承認者・承認日時を保持する", () => {
      const approver = EmployeeId.generate();
      const occurredAt = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));

      const approval = StepApproval.create(approver, occurredAt);

      expect(approval.approverEmployeeId.equals(approver)).toBe(true);
      expect(approval.occurredAt.equals(occurredAt)).toBe(true);
    });
  });

  describe("equals()", () => {
    it("承認者・承認日時がともに一致すれば等価", () => {
      const approver = EmployeeId.generate();

      const a = StepApproval.create(approver, OccurredAt.from(new Date("2026-06-19T09:00:00Z")));
      const b = StepApproval.create(approver, OccurredAt.from(new Date("2026-06-19T09:00:00Z")));

      expect(a.equals(b)).toBe(true);
    });

    it("承認者が異なれば非等価", () => {
      const occurredAt = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));
      const a = StepApproval.create(EmployeeId.generate(), occurredAt);
      const b = StepApproval.create(EmployeeId.generate(), occurredAt);

      expect(a.equals(b)).toBe(false);
    });

    it("承認日時が異なれば非等価", () => {
      const approver = EmployeeId.generate();
      const a = StepApproval.create(approver, OccurredAt.from(new Date("2026-06-19T09:00:00Z")));
      const b = StepApproval.create(approver, OccurredAt.from(new Date("2026-06-19T10:00:00Z")));

      expect(a.equals(b)).toBe(false);
    });
  });
});
