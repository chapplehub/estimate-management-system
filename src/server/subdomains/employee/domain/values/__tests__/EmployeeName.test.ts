import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EmployeeName } from "../EmployeeName";

describe("EmployeeName 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効な名前でインスタンスを作成できる", () => {
      const name = new EmployeeName("山田太郎");
      expect(name.value).toBe("山田太郎");
    });

    it("1文字の名前が作成できる", () => {
      const name = new EmployeeName("A");
      expect(name.value).toBe("A");
    });

    it("100文字の名前が作成できる", () => {
      const longName = "あ".repeat(100);
      const name = new EmployeeName(longName);
      expect(name.value).toBe(longName);
    });

    it("前後の空白は削除される", () => {
      const name = new EmployeeName("  山田太郎  ");
      expect(name.value).toBe("山田太郎");
    });

    it("同じ名前は等価である", () => {
      const name1 = new EmployeeName("山田太郎");
      const name2 = new EmployeeName("山田太郎");
      expect(name1.equals(name2)).toBe(true);
    });

    it("異なる名前は等価でない", () => {
      const name1 = new EmployeeName("山田太郎");
      const name2 = new EmployeeName("佐藤花子");
      expect(name1.equals(name2)).toBe(false);
    });
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new EmployeeName("")).toThrow(ValidationError);
      expect(() => new EmployeeName("")).toThrow("名前は必須です");
    });

    it("空白のみの場合はエラー", () => {
      expect(() => new EmployeeName("   ")).toThrow(ValidationError);
      expect(() => new EmployeeName("   ")).toThrow("名前は必須です");
    });

    it("101文字の場合はエラー", () => {
      const tooLongName = "あ".repeat(101);
      expect(() => new EmployeeName(tooLongName)).toThrow(ValidationError);
      expect(() => new EmployeeName(tooLongName)).toThrow(
        "名前は100文字以内で入力してください"
      );
    });
  });
});
