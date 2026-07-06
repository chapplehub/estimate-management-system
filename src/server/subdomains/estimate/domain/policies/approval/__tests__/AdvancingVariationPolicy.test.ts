import { describe, expect, it } from "vitest";
import { VariationApplicationState } from "../../../values/approval/VariationApplicationState";
import { AdvancingVariationPolicy } from "../AdvancingVariationPolicy";

describe("AdvancingVariationPolicy（見積単位の前進ゲート・1見積1前進）", () => {
  it("前進バリが1つも無ければ false（未申請・差戻・取下のみ）", () => {
    expect(
      AdvancingVariationPolicy.hasAdvancingVariation([
        VariationApplicationState.NONE,
        VariationApplicationState.REJECTED,
        VariationApplicationState.WITHDRAWN,
      ])
    ).toBe(false);
  });

  it("申請中（PENDING）が1つでもあれば true", () => {
    expect(
      AdvancingVariationPolicy.hasAdvancingVariation([
        VariationApplicationState.NONE,
        VariationApplicationState.PENDING,
      ])
    ).toBe(true);
  });

  it("承認済（APPROVED）が1つでもあれば true", () => {
    expect(
      AdvancingVariationPolicy.hasAdvancingVariation([
        VariationApplicationState.REJECTED,
        VariationApplicationState.APPROVED,
      ])
    ).toBe(true);
  });

  it("免除（EXEMPTED）が1つでもあれば true（申請と免除を統一した判定）", () => {
    expect(
      AdvancingVariationPolicy.hasAdvancingVariation([
        VariationApplicationState.WITHDRAWN,
        VariationApplicationState.EXEMPTED,
      ])
    ).toBe(true);
  });

  it("バリエーションが空なら false", () => {
    expect(AdvancingVariationPolicy.hasAdvancingVariation([])).toBe(false);
  });
});
