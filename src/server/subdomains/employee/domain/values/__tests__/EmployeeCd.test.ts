import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EmployeeCd } from "../EmployeeCd";

describe("EmployeeCd 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効な社員コードでインスタンスを作成できる", () => {
      const empCd = new EmployeeCd("EMP000001");
      expect(empCd.value).toBe("EMP000001");
    });

    it("最小値（EMP000001）が作成できる", () => {
      const empCd = new EmployeeCd("EMP000001");
      expect(empCd.value).toBe("EMP000001");
    });

    it("最大値（EMP999999）が作成できる", () => {
      const empCd = new EmployeeCd("EMP999999");
      expect(empCd.value).toBe("EMP999999");
    });

    it("小文字のempも大文字に正規化される", () => {
      const empCd = new EmployeeCd("emp000001");
      expect(empCd.value).toBe("EMP000001");
    });

    it("前後の空白は削除される", () => {
      const empCd = new EmployeeCd("  EMP000001  ");
      expect(empCd.value).toBe("EMP000001");
    });

    it("同じ社員コードは等価である", () => {
      const empCd1 = new EmployeeCd("EMP000001");
      const empCd2 = new EmployeeCd("EMP000001");
      expect(empCd1.equals(empCd2)).toBe(true);
    });

    it("異なる社員コードは等価でない", () => {
      const empCd1 = new EmployeeCd("EMP000001");
      const empCd2 = new EmployeeCd("EMP000002");
      expect(empCd1.equals(empCd2)).toBe(false);
    });

    it("数値部分を取得できる", () => {
      const empCd = new EmployeeCd("EMP000123");
      expect(empCd.numericPart).toBe(123);
    });
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new EmployeeCd("")).toThrow(ValidationError);
      expect(() => new EmployeeCd("")).toThrow("社員コードは必須です");
    });

    it("EMP で始まらない場合はエラー", () => {
      expect(() => new EmployeeCd("ABC000001")).toThrow(ValidationError);
      expect(() => new EmployeeCd("ABC000001")).toThrow(
        "社員コードは EMP + 6桁の数字である必要があります"
      );
    });

    it("数値部分が6桁でない場合はエラー（5桁）", () => {
      expect(() => new EmployeeCd("EMP00001")).toThrow(ValidationError);
      expect(() => new EmployeeCd("EMP00001")).toThrow(
        "社員コードは EMP + 6桁の数字である必要があります"
      );
    });

    it("数値部分が6桁でない場合はエラー（7桁）", () => {
      expect(() => new EmployeeCd("EMP0000001")).toThrow(ValidationError);
    });

    it("数値部分が数字でない場合はエラー", () => {
      expect(() => new EmployeeCd("EMP00000A")).toThrow(ValidationError);
      expect(() => new EmployeeCd("EMP00000A")).toThrow(
        "社員コードは EMP + 6桁の数字である必要があります"
      );
    });

    it("EMP000000（ゼロ埋めのゼロ）はエラー", () => {
      expect(() => new EmployeeCd("EMP000000")).toThrow(ValidationError);
      expect(() => new EmployeeCd("EMP000000")).toThrow("社員コードは 1 以上である必要があります");
    });

    it("形式が完全に間違っている場合はエラー", () => {
      expect(() => new EmployeeCd("invalid")).toThrow(ValidationError);
    });
  });
});
