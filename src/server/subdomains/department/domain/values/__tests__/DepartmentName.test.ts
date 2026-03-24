import { describe, it, expect } from "vitest";
import { DepartmentName } from "../DepartmentName";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("DepartmentName", () => {
  describe("正常系", () => {
    it("部署名を作成できる", () => {
      const name = new DepartmentName("営業部");
      expect(name.value).toBe("営業部");
    });

    it("前後の空白はトリムされる", () => {
      const name = new DepartmentName("  営業部  ");
      expect(name.value).toBe("営業部");
    });

    it("1文字の部署名を作成できる", () => {
      const name = new DepartmentName("部");
      expect(name.value).toBe("部");
    });

    it("100文字の部署名を作成できる", () => {
      const longName = "あ".repeat(100);
      const name = new DepartmentName(longName);
      expect(name.value).toBe(longName);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new DepartmentName("")).toThrow(ValidationError);
      expect(() => new DepartmentName("")).toThrow("部署名は必須です");
    });

    it("空白のみはエラー", () => {
      expect(() => new DepartmentName("   ")).toThrow(ValidationError);
    });

    it("101文字以上はエラー", () => {
      const longName = "あ".repeat(101);
      expect(() => new DepartmentName(longName)).toThrow(ValidationError);
      expect(() => new DepartmentName(longName)).toThrow("部署名は100文字以内で入力してください");
    });
  });

  describe("equals", () => {
    it("同じ値の部署名は等しい", () => {
      const name1 = new DepartmentName("営業部");
      const name2 = new DepartmentName("営業部");
      expect(name1.equals(name2)).toBe(true);
    });

    it("異なる値の部署名は等しくない", () => {
      const name1 = new DepartmentName("営業部");
      const name2 = new DepartmentName("総務部");
      expect(name1.equals(name2)).toBe(false);
    });
  });
});
