import { describe, expect, it } from "vitest";

import { FIXTURE_PRODUCT_UNIT_PRICE } from "../ensureEstimateFixtures";

describe("ensureEstimateFixtures の正準単価", () => {
  it("フィクスチャ商品の共通販売単価は 1000 円に固定されている", () => {
    expect(FIXTURE_PRODUCT_UNIT_PRICE).toBe(1000);
  });
});
