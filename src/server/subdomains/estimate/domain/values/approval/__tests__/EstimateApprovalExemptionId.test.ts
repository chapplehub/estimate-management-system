import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateApprovalExemptionId } from "../EstimateApprovalExemptionId";

describe("EstimateApprovalExemptionId", () => {
  describe("generate()", () => {
    it("UUIDv7 形式の ID を生成する", () => {
      const id = EstimateApprovalExemptionId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("生成のたびに異なる ID になる", () => {
      expect(
        EstimateApprovalExemptionId.generate().equals(EstimateApprovalExemptionId.generate())
      ).toBe(false);
    });
  });

  describe("コンストラクタ（永続化復元）", () => {
    it("UUIDv7 文字列から復元できる", () => {
      const value = EstimateApprovalExemptionId.generate().value;

      expect(new EstimateApprovalExemptionId(value).value).toBe(value);
    });

    it("不正な形式は拒否する", () => {
      expect(() => new EstimateApprovalExemptionId("not-a-uuid")).toThrow(ValidationError);
    });
  });
});
