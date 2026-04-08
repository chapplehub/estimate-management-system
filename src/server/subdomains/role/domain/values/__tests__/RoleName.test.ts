import { describe, it, expect } from "vitest";
import { RoleName } from "../RoleName";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("RoleName", () => {
  describe("正常系", () => {
    it("役割名を作成できる", () => {
      const name = new RoleName("大阪市南課長");
      expect(name.value).toBe("大阪市南課長");
    });

    it("前後の空白はトリムされる", () => {
      const name = new RoleName("  営業部長  ");
      expect(name.value).toBe("営業部長");
    });

    it("100文字の役割名を作成できる", () => {
      const longName = "あ".repeat(100);
      const name = new RoleName(longName);
      expect(name.value).toBe(longName);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new RoleName("")).toThrow(ValidationError);
      expect(() => new RoleName("")).toThrow("役割名は必須です");
    });

    it("空白のみはエラー", () => {
      expect(() => new RoleName("   ")).toThrow(ValidationError);
      expect(() => new RoleName("   ")).toThrow("役割名は必須です");
    });

    it("101文字以上はエラー", () => {
      const tooLong = "あ".repeat(101);
      expect(() => new RoleName(tooLong)).toThrow(ValidationError);
      expect(() => new RoleName(tooLong)).toThrow("役割名は100文字以内で入力してください");
    });
  });

  describe("equals", () => {
    it("同じ値の役割名は等しい", () => {
      const name1 = new RoleName("大阪市南課長");
      const name2 = new RoleName("大阪市南課長");
      expect(name1.equals(name2)).toBe(true);
    });

    it("異なる値の役割名は等しくない", () => {
      const name1 = new RoleName("大阪市南課長");
      const name2 = new RoleName("営業部長");
      expect(name1.equals(name2)).toBe(false);
    });
  });
});
