import { describe, it, expect } from "vitest";
import { DepartmentCd } from "../DepartmentCd";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("DepartmentCd", () => {
  describe("正常系", () => {
    it("DEPT001 形式の部署コードを作成できる", () => {
      const cd = new DepartmentCd("DEPT001");
      expect(cd.value).toBe("DEPT001");
    });

    it("小文字で入力しても大文字に変換される", () => {
      const cd = new DepartmentCd("dept001");
      expect(cd.value).toBe("DEPT001");
    });

    it("前後の空白はトリムされる", () => {
      const cd = new DepartmentCd("  DEPT001  ");
      expect(cd.value).toBe("DEPT001");
    });

    it("DEPT999 まで作成できる", () => {
      const cd = new DepartmentCd("DEPT999");
      expect(cd.value).toBe("DEPT999");
    });

    it("numericPart で数値部分を取得できる", () => {
      const cd = new DepartmentCd("DEPT123");
      expect(cd.numericPart).toBe(123);
    });
  });

  describe("fromNumber", () => {
    it("数値から部署コードを生成できる", () => {
      const cd = DepartmentCd.fromNumber(1);
      expect(cd.value).toBe("DEPT001");
    });

    it("3桁の数値から部署コードを生成できる", () => {
      const cd = DepartmentCd.fromNumber(123);
      expect(cd.value).toBe("DEPT123");
    });

    it("0を指定するとエラー", () => {
      expect(() => DepartmentCd.fromNumber(0)).toThrow(ValidationError);
      expect(() => DepartmentCd.fromNumber(0)).toThrow(
        "部署コードは 1 〜 999 の範囲である必要があります"
      );
    });

    it("1000以上を指定するとエラー", () => {
      expect(() => DepartmentCd.fromNumber(1000)).toThrow(ValidationError);
      expect(() => DepartmentCd.fromNumber(1000)).toThrow(
        "部署コードは 1 〜 999 の範囲である必要があります"
      );
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new DepartmentCd("")).toThrow(ValidationError);
      expect(() => new DepartmentCd("")).toThrow("部署コードは必須です");
    });

    it("DEPT000 はエラー（0は無効）", () => {
      expect(() => new DepartmentCd("DEPT000")).toThrow(ValidationError);
      expect(() => new DepartmentCd("DEPT000")).toThrow("部署コードは 1 以上である必要があります");
    });

    it("プレフィックスが違うとエラー", () => {
      expect(() => new DepartmentCd("EMP001")).toThrow(ValidationError);
      expect(() => new DepartmentCd("EMP001")).toThrow(
        "部署コードは DEPT + 3桁の数字である必要があります"
      );
    });

    it("数字が足りないとエラー", () => {
      expect(() => new DepartmentCd("DEPT01")).toThrow(ValidationError);
      expect(() => new DepartmentCd("DEPT01")).toThrow(
        "部署コードは DEPT + 3桁の数字である必要があります"
      );
    });

    it("数字が多すぎるとエラー", () => {
      expect(() => new DepartmentCd("DEPT0001")).toThrow(ValidationError);
      expect(() => new DepartmentCd("DEPT0001")).toThrow(
        "部署コードは DEPT + 3桁の数字である必要があります"
      );
    });

    it("数字以外が含まれるとエラー", () => {
      expect(() => new DepartmentCd("DEPTABC")).toThrow(ValidationError);
      expect(() => new DepartmentCd("DEPTABC")).toThrow(
        "部署コードは DEPT + 3桁の数字である必要があります"
      );
    });
  });

  describe("equals", () => {
    it("同じ値の部署コードは等しい", () => {
      const cd1 = new DepartmentCd("DEPT001");
      const cd2 = new DepartmentCd("DEPT001");
      expect(cd1.equals(cd2)).toBe(true);
    });

    it("異なる値の部署コードは等しくない", () => {
      const cd1 = new DepartmentCd("DEPT001");
      const cd2 = new DepartmentCd("DEPT002");
      expect(cd1.equals(cd2)).toBe(false);
    });
  });
});
