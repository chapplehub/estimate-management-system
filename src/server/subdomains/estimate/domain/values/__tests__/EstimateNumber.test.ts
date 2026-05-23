import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateNumber } from "../EstimateNumber";
import { EstimateType } from "../EstimateType";

describe("EstimateNumber", () => {
  describe("parse — 正常系", () => {
    it("N2500001 をパースできる", () => {
      const num = EstimateNumber.parse("N2500001");
      expect(num.value).toBe("N2500001");
    });

    it("R2500123 をパースできる", () => {
      const num = EstimateNumber.parse("R2500123");
      expect(num.value).toBe("R2500123");
    });

    it("A2510500 をパースできる", () => {
      const num = EstimateNumber.parse("A2510500");
      expect(num.value).toBe("A2510500");
    });

    it("連番最小値 N2500001 を受け入れる", () => {
      expect(EstimateNumber.parse("N2500001").sequence).toBe(1);
    });

    it("連番最大値 N2599999 を受け入れる", () => {
      expect(EstimateNumber.parse("N2599999").sequence).toBe(99999);
    });

    it("年度2桁の境界 N0000001（西暦2000）を受け入れる", () => {
      expect(EstimateNumber.parse("N0000001").fiscalYear.value).toBe(2000);
    });

    it("年度2桁の境界 N9900001（西暦2099）を受け入れる", () => {
      expect(EstimateNumber.parse("N9900001").fiscalYear.value).toBe(2099);
    });
  });

  describe("アクセサ", () => {
    it("value は元文字列を返す", () => {
      expect(EstimateNumber.parse("N2500001").value).toBe("N2500001");
    });

    it("prefix は接頭辞を返す（N2500001 → 'N'）", () => {
      expect(EstimateNumber.parse("N2500001").prefix).toBe("N");
    });

    it("estimateType は EstimateType を返す（R... → REPAIR）", () => {
      expect(EstimateNumber.parse("R2500123").estimateType).toBe(EstimateType.REPAIR);
    });

    it("estimateType は EstimateType を返す（A... → AFTER_REPAIR）", () => {
      expect(EstimateNumber.parse("A2510500").estimateType).toBe(EstimateType.AFTER_REPAIR);
    });

    it("fiscalYear は西暦4桁の FiscalYear を返す（25 → 2025）", () => {
      expect(EstimateNumber.parse("N2500001").fiscalYear.value).toBe(2025);
    });

    it("fiscalYear.toShortString は2桁年度を返す", () => {
      expect(EstimateNumber.parse("N2500001").fiscalYear.toShortString()).toBe("25");
    });

    it("sequence は先頭ゼロを除去した整数を返す（N2500001 → 1）", () => {
      expect(EstimateNumber.parse("N2500001").sequence).toBe(1);
    });

    it("sequence は5桁いっぱい（N2599999 → 99999）", () => {
      expect(EstimateNumber.parse("N2599999").sequence).toBe(99999);
    });

    it("toString は元文字列を返す（基底クラス由来）", () => {
      expect(EstimateNumber.parse("N2500001").toString()).toBe("N2500001");
    });
  });

  describe("parse — 異常系（長さ）", () => {
    it("7文字はエラー", () => {
      expect(() => EstimateNumber.parse("N250001")).toThrow(ValidationError);
      expect(() => EstimateNumber.parse("N250001")).toThrow("見積番号は8文字である必要があります");
    });

    it("9文字はエラー", () => {
      expect(() => EstimateNumber.parse("N25000001")).toThrow(ValidationError);
      expect(() => EstimateNumber.parse("N25000001")).toThrow(
        "見積番号は8文字である必要があります"
      );
    });

    it("空文字はエラー", () => {
      expect(() => EstimateNumber.parse("")).toThrow(ValidationError);
    });
  });

  describe("parse — 異常系（接頭辞）", () => {
    it("不正な接頭辞 X2500001 はエラー", () => {
      expect(() => EstimateNumber.parse("X2500001")).toThrow(ValidationError);
      expect(() => EstimateNumber.parse("X2500001")).toThrow("見積番号の形式が正しくありません");
    });

    it("小文字 n2500001 はエラー", () => {
      expect(() => EstimateNumber.parse("n2500001")).toThrow(ValidationError);
    });

    it("数字始まりはエラー（12500001）", () => {
      expect(() => EstimateNumber.parse("12500001")).toThrow(ValidationError);
    });
  });

  describe("parse — 異常系（連番）", () => {
    it("連番 00000 はエラー（N2500000）", () => {
      expect(() => EstimateNumber.parse("N2500000")).toThrow(ValidationError);
      expect(() => EstimateNumber.parse("N2500000")).toThrow(
        "見積番号の連番は1以上である必要があります"
      );
    });
  });

  describe("parse — 異常系（その他）", () => {
    it("年度部が数字でないとエラー（NAA00001）", () => {
      expect(() => EstimateNumber.parse("NAA00001")).toThrow(ValidationError);
    });

    it("連番部が数字でないとエラー（N25ABCDE）", () => {
      expect(() => EstimateNumber.parse("N25ABCDE")).toThrow(ValidationError);
    });

    it("先頭の空白はエラー（' N250001'）", () => {
      expect(() => EstimateNumber.parse(" N250001")).toThrow(ValidationError);
    });

    it("末尾の空白はエラー（'N250001 '）", () => {
      expect(() => EstimateNumber.parse("N250001 ")).toThrow(ValidationError);
    });
  });

  describe("equals", () => {
    it("同じ番号は等しい", () => {
      expect(EstimateNumber.parse("N2500001").equals(EstimateNumber.parse("N2500001"))).toBe(true);
    });

    it("異なる連番は等しくない（N2500001 vs N2500002）", () => {
      expect(EstimateNumber.parse("N2500001").equals(EstimateNumber.parse("N2500002"))).toBe(false);
    });

    it("接頭辞違いは等しくない（N2500001 vs R2500001）", () => {
      expect(EstimateNumber.parse("N2500001").equals(EstimateNumber.parse("R2500001"))).toBe(false);
    });

    it("年度違いは等しくない（N2500001 vs N2600001）", () => {
      expect(EstimateNumber.parse("N2500001").equals(EstimateNumber.parse("N2600001"))).toBe(false);
    });
  });
});
