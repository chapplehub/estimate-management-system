import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { describe, expect, it } from "vitest";
import { RejectionComment } from "../RejectionComment";
import { StepRejection } from "../StepRejection";

describe("StepRejection", () => {
  describe("create()", () => {
    it("差戻者・差戻理由・差戻日時を保持する", () => {
      const rejecter = EmployeeId.generate();
      const comment = new RejectionComment("金額の根拠が不明確です");
      const occurredAt = new Date("2026-06-19T09:00:00Z");

      const rejection = StepRejection.create(rejecter, comment, occurredAt);

      expect(rejection.rejectedByEmployeeId.equals(rejecter)).toBe(true);
      expect(rejection.comment.equals(comment)).toBe(true);
      expect(rejection.occurredAt.getTime()).toBe(occurredAt.getTime());
    });
  });

  describe("equals()", () => {
    it("差戻者・理由・日時がすべて一致すれば等価", () => {
      const rejecter = EmployeeId.generate();
      const occurredAt = new Date("2026-06-19T09:00:00Z");

      const a = StepRejection.create(rejecter, new RejectionComment("要修正"), occurredAt);
      const b = StepRejection.create(
        rejecter,
        new RejectionComment("要修正"),
        new Date("2026-06-19T09:00:00Z")
      );

      expect(a.equals(b)).toBe(true);
    });

    it("差戻理由が異なれば非等価", () => {
      const rejecter = EmployeeId.generate();
      const occurredAt = new Date("2026-06-19T09:00:00Z");
      const a = StepRejection.create(rejecter, new RejectionComment("理由A"), occurredAt);
      const b = StepRejection.create(rejecter, new RejectionComment("理由B"), occurredAt);

      expect(a.equals(b)).toBe(false);
    });
  });
});
