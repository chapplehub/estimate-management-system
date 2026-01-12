import { describe, it, expect } from "vitest";
import { Abbreviation } from "../Abbreviation";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("Abbreviation", () => {
  describe("正常系", () => {
    it("略称を作成できる", () => {
      const abbr = new Abbreviation("営業");
      expect(abbr.value).toBe("営業");
    });

    it("前後の空白はトリムされる", () => {
      const abbr = new Abbreviation("  営業  ");
      expect(abbr.value).toBe("営業");
    });

    it("1文字の略称を作成できる", () => {
      const abbr = new Abbreviation("営");
      expect(abbr.value).toBe("営");
    });

    it("20文字の略称を作成できる", () => {
      const longAbbr = "あ".repeat(20);
      const abbr = new Abbreviation(longAbbr);
      expect(abbr.value).toBe(longAbbr);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new Abbreviation("")).toThrow(ValidationError);
      expect(() => new Abbreviation("")).toThrow("部署略称は必須です");
    });

    it("空白のみはエラー", () => {
      expect(() => new Abbreviation("   ")).toThrow(ValidationError);
    });

    it("21文字以上はエラー", () => {
      const longAbbr = "あ".repeat(21);
      expect(() => new Abbreviation(longAbbr)).toThrow(ValidationError);
      expect(() => new Abbreviation(longAbbr)).toThrow(
        "部署略称は20文字以内で入力してください"
      );
    });
  });

  describe("equals", () => {
    it("同じ値の略称は等しい", () => {
      const abbr1 = new Abbreviation("営業");
      const abbr2 = new Abbreviation("営業");
      expect(abbr1.equals(abbr2)).toBe(true);
    });

    it("異なる値の略称は等しくない", () => {
      const abbr1 = new Abbreviation("営業");
      const abbr2 = new Abbreviation("総務");
      expect(abbr1.equals(abbr2)).toBe(false);
    });
  });
});
