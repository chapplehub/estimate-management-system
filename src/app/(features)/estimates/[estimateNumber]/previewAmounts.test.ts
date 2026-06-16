import { describe, expect, it } from "vitest";
import { previewGroupAmount, previewLineAmount, previewVariationTotals } from "./previewAmounts";

describe("previewLineAmount（行の最終金額・円単位の近似）", () => {
  it("数量×単価×掛率−明細値引（掛率1.0・値引0なら数量×単価）", () => {
    expect(
      previewLineAmount({ quantity: 2, unitPrice: 1000, discountRate: 1.0, itemDiscount: 0 })
    ).toBe(2000);
  });

  it("掛率と明細値引を順に適用する（掛率→値引）", () => {
    // base = 2000, 掛率0.95 → 1900, 値引100 → 1800
    expect(
      previewLineAmount({ quantity: 2, unitPrice: 1000, discountRate: 0.95, itemDiscount: 100 })
    ).toBe(1800);
  });

  it("掛率適用後は円未満を切り捨てる（§8.1(2)）", () => {
    // base = 300, 300 × 0.333 = 99.9 → floor 99
    expect(
      previewLineAmount({ quantity: 3, unitPrice: 100, discountRate: 0.333, itemDiscount: 0 })
    ).toBe(99);
  });
});

describe("previewVariationTotals（小計→全体値引→税→合計の近似）", () => {
  const lines = [
    { quantity: 2, unitPrice: 1000, discountRate: 0.95, itemDiscount: 100 }, // 1800
    { quantity: 2, unitPrice: 1000, discountRate: 1.0, itemDiscount: 0 }, // 2000
  ];

  it("小計＝Σ行金額、全体値引後＝小計−全体値引、税・合計を返す", () => {
    const totals = previewVariationTotals({
      lines,
      overallDiscount: 300,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
    });

    expect(totals.subtotal).toBe(3800);
    expect(totals.afterOverallDiscount).toBe(3500); // 3800 − 300
    expect(totals.taxAmount).toBe(350); // floor(3500 × 0.1)
    expect(totals.finalTotal).toBe(3850); // 3500 + 350
  });

  it("税端数区分で税額の丸めを切り替える（端数 350.1 のとき）", () => {
    // afterOverallDiscount = 3501 → rawTax = 350.1
    const base = {
      lines: [{ quantity: 1, unitPrice: 3501, discountRate: 1.0, itemDiscount: 0 }],
      overallDiscount: 0,
      taxRate: 0.1,
    };

    expect(previewVariationTotals({ ...base, taxRoundingType: "ROUND_DOWN" }).taxAmount).toBe(350);
    expect(previewVariationTotals({ ...base, taxRoundingType: "ROUND_UP" }).taxAmount).toBe(351);
    expect(previewVariationTotals({ ...base, taxRoundingType: "ROUND" }).taxAmount).toBe(350);
  });
});

describe("previewGroupAmount（セット群の表示金額＝構成合計の導出）", () => {
  it("構成明細の最終金額を合計する（群自身は価格を持たない・ADR-0047）", () => {
    const amount = previewGroupAmount([
      { quantity: 1, unitPrice: 1000, discountRate: 1.0, itemDiscount: 0 },
      { quantity: 2, unitPrice: 500, discountRate: 1.0, itemDiscount: 0 },
    ]);
    // 1000 + 1000 = 2000
    expect(amount).toBe(2000);
  });

  it("構成ゼロなら 0（呼び出し側で空群は禁止されるが安全側）", () => {
    expect(previewGroupAmount([])).toBe(0);
  });
});
