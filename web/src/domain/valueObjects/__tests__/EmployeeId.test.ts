import { ValidationError } from "@/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EmployeeId } from "../EmployeeId";

describe("EmployeeId 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効な社員番号でインスタンスを作成できる", () => {
      const empId = new EmployeeId("EMP000001");
      expect(empId.value).toBe("EMP000001");
    });

    it("最小値（EMP000001）が作成できる", () => {
      const empId = new EmployeeId("EMP000001");
      expect(empId.value).toBe("EMP000001");
    });

    it("最大値（EMP999999）が作成できる", () => {
      const empId = new EmployeeId("EMP999999");
      expect(empId.value).toBe("EMP999999");
    });

    it("小文字のempも大文字に正規化される", () => {
      const empId = new EmployeeId("emp000001");
      expect(empId.value).toBe("EMP000001");
    });

    it("前後の空白は削除される", () => {
      const empId = new EmployeeId("  EMP000001  ");
      expect(empId.value).toBe("EMP000001");
    });

    it("同じ社員番号は等価である", () => {
      const empId1 = new EmployeeId("EMP000001");
      const empId2 = new EmployeeId("EMP000001");
      expect(empId1.equals(empId2)).toBe(true);
    });

    it("異なる社員番号は等価でない", () => {
      const empId1 = new EmployeeId("EMP000001");
      const empId2 = new EmployeeId("EMP000002");
      expect(empId1.equals(empId2)).toBe(false);
    });

    it("数値部分を取得できる", () => {
      const empId = new EmployeeId("EMP000123");
      expect(empId.numericPart).toBe(123);
    });
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new EmployeeId("")).toThrow(ValidationError);
      expect(() => new EmployeeId("")).toThrow("社員番号は必須です");
    });

    it("EMP で始まらない場合はエラー", () => {
      expect(() => new EmployeeId("ABC000001")).toThrow(ValidationError);
      expect(() => new EmployeeId("ABC000001")).toThrow(
        "社員番号は EMP で始まる必要があります"
      );
    });

    it("数値部分が6桁でない場合はエラー（5桁）", () => {
      expect(() => new EmployeeId("EMP00001")).toThrow(ValidationError);
      expect(() => new EmployeeId("EMP00001")).toThrow(
        "社員番号は EMP + 6桁の数字である必要があります"
      );
    });

    it("数値部分が6桁でない場合はエラー（7桁）", () => {
      expect(() => new EmployeeId("EMP0000001")).toThrow(ValidationError);
    });

    it("数値部分が数字でない場合はエラー", () => {
      expect(() => new EmployeeId("EMP00000A")).toThrow(ValidationError);
      expect(() => new EmployeeId("EMP00000A")).toThrow(
        "社員番号は EMP + 6桁の数字である必要があります"
      );
    });

    it("EMP000000（ゼロ埋めのゼロ）はエラー", () => {
      expect(() => new EmployeeId("EMP000000")).toThrow(ValidationError);
      expect(() => new EmployeeId("EMP000000")).toThrow(
        "社員番号は 1 以上である必要があります"
      );
    });

    it("形式が完全に間違っている場合はエラー", () => {
      expect(() => new EmployeeId("invalid")).toThrow(ValidationError);
    });
  });
});
