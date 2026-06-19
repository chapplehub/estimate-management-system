import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ApprovalStepStatus } from "../ApprovalStepStatus";

describe("ApprovalStepStatus", () => {
  describe("static インスタンス（§3.6 承認ステップの導出状態）", () => {
    it("NOT_STARTED を取得できる", () => {
      expect(ApprovalStepStatus.NOT_STARTED.value).toBe("NOT_STARTED");
    });

    it("AWAITING を取得できる", () => {
      expect(ApprovalStepStatus.AWAITING.value).toBe("AWAITING");
    });

    it("APPROVED を取得できる", () => {
      expect(ApprovalStepStatus.APPROVED.value).toBe("APPROVED");
    });

    it("REJECTED を取得できる", () => {
      expect(ApprovalStepStatus.REJECTED.value).toBe("REJECTED");
    });
  });

  describe("from()", () => {
    it("'AWAITING' から同一インスタンスが返る", () => {
      expect(ApprovalStepStatus.from("AWAITING")).toBe(ApprovalStepStatus.AWAITING);
    });

    it("不正な値はエラー", () => {
      expect(() => ApprovalStepStatus.from("INVALID")).toThrow(ValidationError);
      expect(() => ApprovalStepStatus.from("INVALID")).toThrow("不正な承認ステップ状態です");
    });
  });

  describe("label アクセサ", () => {
    it("各状態の業務表示名を返す", () => {
      expect(ApprovalStepStatus.NOT_STARTED.label).toBe("未着手");
      expect(ApprovalStepStatus.AWAITING.label).toBe("承認待ち");
      expect(ApprovalStepStatus.APPROVED.label).toBe("承認済");
      expect(ApprovalStepStatus.REJECTED.label).toBe("差戻");
    });
  });

  describe("述語", () => {
    it("isAwaiting() は AWAITING のみ true（承認/差戻の対象・§7.1/§7.2）", () => {
      expect(ApprovalStepStatus.AWAITING.isAwaiting()).toBe(true);
      expect(ApprovalStepStatus.NOT_STARTED.isAwaiting()).toBe(false);
    });
  });

  describe("equals", () => {
    it("from で取得しても同一インスタンスのため等価", () => {
      expect(ApprovalStepStatus.from("APPROVED").equals(ApprovalStepStatus.APPROVED)).toBe(true);
    });

    it("異なる状態は非等価", () => {
      expect(ApprovalStepStatus.NOT_STARTED.equals(ApprovalStepStatus.AWAITING)).toBe(false);
    });
  });
});
