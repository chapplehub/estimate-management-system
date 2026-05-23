import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Money } from "../Money";
import { TaxRoundingType } from "../TaxRoundingType";

describe("TaxRoundingType", () => {
  describe("from", () => {
    it("有効な区分文字列からインスタンスを取得できる", () => {
      expect(TaxRoundingType.from("ROUND_DOWN")).toBe(TaxRoundingType.ROUND_DOWN);
      expect(TaxRoundingType.from("ROUND_UP")).toBe(TaxRoundingType.ROUND_UP);
      expect(TaxRoundingType.from("ROUND")).toBe(TaxRoundingType.ROUND);
    });

    it("不正な区分はエラー", () => {
      expect(() => TaxRoundingType.from("INVALID")).toThrow(ValidationError);
      expect(() => TaxRoundingType.from("INVALID")).toThrow("不正な端数処理区分です: INVALID");
    });
  });

  describe("applyTo", () => {
    // 税額 100.4円（= 10040銭）と 100.5円（= 10050銭）を題材に各区分の丸めを検証する
    const amount4 = Money.fromMinorUnits(10_040); // 100.40円
    const amount5 = Money.fromMinorUnits(10_050); // 100.50円

    it("ROUND_DOWN は円未満を切り捨てる", () => {
      expect(TaxRoundingType.ROUND_DOWN.applyTo(amount4).majorUnits).toBe(100);
      expect(TaxRoundingType.ROUND_DOWN.applyTo(amount5).majorUnits).toBe(100);
    });

    it("ROUND_UP は円未満を切り上げる", () => {
      expect(TaxRoundingType.ROUND_UP.applyTo(amount4).majorUnits).toBe(101);
      expect(TaxRoundingType.ROUND_UP.applyTo(amount5).majorUnits).toBe(101);
    });

    it("ROUND は四捨五入する", () => {
      expect(TaxRoundingType.ROUND.applyTo(amount4).majorUnits).toBe(100);
      expect(TaxRoundingType.ROUND.applyTo(amount5).majorUnits).toBe(101);
    });
  });
});
