import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { RejectionComment } from "../RejectionComment";

describe("RejectionComment", () => {
  describe("正常系", () => {
    it("差戻理由を保持する", () => {
      const comment = new RejectionComment("金額の根拠が不明確です");

      expect(comment.value).toBe("金額の根拠が不明確です");
    });

    it("前後の空白をトリムする", () => {
      expect(new RejectionComment("  要修正  ").value).toBe("要修正");
    });

    it("2000文字ちょうどは許容する", () => {
      const max = "あ".repeat(2000);

      expect(new RejectionComment(max).value).toBe(max);
    });
  });

  describe("異常系（§3.4 差戻理由は必須）", () => {
    it("空文字は拒否する（必須）", () => {
      expect(() => new RejectionComment("")).toThrow(ValidationError);
    });

    it("空白のみは拒否する（トリム後に空のため必須違反）", () => {
      expect(() => new RejectionComment("   ")).toThrow(ValidationError);
    });

    it("2001文字は拒否する", () => {
      expect(() => new RejectionComment("あ".repeat(2001))).toThrow(ValidationError);
    });
  });
});
