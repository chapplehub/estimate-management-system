import { describe, expect, it } from "vitest";
import { Currency } from "../Currency";

describe("Currency", () => {
  describe("正常系", () => {
    it("JPY は通貨コード JPY・最小単位スケール2を持つ", () => {
      expect(Currency.JPY.code).toBe("JPY");
      expect(Currency.JPY.minorUnitScale).toBe(2);
    });

    it("JPY の主単位1あたりの最小単位数は100（1円=100銭）", () => {
      expect(Currency.JPY.minorUnitsPerMajorUnit).toBe(100);
    });

    it("同じ通貨コードは等価である", () => {
      expect(Currency.JPY.equals(Currency.JPY)).toBe(true);
    });

    it("toString で通貨コードを返す", () => {
      expect(Currency.JPY.toString()).toBe("JPY");
    });
  });
});
