import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Memo } from "../Memo";

describe("Memo", () => {
  describe("create() - 正常系", () => {
    it("メモを受け入れる", () => {
      const memo = Memo.create("納期は要相談");
      expect(memo.value).toBe("納期は要相談");
      expect(memo.isEmpty()).toBe(false);
    });

    it("前後の空白はトリムされる", () => {
      const memo = Memo.create("  納期は要相談  ");
      expect(memo.value).toBe("納期は要相談");
    });

    it("2000文字を受け入れる", () => {
      const memo = Memo.create("あ".repeat(2000));
      expect(memo.value).toBe("あ".repeat(2000));
    });
  });

  describe("create() - 未入力の正規化（空 Memo）", () => {
    it("null は空 Memo になる", () => {
      const memo = Memo.create(null);
      expect(memo.value).toBe("");
      expect(memo.isEmpty()).toBe(true);
    });

    it("undefined は空 Memo になる", () => {
      const memo = Memo.create(undefined);
      expect(memo.isEmpty()).toBe(true);
    });

    it("空文字は空 Memo になる", () => {
      const memo = Memo.create("");
      expect(memo.isEmpty()).toBe(true);
    });

    it("空白のみは trim 後に空 Memo になる（未入力と同一視）", () => {
      const memo = Memo.create("   ");
      expect(memo.isEmpty()).toBe(true);
    });
  });

  describe("empty()", () => {
    it("空 Memo を返す", () => {
      expect(Memo.empty().isEmpty()).toBe(true);
      expect(Memo.empty().value).toBe("");
    });
  });

  describe("異常系", () => {
    it("2001文字以上を拒否する", () => {
      expect(() => Memo.create("あ".repeat(2001))).toThrow(ValidationError);
      expect(() => Memo.create("あ".repeat(2001))).toThrow("メモは2000文字以内で入力してください");
    });
  });
});
