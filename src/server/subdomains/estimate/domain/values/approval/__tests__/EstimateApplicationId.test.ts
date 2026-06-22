import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateApplicationId } from "../EstimateApplicationId";

describe("EstimateApplicationId", () => {
  describe("generate()", () => {
    it("UUIDv7 形式の ID を生成する", () => {
      const id = EstimateApplicationId.generate();

      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("生成のたびに異なる ID になる", () => {
      const a = EstimateApplicationId.generate();
      const b = EstimateApplicationId.generate();

      expect(a.equals(b)).toBe(false);
    });
  });

  describe("コンストラクタ（永続化復元）", () => {
    it("UUIDv7 文字列から復元できる", () => {
      const value = EstimateApplicationId.generate().value;

      const id = new EstimateApplicationId(value);

      expect(id.value).toBe(value);
    });

    it("不正な形式は拒否する", () => {
      expect(() => new EstimateApplicationId("not-a-uuid")).toThrow(ValidationError);
    });
  });

  describe("equals()", () => {
    it("同じ値なら等価", () => {
      const value = EstimateApplicationId.generate().value;

      expect(new EstimateApplicationId(value).equals(new EstimateApplicationId(value))).toBe(true);
    });
  });
});
