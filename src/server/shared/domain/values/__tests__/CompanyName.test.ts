import { describe, expect, it } from "vitest";
import { CompanyName } from "../CompanyName";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("CompanyName", () => {
  describe("正常系", () => {
    it("会社名を受け入れる", () => {
      const name = new CompanyName("株式会社テスト");
      expect(name.value).toBe("株式会社テスト");
    });

    it("前後の空白はトリムされる", () => {
      const name = new CompanyName("  株式会社テスト  ");
      expect(name.value).toBe("株式会社テスト");
    });

    it("100文字の名前を受け入れる", () => {
      const name = new CompanyName("あ".repeat(100));
      expect(name.value).toBe("あ".repeat(100));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new CompanyName("")).toThrow(ValidationError);
    });

    it("101文字以上を拒否する", () => {
      expect(() => new CompanyName("あ".repeat(101))).toThrow(ValidationError);
    });
  });
});
