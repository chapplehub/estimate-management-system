import { describe, it, expect } from "vitest";
import { RoleCd } from "../RoleCd";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("RoleCd", () => {
  describe("正常系", () => {
    it("ROLE001 形式の役割コードを作成できる", () => {
      const cd = new RoleCd("ROLE001");
      expect(cd.value).toBe("ROLE001");
    });

    it("小文字で入力しても大文字に変換される", () => {
      const cd = new RoleCd("role001");
      expect(cd.value).toBe("ROLE001");
    });

    it("前後の空白はトリムされる", () => {
      const cd = new RoleCd("  ROLE001  ");
      expect(cd.value).toBe("ROLE001");
    });

    it("ROLE999 まで作成できる", () => {
      const cd = new RoleCd("ROLE999");
      expect(cd.value).toBe("ROLE999");
    });

    it("numericPart で数値部分を取得できる", () => {
      const cd = new RoleCd("ROLE123");
      expect(cd.numericPart).toBe(123);
    });
  });

  describe("fromNumber", () => {
    it("数値から役割コードを生成できる", () => {
      const cd = RoleCd.fromNumber(1);
      expect(cd.value).toBe("ROLE001");
    });

    it("3桁の数値から役割コードを生成できる", () => {
      const cd = RoleCd.fromNumber(123);
      expect(cd.value).toBe("ROLE123");
    });

    it("0を指定するとエラー", () => {
      expect(() => RoleCd.fromNumber(0)).toThrow(ValidationError);
    });

    it("1000以上を指定するとエラー", () => {
      expect(() => RoleCd.fromNumber(1000)).toThrow(ValidationError);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new RoleCd("")).toThrow(ValidationError);
      expect(() => new RoleCd("")).toThrow("役割コードは必須です");
    });

    it("ROLE000 はエラー（0は無効）", () => {
      expect(() => new RoleCd("ROLE000")).toThrow(ValidationError);
    });

    it("プレフィックスが違うとエラー", () => {
      expect(() => new RoleCd("DEPT001")).toThrow(ValidationError);
    });

    it("数字が足りないとエラー", () => {
      expect(() => new RoleCd("ROLE01")).toThrow(ValidationError);
    });

    it("数字が多すぎるとエラー", () => {
      expect(() => new RoleCd("ROLE0001")).toThrow(ValidationError);
    });

    it("数字以外が含まれるとエラー", () => {
      expect(() => new RoleCd("ROLEABC")).toThrow(ValidationError);
    });
  });

  describe("equals", () => {
    it("同じ値の役割コードは等しい", () => {
      const cd1 = new RoleCd("ROLE001");
      const cd2 = new RoleCd("ROLE001");
      expect(cd1.equals(cd2)).toBe(true);
    });

    it("異なる値の役割コードは等しくない", () => {
      const cd1 = new RoleCd("ROLE001");
      const cd2 = new RoleCd("ROLE002");
      expect(cd1.equals(cd2)).toBe(false);
    });
  });
});
