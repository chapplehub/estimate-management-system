import { describe, expect, it } from "vitest";
import { FaxNumber } from "../FaxNumber";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("FaxNumber", () => {
  describe("正常系", () => {
    it("10桁のFAX番号を受け入れる", () => {
      const fax = new FaxNumber("0312345678");
      expect(fax.value).toBe("0312345678");
    });

    it("ハイフン付きを受け入れてハイフンなしに正規化する", () => {
      const fax = new FaxNumber("03-1234-5678");
      expect(fax.value).toBe("0312345678");
    });
  });

  describe("異常系", () => {
    it("9桁を拒否する", () => {
      expect(() => new FaxNumber("031234567")).toThrow(ValidationError);
      expect(() => new FaxNumber("031234567")).toThrow("FAX番号は10文字以上で入力してください");
    });

    it("空文字を拒否する", () => {
      expect(() => new FaxNumber("")).toThrow(ValidationError);
      expect(() => new FaxNumber("")).toThrow("FAX番号は10文字以上で入力してください");
    });
  });
});
