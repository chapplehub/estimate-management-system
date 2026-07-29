import { describe, expect, it } from "vitest";
import { FIXTURE_PRODUCT_UNIT_PRICE } from "../ensureEstimateFixtures";

/**
 * フィクスチャ商品の正準単価は全テストファイルで共有される定数であり、金額を検証する
 * テストは「この値と異なる値」を意図的に作って観測可能性を確保している
 * （例: DuplicateEstimateCommand.test.ts の複製時再解決）。
 * 値が黙って変わると、それらのテストが「異なる値」を作れているつもりのまま同値になり、
 * 検証が空振りする。定数そのものを固定して、変更を必ず此処で顕在化させる。
 */
describe("ensureEstimateFixtures の正準単価", () => {
  it("フィクスチャ商品の共通販売単価は 1000 円に固定されている", () => {
    expect(FIXTURE_PRODUCT_UNIT_PRICE).toBe(1000);
  });
});
