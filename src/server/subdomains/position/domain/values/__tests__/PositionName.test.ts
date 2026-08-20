import { describe, it, expect } from "vitest";
import { PositionName } from "../PositionName";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("PositionName", () => {
  describe("正常系", () => {
    it("役職名を作成できる", () => {
      const name = new PositionName("課長");
      expect(name.value).toBe("課長");
    });

    it("前後の空白はトリムされる", () => {
      const name = new PositionName("  部長  ");
      expect(name.value).toBe("部長");
    });

    it("50文字の役職名を作成できる", () => {
      const longName = "あ".repeat(50);
      const name = new PositionName(longName);
      expect(name.value).toBe(longName);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new PositionName("")).toThrow(ValidationError);
      expect(() => new PositionName("")).toThrow("役職名は必須です");
    });

    it("空白のみはエラー", () => {
      expect(() => new PositionName("   ")).toThrow(ValidationError);
      expect(() => new PositionName("   ")).toThrow("役職名は必須です");
    });

    it("51文字以上はエラー", () => {
      const tooLong = "あ".repeat(51);
      expect(() => new PositionName(tooLong)).toThrow(ValidationError);
      expect(() => new PositionName(tooLong)).toThrow("役職名は50文字以内で入力してください");
    });
  });

  describe("equals", () => {
    it("同じ値の役職名は等しい", () => {
      const name1 = new PositionName("課長");
      const name2 = new PositionName("課長");
      expect(name1.equals(name2)).toBe(true);
    });

    it("異なる値の役職名は等しくない", () => {
      const name1 = new PositionName("課長");
      const name2 = new PositionName("部長");
      expect(name1.equals(name2)).toBe(false);
    });
  });
});
