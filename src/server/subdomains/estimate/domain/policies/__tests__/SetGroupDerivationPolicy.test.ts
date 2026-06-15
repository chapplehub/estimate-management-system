import { describe, expect, it } from "vitest";
import { Money } from "../../values/Money";
import { SetGroupDerivationPolicy } from "../SetGroupDerivationPolicy";

describe("SetGroupDerivationPolicy", () => {
  it("セット群の金額は構成明細 finalAmount の合計", () => {
    const result = SetGroupDerivationPolicy.derive([
      { finalAmount: Money.fromMajorUnits(1000), sortOrder: 3 },
      { finalAmount: Money.fromMajorUnits(500), sortOrder: 5 },
    ]);

    expect(result.amount.equals(Money.fromMajorUnits(1500))).toBe(true);
  });

  it("セット群の表示位置は構成明細 sortOrder の最小値", () => {
    const result = SetGroupDerivationPolicy.derive([
      { finalAmount: Money.fromMajorUnits(1000), sortOrder: 5 },
      { finalAmount: Money.fromMajorUnits(500), sortOrder: 2 },
      { finalAmount: Money.fromMajorUnits(300), sortOrder: 9 },
    ]);

    expect(result.sortOrder).toBe(2);
  });
});
