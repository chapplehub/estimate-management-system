import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ItemName } from "../ItemName";

describe("ItemName", () => {
  describe("正常系", () => {
    it("商品名を受け入れる", () => {
      const name = new ItemName("高圧洗浄ポンプ");
      expect(name.value).toBe("高圧洗浄ポンプ");
    });

    it("前後の空白はトリムされる", () => {
      const name = new ItemName("  高圧洗浄ポンプ  ");
      expect(name.value).toBe("高圧洗浄ポンプ");
    });

    it("100文字を受け入れる", () => {
      const name = new ItemName("あ".repeat(100));
      expect(name.value).toBe("あ".repeat(100));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new ItemName("")).toThrow(ValidationError);
      expect(() => new ItemName("")).toThrow("商品名は必須です");
    });

    it("空白のみを拒否する（trim 後に空になるため）", () => {
      expect(() => new ItemName("   ")).toThrow(ValidationError);
    });

    it("101文字以上を拒否する", () => {
      expect(() => new ItemName("あ".repeat(101))).toThrow(ValidationError);
      expect(() => new ItemName("あ".repeat(101))).toThrow("商品名は100文字以内で入力してください");
    });
  });
});
