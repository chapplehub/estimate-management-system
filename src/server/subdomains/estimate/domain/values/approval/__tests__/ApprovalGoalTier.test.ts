import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ApprovalGoalTier } from "../ApprovalGoalTier";

describe("ApprovalGoalTier", () => {
  describe("static インスタンス", () => {
    it("SECTION_MANAGER（課長）を取得できる", () => {
      expect(ApprovalGoalTier.SECTION_MANAGER.value).toBe("SECTION_MANAGER");
    });

    it("DEPARTMENT_MANAGER（部長）を取得できる", () => {
      expect(ApprovalGoalTier.DEPARTMENT_MANAGER.value).toBe("DEPARTMENT_MANAGER");
    });

    it("DIVISION_MANAGER（本部長）を取得できる", () => {
      expect(ApprovalGoalTier.DIVISION_MANAGER.value).toBe("DIVISION_MANAGER");
    });

    it("PRESIDENT（社長）を取得できる", () => {
      expect(ApprovalGoalTier.PRESIDENT.value).toBe("PRESIDENT");
    });
  });

  describe("from()", () => {
    it("'SECTION_MANAGER' から同一インスタンスが返る", () => {
      expect(ApprovalGoalTier.from("SECTION_MANAGER")).toBe(ApprovalGoalTier.SECTION_MANAGER);
    });

    it("不正な値はエラー", () => {
      expect(() => ApprovalGoalTier.from("INVALID")).toThrow(ValidationError);
      expect(() => ApprovalGoalTier.from("INVALID")).toThrow("不正な承認ゴール段階です");
    });
  });

  describe("label アクセサ", () => {
    it("各段階の業務表示名を返す", () => {
      expect(ApprovalGoalTier.SECTION_MANAGER.label).toBe("課長");
      expect(ApprovalGoalTier.DEPARTMENT_MANAGER.label).toBe("部長");
      expect(ApprovalGoalTier.DIVISION_MANAGER.label).toBe("本部長");
      expect(ApprovalGoalTier.PRESIDENT.label).toBe("社長");
    });
  });

  describe("rank — 段階比較（課長 < 部長 < 本部長 < 社長）", () => {
    it("承認権限の昇順に rank が増える", () => {
      expect(ApprovalGoalTier.SECTION_MANAGER.rank).toBeLessThan(
        ApprovalGoalTier.DEPARTMENT_MANAGER.rank
      );
      expect(ApprovalGoalTier.DEPARTMENT_MANAGER.rank).toBeLessThan(
        ApprovalGoalTier.DIVISION_MANAGER.rank
      );
      expect(ApprovalGoalTier.DIVISION_MANAGER.rank).toBeLessThan(ApprovalGoalTier.PRESIDENT.rank);
    });

    it("isAtLeast() で段階の到達判定ができる", () => {
      // 部長は課長以上に到達している
      expect(ApprovalGoalTier.DEPARTMENT_MANAGER.isAtLeast(ApprovalGoalTier.SECTION_MANAGER)).toBe(
        true
      );
      // 同段は到達扱い
      expect(
        ApprovalGoalTier.DEPARTMENT_MANAGER.isAtLeast(ApprovalGoalTier.DEPARTMENT_MANAGER)
      ).toBe(true);
      // 課長は部長に未到達
      expect(ApprovalGoalTier.SECTION_MANAGER.isAtLeast(ApprovalGoalTier.DEPARTMENT_MANAGER)).toBe(
        false
      );
    });
  });

  describe("equals", () => {
    it("from で取得しても同一インスタンスのため等価", () => {
      expect(ApprovalGoalTier.from("PRESIDENT").equals(ApprovalGoalTier.PRESIDENT)).toBe(true);
    });

    it("異なる段階は非等価", () => {
      expect(ApprovalGoalTier.SECTION_MANAGER.equals(ApprovalGoalTier.PRESIDENT)).toBe(false);
    });
  });
});
