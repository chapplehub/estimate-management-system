import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { FaultDescription } from "../FaultDescription";

describe("FaultDescription", () => {
  describe("正常系", () => {
    it("故障内容を受け入れる", () => {
      const fd = new FaultDescription("ポンプから異音");
      expect(fd.value).toBe("ポンプから異音");
    });

    it("前後の空白はトリムされる", () => {
      const fd = new FaultDescription("  ポンプから異音  ");
      expect(fd.value).toBe("ポンプから異音");
    });

    it("2000文字を受け入れる", () => {
      const fd = new FaultDescription("あ".repeat(2000));
      expect(fd.value).toBe("あ".repeat(2000));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new FaultDescription("")).toThrow(ValidationError);
      expect(() => new FaultDescription("")).toThrow("故障内容は必須です");
    });

    it("空白のみを拒否する（trim 後に空になるため）", () => {
      expect(() => new FaultDescription("   ")).toThrow(ValidationError);
    });

    it("2001文字以上を拒否する", () => {
      expect(() => new FaultDescription("あ".repeat(2001))).toThrow(ValidationError);
      expect(() => new FaultDescription("あ".repeat(2001))).toThrow(
        "故障内容は2000文字以内で入力してください"
      );
    });
  });
});
