import { describe, expect, it } from "vitest";

import { APPROVAL_TEST_BANDS } from "../approvalTestBands";

/**
 * 承認系テスト見積番号帯レジストリの門番（#493）。
 *
 * 承認系(N9907xxx)の実DB統合テストは共有DB上でファイル毎にサブ帯を占有して隔離する。
 * かつては「帯宣言コメント」という人間頼みの規律で隔離していたため、新テスト著者が既存帯を
 * 見落とすと二重占有 → vitest フルスイート並列時に estimateNumber 一意制約 / beforeEach
 * 相互削除で確率的に落ちる flaky を生んだ。本テストはその衝突を**DB非依存**で機械検出する。
 */
describe("APPROVAL_TEST_BANDS", () => {
  /** 全所有者・全キーの見積番号をフラットな配列に集める。 */
  const allNumbers = Object.values(APPROVAL_TEST_BANDS).flatMap((band) => Object.values(band));

  it("全帯を通して見積番号がグローバルに一意（サブ帯の二重占有を禁止）", () => {
    const unique = new Set(allNumbers);
    // 重複があれば size < length。差分を可視化して落とす。
    const duplicates = allNumbers.filter((n, i) => allNumbers.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
    expect(unique.size).toBe(allNumbers.length);
  });

  it("全見積番号が承認系帯の形式（N9907 接頭辞・8桁）に従う（帯外流出の検出）", () => {
    for (const number of allNumbers) {
      expect(number).toMatch(/^N9907\d{3}$/);
    }
  });
});
