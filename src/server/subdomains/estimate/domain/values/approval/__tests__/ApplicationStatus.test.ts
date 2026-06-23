import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "../ApplicationStatus";

describe("ApplicationStatus", () => {
  describe("static インスタンス（§3.6 申請の導出状態）", () => {
    it("PENDING を取得できる", () => {
      expect(ApplicationStatus.PENDING.value).toBe("PENDING");
    });

    it("APPROVED を取得できる", () => {
      expect(ApplicationStatus.APPROVED.value).toBe("APPROVED");
    });

    it("REJECTED を取得できる", () => {
      expect(ApplicationStatus.REJECTED.value).toBe("REJECTED");
    });

    it("WITHDRAWN を取得できる", () => {
      expect(ApplicationStatus.WITHDRAWN.value).toBe("WITHDRAWN");
    });
  });

  describe("label アクセサ", () => {
    it("各状態の業務表示名を返す", () => {
      expect(ApplicationStatus.PENDING.label).toBe("申請中");
      expect(ApplicationStatus.APPROVED.label).toBe("承認済");
      expect(ApplicationStatus.REJECTED.label).toBe("差戻");
      expect(ApplicationStatus.WITHDRAWN.label).toBe("取下");
    });
  });

  describe("述語", () => {
    it("isPending() は PENDING のみ true", () => {
      expect(ApplicationStatus.PENDING.isPending()).toBe(true);
      expect(ApplicationStatus.APPROVED.isPending()).toBe(false);
    });

    it("isAdvancing() は PENDING・APPROVED が前進（true）", () => {
      expect(ApplicationStatus.PENDING.isAdvancing()).toBe(true);
      expect(ApplicationStatus.APPROVED.isAdvancing()).toBe(true);
    });

    it("isAdvancing() は REJECTED・WITHDRAWN が非前進（false）", () => {
      expect(ApplicationStatus.REJECTED.isAdvancing()).toBe(false);
      expect(ApplicationStatus.WITHDRAWN.isAdvancing()).toBe(false);
    });
  });

  describe("equals", () => {
    it("同一状態は等価", () => {
      expect(ApplicationStatus.APPROVED.equals(ApplicationStatus.APPROVED)).toBe(true);
    });

    it("異なる状態は非等価", () => {
      expect(ApplicationStatus.PENDING.equals(ApplicationStatus.WITHDRAWN)).toBe(false);
    });
  });
});
