import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Memo } from "../Memo";

describe("Memo", () => {
  describe("正常系", () => {
    it("メモを受け入れる", () => {
      const memo = new Memo("納期は要相談");
      expect(memo.value).toBe("納期は要相談");
    });

    it("空文字を受け入れる（任意項目のため最小長制約なし）", () => {
      const memo = new Memo("");
      expect(memo.value).toBe("");
    });

    it("前後の空白はトリムされる", () => {
      const memo = new Memo("  納期は要相談  ");
      expect(memo.value).toBe("納期は要相談");
    });

    it("2000文字を受け入れる", () => {
      const memo = new Memo("あ".repeat(2000));
      expect(memo.value).toBe("あ".repeat(2000));
    });
  });

  describe("異常系", () => {
    it("2001文字以上を拒否する", () => {
      expect(() => new Memo("あ".repeat(2001))).toThrow(ValidationError);
      expect(() => new Memo("あ".repeat(2001))).toThrow("メモは2000文字以内で入力してください");
    });
  });
});
