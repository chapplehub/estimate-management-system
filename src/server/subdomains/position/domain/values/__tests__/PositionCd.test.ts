import { describe, it, expect } from "vitest";
import { PositionCd } from "../PositionCd";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("PositionCd", () => {
  describe("正常系", () => {
    it("POS001 形式の役職コードを作成できる", () => {
      const cd = new PositionCd("POS001");
      expect(cd.value).toBe("POS001");
    });

    it("小文字で入力しても大文字に変換される", () => {
      const cd = new PositionCd("pos001");
      expect(cd.value).toBe("POS001");
    });

    it("前後の空白はトリムされる", () => {
      const cd = new PositionCd("  POS001  ");
      expect(cd.value).toBe("POS001");
    });

    it("POS999 まで作成できる", () => {
      const cd = new PositionCd("POS999");
      expect(cd.value).toBe("POS999");
    });

    it("numericPart で数値部分を取得できる", () => {
      const cd = new PositionCd("POS123");
      expect(cd.numericPart).toBe(123);
    });
  });

  describe("fromNumber", () => {
    it("数値から役職コードを生成できる", () => {
      const cd = PositionCd.fromNumber(1);
      expect(cd.value).toBe("POS001");
    });

    it("3桁の数値から役職コードを生成できる", () => {
      const cd = PositionCd.fromNumber(123);
      expect(cd.value).toBe("POS123");
    });

    it("0を指定するとエラー", () => {
      expect(() => PositionCd.fromNumber(0)).toThrow(ValidationError);
    });

    it("1000以上を指定するとエラー", () => {
      expect(() => PositionCd.fromNumber(1000)).toThrow(ValidationError);
    });
  });

  describe("異常系", () => {
    it("空文字列はエラー", () => {
      expect(() => new PositionCd("")).toThrow(ValidationError);
      expect(() => new PositionCd("")).toThrow("役職コードは必須です");
    });

    it("POS000 はエラー（0は無効）", () => {
      expect(() => new PositionCd("POS000")).toThrow(ValidationError);
    });

    it("プレフィックスが違うとエラー", () => {
      expect(() => new PositionCd("DEPT001")).toThrow(ValidationError);
    });

    it("数字が足りないとエラー", () => {
      expect(() => new PositionCd("POS01")).toThrow(ValidationError);
    });

    it("数字が多すぎるとエラー", () => {
      expect(() => new PositionCd("POS0001")).toThrow(ValidationError);
    });

    it("数字以外が含まれるとエラー", () => {
      expect(() => new PositionCd("POSABC")).toThrow(ValidationError);
    });
  });

  describe("equals", () => {
    it("同じ値の役職コードは等しい", () => {
      const cd1 = new PositionCd("POS001");
      const cd2 = new PositionCd("POS001");
      expect(cd1.equals(cd2)).toBe(true);
    });

    it("異なる値の役職コードは等しくない", () => {
      const cd1 = new PositionCd("POS001");
      const cd2 = new PositionCd("POS002");
      expect(cd1.equals(cd2)).toBe(false);
    });
  });
});
