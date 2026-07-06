import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "../ApplicationStatus";
import { VariationApplicationState } from "../VariationApplicationState";

describe("VariationApplicationState（バリエーション申請状態・6値）", () => {
  describe("static インスタンス（code）", () => {
    it("6値の code を取得できる", () => {
      expect(VariationApplicationState.NONE.code).toBe("NONE");
      expect(VariationApplicationState.PENDING.code).toBe("PENDING");
      expect(VariationApplicationState.REJECTED.code).toBe("REJECTED");
      expect(VariationApplicationState.WITHDRAWN.code).toBe("WITHDRAWN");
      expect(VariationApplicationState.APPROVED.code).toBe("APPROVED");
      expect(VariationApplicationState.EXEMPTED.code).toBe("EXEMPTED");
    });
  });

  describe("label", () => {
    it("NONE=「未申請」/ EXEMPTED=「承認不要」を自前で返す", () => {
      expect(VariationApplicationState.NONE.label).toBe("未申請");
      expect(VariationApplicationState.EXEMPTED.label).toBe("承認不要");
    });

    it("申請と重なる4値は ApplicationStatus.label へ委譲する（ドリフト防止）", () => {
      expect(VariationApplicationState.PENDING.label).toBe(ApplicationStatus.PENDING.label);
      expect(VariationApplicationState.APPROVED.label).toBe(ApplicationStatus.APPROVED.label);
      expect(VariationApplicationState.REJECTED.label).toBe(ApplicationStatus.REJECTED.label);
      expect(VariationApplicationState.WITHDRAWN.label).toBe(ApplicationStatus.WITHDRAWN.label);
    });
  });

  describe("isAdvancing（前進バリエーション＝申請中・承認済・免除）", () => {
    it("PENDING・APPROVED・EXEMPTED は前進（true）", () => {
      expect(VariationApplicationState.PENDING.isAdvancing()).toBe(true);
      expect(VariationApplicationState.APPROVED.isAdvancing()).toBe(true);
      expect(VariationApplicationState.EXEMPTED.isAdvancing()).toBe(true);
    });

    it("NONE・REJECTED・WITHDRAWN は非前進（false）", () => {
      expect(VariationApplicationState.NONE.isAdvancing()).toBe(false);
      expect(VariationApplicationState.REJECTED.isAdvancing()).toBe(false);
      expect(VariationApplicationState.WITHDRAWN.isAdvancing()).toBe(false);
    });
  });

  describe("reduce（バリエーション単位の畳み込み・免除最優先→最新attempt→未申請）", () => {
    it("免除行があれば申請の有無に関わらず EXEMPTED（最優先）", () => {
      const state = VariationApplicationState.reduce({
        isExempted: true,
        applications: [{ attempt: 1, status: ApplicationStatus.REJECTED }],
      });
      expect(state).toBe(VariationApplicationState.EXEMPTED);
    });

    it("免除なし・申請ありは最新 attempt（max）の導出状態へ写す", () => {
      const state = VariationApplicationState.reduce({
        isExempted: false,
        applications: [
          { attempt: 1, status: ApplicationStatus.REJECTED },
          { attempt: 2, status: ApplicationStatus.PENDING },
        ],
      });
      expect(state).toBe(VariationApplicationState.PENDING);
    });

    it("申請の順序が attempt 昇順でなくても max attempt を選ぶ", () => {
      const state = VariationApplicationState.reduce({
        isExempted: false,
        applications: [
          { attempt: 2, status: ApplicationStatus.APPROVED },
          { attempt: 1, status: ApplicationStatus.REJECTED },
        ],
      });
      expect(state).toBe(VariationApplicationState.APPROVED);
    });

    it("免除なし・申請なしは NONE（未申請）", () => {
      const state = VariationApplicationState.reduce({
        isExempted: false,
        applications: [],
      });
      expect(state).toBe(VariationApplicationState.NONE);
    });
  });
});
