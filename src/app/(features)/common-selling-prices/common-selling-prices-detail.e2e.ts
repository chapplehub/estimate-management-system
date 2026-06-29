import { type Page, expect, test } from "@playwright/test";

/**
 * 共通販売単価 詳細（UC-2）の E2E。
 *
 * PRD901 は失効/現在有効/将来の3期間を持つ（today 相対シード・ADR-20260629-3x5）。状態バッジ
 * （現在有効/将来/失効）と、authorityFor によるミューテーションボタンの出し分け
 * （将来=編集/削除・現在有効=適用終了・失効=操作なし）を検証する。並列・共通シード（DB 不変）。
 * 管理者 storageState（既定）のため操作列が描画される（権限非表示は CRUD/権限 E2E で検証）。
 */

/** 詳細のハイドレーション完了を待つ。適用期間テーブルの先頭行が見えた時点で操作可能と判断。 */
async function waitForDetailReady(page: Page) {
  await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

test.describe("共通販売単価 詳細（UC-2）", () => {
  test("商品情報と3状態バッジが表示される", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD901");
    await waitForDetailReady(page);

    // 商品情報
    await expect(page.getByRole("heading", { name: "共通販売単価", exact: true })).toBeVisible();
    await expect(page.getByText("PRD901")).toBeVisible();
    await expect(page.getByText("CSP_3状態テスト商品")).toBeVisible();

    // 3状態バッジ（失効/現在有効/将来）が揃う
    await expect(page.getByText("現在有効", { exact: true })).toBeVisible();
    await expect(page.getByText("将来", { exact: true })).toBeVisible();
    await expect(page.getByText("失効", { exact: true })).toBeVisible();

    // 将来行（無期限）の終了日が「無期限」表示
    await expect(page.getByText("無期限")).toBeVisible();
  });

  test("将来行は編集・削除のみ操作できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD901");
    await waitForDetailReady(page);

    const futureRow = page.locator("table tbody tr", { hasText: "将来" });
    await expect(futureRow.getByRole("button", { name: "編集" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "削除" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "適用終了" })).not.toBeVisible();
  });

  test("現在有効行は適用終了のみ操作できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD901");
    await waitForDetailReady(page);

    const activeRow = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(activeRow.getByRole("button", { name: "適用終了" })).toBeVisible();
    await expect(activeRow.getByRole("button", { name: "編集" })).not.toBeVisible();
    await expect(activeRow.getByRole("button", { name: "削除" })).not.toBeVisible();
  });

  test("失効行は操作できない（— 表示）", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD901");
    await waitForDetailReady(page);

    const expiredRow = page.locator("table tbody tr", { hasText: "失効" });
    await expect(expiredRow.getByRole("button")).toHaveCount(0);
    await expect(expiredRow.getByText("—")).toBeVisible();
  });

  test("戻りリンクから一覧へ遷移できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD901");
    await waitForDetailReady(page);

    await page.getByRole("link", { name: "← 共通販売単価一覧に戻る" }).click();

    await expect(page).toHaveURL(/\/common-selling-prices$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "共通販売単価一覧" })).toBeVisible();
  });

  test("存在しない商品コードで404が表示される", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD000NOTEXIST");

    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});
