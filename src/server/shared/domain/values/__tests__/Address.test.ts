import { describe, expect, it } from "vitest";
import { Address } from "../Address";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("Address", () => {
  describe("正常系", () => {
    it("住所を受け入れる", () => {
      const address = new Address("渋谷区神宮前1-2-3");
      expect(address.value).toBe("渋谷区神宮前1-2-3");
    });

    it("前後の空白はトリムされる", () => {
      const address = new Address("  渋谷区1-2-3  ");
      expect(address.value).toBe("渋谷区1-2-3");
    });

    it("200文字の住所を受け入れる", () => {
      const address = new Address("あ".repeat(200));
      expect(address.value).toBe("あ".repeat(200));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new Address("")).toThrow(ValidationError);
      expect(() => new Address("")).toThrow("住所は必須です");
    });

    it("201文字以上を拒否する", () => {
      expect(() => new Address("あ".repeat(201))).toThrow(ValidationError);
      expect(() => new Address("あ".repeat(201))).toThrow("住所は200文字以内で入力してください");
    });
  });
});
