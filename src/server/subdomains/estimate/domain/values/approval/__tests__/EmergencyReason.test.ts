import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EmergencyReason } from "../EmergencyReason";

describe("EmergencyReason", () => {
  describe("正常系", () => {
    it("緊急対応理由を受け入れる", () => {
      const er = new EmergencyReason("業務停止のため緊急修理");
      expect(er.value).toBe("業務停止のため緊急修理");
    });

    it("前後の空白はトリムされる", () => {
      const er = new EmergencyReason("  緊急修理  ");
      expect(er.value).toBe("緊急修理");
    });

    it("2000文字を受け入れる", () => {
      const er = new EmergencyReason("あ".repeat(2000));
      expect(er.value).toBe("あ".repeat(2000));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new EmergencyReason("")).toThrow(ValidationError);
      expect(() => new EmergencyReason("")).toThrow("緊急対応理由は必須です");
    });

    it("空白のみを拒否する（trim 後に空になるため）", () => {
      expect(() => new EmergencyReason("   ")).toThrow(ValidationError);
    });

    it("2001文字以上を拒否する", () => {
      expect(() => new EmergencyReason("あ".repeat(2001))).toThrow(ValidationError);
      expect(() => new EmergencyReason("あ".repeat(2001))).toThrow(
        "緊急対応理由は2000文字以内で入力してください"
      );
    });
  });
});
