import { expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S5（セット明細の編集 / C4 のセット書き込み・ADR-0047/0052）の E2E。
 * seed-estimates の N9905005（セット群1＝デスクセット一式＋通常明細1・非改訂 ACTIVE）に対し、
 * セット群の閲覧描画・編集テーブルでの群ヘッダ/構成描画・群金額の導出プレビュー・セット商品の
 * 自動展開追加→保存→再表示を検証する（ADR-0017/0020）。
 *
 * D&D（群＝トップレベル／構成＝群内）は dnd-kit のポインタ操作が Playwright で不安定なため E2E に
 * 含めず、set-aware reorder ロジックは reorderNodes / reorderComponents のユニットテストで担保する。
 */
const SET_ESTIMATE = "N9905005";

test.describe("セット群の閲覧（S2 read・ADR-0047）", () => {
  test("セット群ヘッダ・構成明細・導出金額が表示される", async ({ page }) => {
    await page.goto(`/estimates/${SET_ESTIMATE}`);

    // 群ヘッダ（セット商品名）と構成明細。
    await expect(page.getByText("デスクセット一式")).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "構成: デスク" })).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "構成: チェア" })).toBeVisible();
    // 群の導出金額 = 構成合計（3000 + 1500 = 4500）。
    await expect(page.locator("table tbody tr", { hasText: "デスクセット一式" })).toContainText(
      "4,500円"
    );
  });
});

test.describe.serial("セット群の編集（S5・C4 / N9905005）", () => {
  test("編集テーブルに群ヘッダ・構成行が描画され、構成の数量変更で群金額が即時更新される", async ({
    page,
  }) => {
    await page.goto(`/estimates/${SET_ESTIMATE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();
    await expect(page.getByRole("button", { name: "明細追加" }).first()).toBeVisible();

    // 群ヘッダ行（セットバッジ＋商品名）と構成行（インデント）。
    const groupHeader = page.locator('tr[data-kind="setGroup"]', { hasText: "デスクセット一式" });
    await expect(groupHeader).toBeVisible();
    await expect(groupHeader).toContainText("4,500円");
    await expect(page.getByRole("button", { name: "明細を削除（構成: デスク）" })).toBeVisible();

    // 構成「構成: デスク」の数量を 2 に変更 → 構成金額 6000 → 群金額プレビュー 7500（保存しない）。
    await page.getByLabel("数量（構成: デスク）").fill("2");
    await expect(groupHeader).toContainText("7,500円");
  });

  test("セット商品を選ぶと構成が自動展開され、保存後に閲覧へ反映される", async ({ page }) => {
    await page.goto(`/estimates/${SET_ESTIMATE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    // 明細追加モーダルでセット商品（デスクセット一式）を選ぶ。
    await page.getByRole("button", { name: "明細追加" }).click();
    await page.locator("#modal-search-name").fill("デスクセット一式");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /デスクセット一式/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 自動展開された構成（標準デスク・オフィスチェア・単価0要入力）が作業コピーに入る。
    await expect(page.getByRole("button", { name: "明細を削除（標準デスク）" })).toBeVisible();
    await expect(page.getByRole("button", { name: "明細を削除（オフィスチェア）" })).toBeVisible();

    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    // 閲覧モードに自動展開した構成が現れる（保存→再表示）。
    await expect(page.locator("table tbody tr", { hasText: "標準デスク" })).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "オフィスチェア" })).toBeVisible();
  });
});
