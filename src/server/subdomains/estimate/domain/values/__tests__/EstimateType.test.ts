import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateType } from "../EstimateType";

describe("EstimateType", () => {
  describe("static インスタンス", () => {
    it("NEW を取得できる（value === 'NEW'）", () => {
      expect(EstimateType.NEW.value).toBe("NEW");
    });

    it("REPAIR を取得できる", () => {
      expect(EstimateType.REPAIR.value).toBe("REPAIR");
    });

    it("AFTER_REPAIR を取得できる", () => {
      expect(EstimateType.AFTER_REPAIR.value).toBe("AFTER_REPAIR");
    });
  });

  describe("from() — Prisma 値からの生成", () => {
    it("'NEW' から EstimateType.NEW が返る（同一インスタンス）", () => {
      expect(EstimateType.from("NEW")).toBe(EstimateType.NEW);
    });

    it("'REPAIR' から EstimateType.REPAIR が返る", () => {
      expect(EstimateType.from("REPAIR")).toBe(EstimateType.REPAIR);
    });

    it("'AFTER_REPAIR' から EstimateType.AFTER_REPAIR が返る", () => {
      expect(EstimateType.from("AFTER_REPAIR")).toBe(EstimateType.AFTER_REPAIR);
    });

    it("不正な値はエラー（'INVALID'）", () => {
      expect(() => EstimateType.from("INVALID")).toThrow(ValidationError);
      expect(() => EstimateType.from("INVALID")).toThrow("不正な見積区分です");
    });

    it("接頭辞 'N' を from に渡すとエラー（fromPrefix を使うべき）", () => {
      expect(() => EstimateType.from("N")).toThrow(ValidationError);
    });

    it("空文字はエラー", () => {
      expect(() => EstimateType.from("")).toThrow(ValidationError);
    });

    it("小文字はエラー", () => {
      expect(() => EstimateType.from("new")).toThrow(ValidationError);
    });
  });

  describe("fromPrefix() — 採番接頭辞からの生成", () => {
    it("'N' → EstimateType.NEW", () => {
      expect(EstimateType.fromPrefix("N")).toBe(EstimateType.NEW);
    });

    it("'R' → EstimateType.REPAIR", () => {
      expect(EstimateType.fromPrefix("R")).toBe(EstimateType.REPAIR);
    });

    it("'A' → EstimateType.AFTER_REPAIR", () => {
      expect(EstimateType.fromPrefix("A")).toBe(EstimateType.AFTER_REPAIR);
    });

    it("不正な接頭辞はエラー（'X'）", () => {
      expect(() => EstimateType.fromPrefix("X")).toThrow(ValidationError);
      expect(() => EstimateType.fromPrefix("X")).toThrow("不正な見積区分の接頭辞です");
    });

    it("小文字はエラー（'n'）— 採番形式は大文字固定（§2.1）", () => {
      expect(() => EstimateType.fromPrefix("n")).toThrow(ValidationError);
    });

    it("空文字はエラー", () => {
      expect(() => EstimateType.fromPrefix("")).toThrow(ValidationError);
    });

    it("複数文字はエラー（'NR'）", () => {
      expect(() => EstimateType.fromPrefix("NR")).toThrow(ValidationError);
    });
  });

  describe("prefix アクセサ", () => {
    it("NEW.prefix === 'N'", () => {
      expect(EstimateType.NEW.prefix).toBe("N");
    });

    it("REPAIR.prefix === 'R'", () => {
      expect(EstimateType.REPAIR.prefix).toBe("R");
    });

    it("AFTER_REPAIR.prefix === 'A'", () => {
      expect(EstimateType.AFTER_REPAIR.prefix).toBe("A");
    });
  });

  describe("label アクセサ", () => {
    it("NEW.label === '新規'", () => {
      expect(EstimateType.NEW.label).toBe("新規");
    });

    it("REPAIR.label === '修理'", () => {
      expect(EstimateType.REPAIR.label).toBe("修理");
    });

    it("AFTER_REPAIR.label === '事後'", () => {
      expect(EstimateType.AFTER_REPAIR.label).toBe("事後");
    });
  });

  describe("equals", () => {
    it("同じインスタンスは等しい", () => {
      expect(EstimateType.NEW.equals(EstimateType.NEW)).toBe(true);
    });

    it("from で取得しても同一インスタンスのため等しい", () => {
      expect(EstimateType.from("NEW").equals(EstimateType.NEW)).toBe(true);
    });

    it("異なるインスタンスは等しくない（NEW vs REPAIR）", () => {
      expect(EstimateType.NEW.equals(EstimateType.REPAIR)).toBe(false);
    });
  });
});
