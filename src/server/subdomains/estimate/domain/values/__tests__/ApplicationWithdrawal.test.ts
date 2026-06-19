import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { describe, expect, it } from "vitest";
import { ApplicationWithdrawal } from "../ApplicationWithdrawal";

describe("ApplicationWithdrawal", () => {
  describe("create()", () => {
    it("取下者・取下日時を保持する", () => {
      const withdrawnBy = EmployeeId.generate();
      const occurredAt = new Date("2026-06-19T09:00:00Z");

      const withdrawal = ApplicationWithdrawal.create(withdrawnBy, occurredAt);

      expect(withdrawal.withdrawnByEmployeeId.equals(withdrawnBy)).toBe(true);
      expect(withdrawal.occurredAt.getTime()).toBe(occurredAt.getTime());
    });
  });

  describe("equals()", () => {
    it("取下者・取下日時がともに一致すれば等価", () => {
      const withdrawnBy = EmployeeId.generate();
      const occurredAt = new Date("2026-06-19T09:00:00Z");

      const a = ApplicationWithdrawal.create(withdrawnBy, occurredAt);
      const b = ApplicationWithdrawal.create(withdrawnBy, new Date("2026-06-19T09:00:00Z"));

      expect(a.equals(b)).toBe(true);
    });

    it("取下者が異なれば非等価", () => {
      const occurredAt = new Date("2026-06-19T09:00:00Z");
      const a = ApplicationWithdrawal.create(EmployeeId.generate(), occurredAt);
      const b = ApplicationWithdrawal.create(EmployeeId.generate(), occurredAt);

      expect(a.equals(b)).toBe(false);
    });
  });
});
