import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateApprovalStepId } from "../EstimateApprovalStepId";

describe("EstimateApprovalStepId", () => {
  describe("generate()", () => {
    it("UUIDv7 形式の ID を生成する", () => {
      const id = EstimateApprovalStepId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("生成のたびに異なる ID になる", () => {
      expect(EstimateApprovalStepId.generate().equals(EstimateApprovalStepId.generate())).toBe(
        false
      );
    });
  });

  describe("コンストラクタ（永続化復元）", () => {
    it("UUIDv7 文字列から復元できる", () => {
      const value = EstimateApprovalStepId.generate().value;

      expect(new EstimateApprovalStepId(value).value).toBe(value);
    });

    it("不正な形式は拒否する", () => {
      expect(() => new EstimateApprovalStepId("not-a-uuid")).toThrow(ValidationError);
    });
  });
});
