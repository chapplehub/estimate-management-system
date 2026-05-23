import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { FiscalYear } from "../FiscalYear";

describe("FiscalYear", () => {
  describe("正常系", () => {
    it("西暦4桁数値で生成できる", () => {
      const fy = new FiscalYear(2025);
      expect(fy.value).toBe(2025);
    });

    it('toShortString は下2桁ゼロ詰め文字列を返す（2025 → "25"）', () => {
      expect(new FiscalYear(2025).toShortString()).toBe("25");
    });

    it('toShortString は10未満でも2桁化される（2007 → "07"）', () => {
      expect(new FiscalYear(2007).toShortString()).toBe("07");
    });

    it('toShortString は世紀境界でゼロ詰めされる（2100 → "00"）', () => {
      expect(new FiscalYear(2100).toShortString()).toBe("00");
    });

    it("下限 1900 を受け入れる", () => {
      expect(new FiscalYear(1900).value).toBe(1900);
    });

    it("上限 2999 を受け入れる", () => {
      expect(new FiscalYear(2999).value).toBe(2999);
    });

    it("FISCAL_START_MONTH 定数は 4", () => {
      expect(FiscalYear.FISCAL_START_MONTH).toBe(4);
    });
  });

  describe("from(date) — JST 4月始まりの年度導出", () => {
    it("2025年4月1日 00:00 JST は 2025 年度", () => {
      const date = new Date("2025-04-01T00:00:00+09:00");
      expect(FiscalYear.from(date).value).toBe(2025);
    });

    it("2025年3月31日 23:59 JST は 2024 年度", () => {
      const date = new Date("2025-03-31T23:59:59+09:00");
      expect(FiscalYear.from(date).value).toBe(2024);
    });

    it("2025年12月31日 23:59 JST は 2025 年度", () => {
      const date = new Date("2025-12-31T23:59:59+09:00");
      expect(FiscalYear.from(date).value).toBe(2025);
    });

    it("2026年1月1日 00:00 JST は 2025 年度", () => {
      const date = new Date("2026-01-01T00:00:00+09:00");
      expect(FiscalYear.from(date).value).toBe(2025);
    });

    it("2026年3月31日 23:59 JST は 2025 年度", () => {
      const date = new Date("2026-03-31T23:59:59+09:00");
      expect(FiscalYear.from(date).value).toBe(2025);
    });

    it("2026年4月1日 00:00 JST は 2026 年度", () => {
      const date = new Date("2026-04-01T00:00:00+09:00");
      expect(FiscalYear.from(date).value).toBe(2026);
    });

    it("UTC 表示で 3月の Date でも JST に直すと 4月なら新年度", () => {
      // UTC 2025-03-31 15:00:00 = JST 2025-04-01 00:00:00
      const date = new Date("2025-03-31T15:00:00Z");
      expect(FiscalYear.from(date).value).toBe(2025);
    });

    it("UTC 表示で 4月の Date でも JST に直すと 3月なら旧年度", () => {
      // UTC 2025-04-01 14:59:59 < JST 2025-04-01 00:00 ではない (UTC04-01-14:59 = JST04-01-23:59)
      // 正しくは: UTC 2025-03-31 14:59:59 = JST 2025-03-31 23:59:59 → 2024 年度
      const date = new Date("2025-03-31T14:59:59Z");
      expect(FiscalYear.from(date).value).toBe(2024);
    });
  });

  describe("異常系", () => {
    it("整数でない値はエラー（2025.5）", () => {
      expect(() => new FiscalYear(2025.5)).toThrow(ValidationError);
      expect(() => new FiscalYear(2025.5)).toThrow("年度は整数である必要があります");
    });

    it("NaN はエラー", () => {
      expect(() => new FiscalYear(Number.NaN)).toThrow(ValidationError);
    });

    it("範囲下限未満はエラー（1899）", () => {
      expect(() => new FiscalYear(1899)).toThrow(ValidationError);
      expect(() => new FiscalYear(1899)).toThrow("年度は1900〜2999の範囲である必要があります");
    });

    it("範囲上限超過はエラー（3000）", () => {
      expect(() => new FiscalYear(3000)).toThrow(ValidationError);
      expect(() => new FiscalYear(3000)).toThrow("年度は1900〜2999の範囲である必要があります");
    });
  });

  describe("equals", () => {
    it("同じ年度は等しい", () => {
      expect(new FiscalYear(2025).equals(new FiscalYear(2025))).toBe(true);
    });

    it("異なる年度は等しくない", () => {
      expect(new FiscalYear(2025).equals(new FiscalYear(2026))).toBe(false);
    });
  });
});
