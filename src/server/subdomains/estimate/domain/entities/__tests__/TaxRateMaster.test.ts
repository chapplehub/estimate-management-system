import { describe, expect, it } from "vitest";
import { TaxRate } from "../../values/TaxRate";
import { TaxRateMasterId } from "../../values/TaxRateMasterId";
import { TaxRateMaster } from "../TaxRateMaster";

describe("TaxRateMaster Entity", () => {
  it("reconstruct で復元した値を getter で取得できる", () => {
    const id = new TaxRateMasterId("0190b6d2-7f3a-7c8e-8b4f-1a2b3c4d5e6f");
    const rate = new TaxRate(0.1);
    const effectiveFrom = new Date("2019-10-01T00:00:00+09:00");

    const master = TaxRateMaster.reconstruct(id, rate, effectiveFrom);

    expect(master.id.value).toBe("0190b6d2-7f3a-7c8e-8b4f-1a2b3c4d5e6f");
    expect(master.rate.equals(rate)).toBe(true);
    expect(master.effectiveFrom).toEqual(effectiveFrom);
  });
});
