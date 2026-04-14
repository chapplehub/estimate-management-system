import { expect, test } from "@playwright/test";

/** dt ラベルに対応する dd の値を取得するヘルパー */
function field(page: import("@playwright/test").Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("+ dd");
}

test.describe("得意先詳細", () => {
  test("基本情報が正しく表示される", async ({ page }) => {
    await page.goto("/customers/C001");

    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "取引先基本情報" })).toBeVisible();

    await expect(field(page, "コード")).toContainText("C001");
    await expect(field(page, "名前")).toContainText("株式会社山田製作所");
    await expect(field(page, "郵便番号")).toContainText("100-0001");
    await expect(field(page, "都道府県")).toContainText("東京都");
    await expect(field(page, "住所")).toContainText("千代田区千代田1-1-1");
    await expect(field(page, "電話番号")).toContainText("0312345678");
    await expect(field(page, "FAX番号")).toContainText("0312345679");
    await expect(field(page, "担当者")).toContainText("山田 太郎");
    await expect(field(page, "状態")).toContainText("有効");
  });

  test("得意先固有情報が表示される", async ({ page }) => {
    await page.goto("/customers/C001");

    await expect(page.getByRole("heading", { name: "得意先固有情報" })).toBeVisible();

    // マージン率
    await expect(page.getByText("10.00%")).toBeVisible();

    // 配下の納品先テーブル
    await expect(page.getByText("配下の納品先")).toBeVisible();
    const dlRows = page.locator("table tbody tr");
    await expect(dlRows).toHaveCount(2);
    await expect(page.getByRole("link", { name: "D001" })).toBeVisible();
    await expect(page.getByText("山田製作所 東京倉庫")).toBeVisible();
    await expect(page.getByRole("link", { name: "D002" })).toBeVisible();
    await expect(page.getByText("山田製作所 埼玉工場")).toBeVisible();
  });

  test("パンくずリンクから一覧に戻れる", async ({ page }) => {
    await page.goto("/customers/C001");

    const breadcrumb = page.getByRole("link", { name: "← 得意先一覧に戻る" });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();

    await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
  });

  test("納品先コードリンクのhrefが正しい", async ({ page }) => {
    await page.goto("/customers/C001");

    const dlLink = page.getByRole("link", { name: "D001" });
    await expect(dlLink).toHaveAttribute("href", "/delivery-locations/D001");
  });

  test("納品先が存在しない得意先の表示", async ({ page }) => {
    await page.goto("/customers/C004");

    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
    await expect(field(page, "コード")).toContainText("C004");
    await expect(field(page, "名前")).toContainText("名古屋精密機器株式会社");
    await expect(field(page, "状態")).toContainText("無効");

    // 納品先なしのメッセージ
    await expect(page.getByText("納品先が登録されていません")).toBeVisible();
  });

  test("NULL項目がハイフンまたは未設定で表示される", async ({ page }) => {
    await page.goto("/customers/C005");

    await expect(field(page, "コード")).toContainText("C005");
    await expect(field(page, "名前")).toContainText("福岡商事株式会社");

    // null項目はハイフン表示
    await expect(field(page, "FAX番号")).toContainText("-");
    await expect(field(page, "担当者")).toContainText("-");

    // marginRate=null は「未設定」表示
    await expect(page.getByText("未設定")).toBeVisible();
  });

  test("存在しない得意先コードで404が返る", async ({ page }) => {
    const response = await page.goto("/customers/NONEXIST");
    expect(response?.status()).toBe(404);
  });
});
