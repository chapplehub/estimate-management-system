import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S2（閲覧）の E2E。seed-estimates.ts の決定的データに対し、タブ切替・提出区分
 * バッジ・改訂価格・無効状態・全無効警告・404 を検証する（非 serial・ADR-0017/0020）。
 * セット群は S5 へ先送りのため本テストでは検証しない。
 */
const FULL = "N9905001"; // 複数バリ・提出区分両方・改訂価格・無効バリ入り
const ALL_INACTIVE = "N9905002"; // 全バリ無効

/** 明細テーブルのヘッダー名から列位置（1始まり）を取得する（ADR-0017）。sticky 列は改行を含むため trim する。 */
async function getColumnIndex(page: Page, headerName: string): Promise<number> {
  const headers = (await page.locator("table thead th").allTextContents()).map((h) => h.trim());
  return headers.indexOf(headerName) + 1;
}

/** ハイドレーション完了の揺らぎに備え、タブクリックが効くまでリトライする。 */
async function selectTab(page: Page, tabName: string, expected: Locator): Promise<void> {
  await expect(async () => {
    await page.getByRole("tab", { name: tabName }).click();
    await expect(expected).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test.describe("見積詳細（閲覧）", () => {
  test("② タイトル行（見積番号・区分バッジ）と ③ 基本情報が表示される", async ({ page }) => {
    await page.goto(`/estimates/${FULL}`);

    await expect(page.getByRole("heading", { name: FULL })).toBeVisible();
    await expect(page.getByText("新規", { exact: true })).toBeVisible();
    await expect(page.getByText("基本情報", { exact: true })).toBeVisible();
  });

  test("④ タブ切替で ⑤ 提出区分バッジが得意先向け→納品先向けに変わる", async ({ page }) => {
    await page.goto(`/estimates/${FULL}`);

    // 既定タブ＝最小番号の ACTIVE バリ（V1・得意先向け）
    await expect(page.getByText("得意先向け", { exact: true })).toBeVisible();

    // V2（納品先向け）へ切替
    await selectTab(page, "バリエーション2", page.getByText("納品先向け", { exact: true }));
    await expect(page.getByText("納品先向け", { exact: true })).toBeVisible();
  });

  test("⑥ 明細の金額が永続集計どおり表示される", async ({ page }) => {
    await page.goto(`/estimates/${FULL}`);

    const amountCol = await getColumnIndex(page, "金額");
    // 商品A: 単価10,000 × 数量2 = 20,000円
    const rowA = page.locator("table tbody tr", { hasText: "商品A" });
    await expect(rowA.locator(`td:nth-child(${amountCol})`)).toHaveText("20,000円");
  });

  test("⑥ 改訂明細の改訂価格（薄字）が表示される（§8.4）", async ({ page }) => {
    await page.goto(`/estimates/${FULL}`);

    const revisedCol = await getColumnIndex(page, "改訂価格");
    const revisedRow = page.locator("table tbody tr", { hasText: "商品C（改訂価格）" });
    await expect(revisedRow.locator(`td:nth-child(${revisedCol})`)).toHaveText("7,000円");
  });

  test("④ 無効バリエーションを選ぶと ⑤ 状態インジケータが無効になる", async ({ page }) => {
    await page.goto(`/estimates/${FULL}`);

    await selectTab(page, "バリエーション3", page.getByText("○ 無効", { exact: true }));
    await expect(page.getByText("○ 無効", { exact: true })).toBeVisible();
  });

  test("全バリ無効の見積で全無効警告が表示される（Q7）", async ({ page }) => {
    await page.goto(`/estimates/${ALL_INACTIVE}`);

    await expect(page.getByRole("alert")).toContainText("すべてのバリエーションが無効です");
  });

  test("存在しない見積番号で 404 になる", async ({ page }) => {
    const response = await page.goto("/estimates/N9999999");
    expect(response?.status()).toBe(404);
  });
});
