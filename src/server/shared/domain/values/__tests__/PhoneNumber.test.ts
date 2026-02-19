import { describe, expect, it } from "vitest";
import { PhoneNumber } from "../PhoneNumber";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("PhoneNumber", () => {
  describe("正常系", () => {
    it("10桁の電話番号を受け入れる", () => {
      const phone = new PhoneNumber("0312345678");
      expect(phone.value).toBe("0312345678");
    });

    it("11桁の電話番号を受け入れる", () => {
      const phone = new PhoneNumber("09012345678");
      expect(phone.value).toBe("09012345678");
    });

    it("ハイフン付きを受け入れてハイフンなしに正規化する", () => {
      const phone = new PhoneNumber("03-1234-5678");
      expect(phone.value).toBe("0312345678");
    });
  });

  describe("異常系", () => {
    it("9桁を拒否する", () => {
      expect(() => new PhoneNumber("031234567")).toThrow(ValidationError);
    });

    it("12桁を拒否する", () => {
      expect(() => new PhoneNumber("031234567890")).toThrow(ValidationError);
    });

    it("英字を含む場合を拒否する", () => {
      expect(() => new PhoneNumber("03-ABCD-5678")).toThrow(ValidationError);
    });

    it("空文字を拒否する", () => {
      expect(() => new PhoneNumber("")).toThrow(ValidationError);
    });
  });
});
