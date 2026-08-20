import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { VariationStatus } from "../VariationStatus";

describe("VariationStatus", () => {
  describe("static インスタンス", () => {
    it("ACTIVE を取得できる", () => {
      expect(VariationStatus.ACTIVE.value).toBe("ACTIVE");
    });

    it("INACTIVE を取得できる", () => {
      expect(VariationStatus.INACTIVE.value).toBe("INACTIVE");
    });
  });

  describe("from() — Prisma 値からの生成", () => {
    it("'ACTIVE' から VariationStatus.ACTIVE が返る（同一インスタンス）", () => {
      expect(VariationStatus.from("ACTIVE")).toBe(VariationStatus.ACTIVE);
    });

    it("'INACTIVE' から VariationStatus.INACTIVE が返る", () => {
      expect(VariationStatus.from("INACTIVE")).toBe(VariationStatus.INACTIVE);
    });

    it("不正な値はエラー", () => {
      expect(() => VariationStatus.from("INVALID")).toThrow(ValidationError);
      expect(() => VariationStatus.from("INVALID")).toThrow("不正なバリエーション状態です");
    });

    it("空文字はエラー", () => {
      expect(() => VariationStatus.from("")).toThrow(ValidationError);
    });
  });

  describe("判定メソッド", () => {
    it("ACTIVE は isActive()=true, isInactive()=false", () => {
      expect(VariationStatus.ACTIVE.isActive()).toBe(true);
      expect(VariationStatus.ACTIVE.isInactive()).toBe(false);
    });

    it("INACTIVE は isActive()=false, isInactive()=true", () => {
      expect(VariationStatus.INACTIVE.isActive()).toBe(false);
      expect(VariationStatus.INACTIVE.isInactive()).toBe(true);
    });
  });

  describe("label — 業務表示名", () => {
    it("ACTIVE のラベルは「有効」", () => {
      expect(VariationStatus.ACTIVE.label).toBe("有効");
    });

    it("INACTIVE のラベルは「無効」", () => {
      expect(VariationStatus.INACTIVE.label).toBe("無効");
    });
  });

  describe("equals — 値オブジェクト等価判定", () => {
    it("同じ静的インスタンスは equals=true", () => {
      expect(VariationStatus.ACTIVE.equals(VariationStatus.ACTIVE)).toBe(true);
    });

    it("異なる静的インスタンスは equals=false", () => {
      expect(VariationStatus.ACTIVE.equals(VariationStatus.INACTIVE)).toBe(false);
    });
  });
});
