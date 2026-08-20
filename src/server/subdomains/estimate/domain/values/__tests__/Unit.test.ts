import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Unit } from "../Unit";

describe("Unit", () => {
  describe("正常系", () => {
    it("単位を受け入れる", () => {
      const unit = new Unit("台");
      expect(unit.value).toBe("台");
    });

    it("enum スナップショット文字列も受け入れる", () => {
      const unit = new Unit("UNIT");
      expect(unit.value).toBe("UNIT");
    });

    it("前後の空白はトリムされる", () => {
      const unit = new Unit("  個  ");
      expect(unit.value).toBe("個");
    });

    it("20文字を受け入れる", () => {
      const unit = new Unit("あ".repeat(20));
      expect(unit.value).toBe("あ".repeat(20));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new Unit("")).toThrow(ValidationError);
      expect(() => new Unit("")).toThrow("単位は必須です");
    });

    it("空白のみを拒否する（trim 後に空になるため）", () => {
      expect(() => new Unit("   ")).toThrow(ValidationError);
    });

    it("21文字以上を拒否する", () => {
      expect(() => new Unit("あ".repeat(21))).toThrow(ValidationError);
      expect(() => new Unit("あ".repeat(21))).toThrow("単位は20文字以内で入力してください");
    });
  });
});
