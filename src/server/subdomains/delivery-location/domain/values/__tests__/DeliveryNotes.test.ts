import { describe, expect, it } from "vitest";
import { DeliveryNotes } from "../DeliveryNotes";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("DeliveryNotes", () => {
  describe("正常系", () => {
    it("備考を受け入れる", () => {
      const notes = new DeliveryNotes("午前中配送希望");
      expect(notes.value).toBe("午前中配送希望");
    });

    it("前後の空白はトリムされる", () => {
      const notes = new DeliveryNotes("  午前中配送  ");
      expect(notes.value).toBe("午前中配送");
    });

    it("500文字の備考を受け入れる", () => {
      const notes = new DeliveryNotes("あ".repeat(500));
      expect(notes.value).toBe("あ".repeat(500));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new DeliveryNotes("")).toThrow(ValidationError);
      expect(() => new DeliveryNotes("")).toThrow("配送備考は必須です");
    });

    it("501文字以上を拒否する", () => {
      expect(() => new DeliveryNotes("あ".repeat(501))).toThrow(ValidationError);
      expect(() => new DeliveryNotes("あ".repeat(501))).toThrow(
        "配送備考は500文字以内で入力してください"
      );
    });
  });
});
