import { expect, test } from "@playwright/test";

/** dt ラベルに対応する dd の値を取得するヘルパー */
function field(page: import("@playwright/test").Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("+ dd");
}

test.describe("納品先詳細", () => {
  test("基本情報が正しく表示される", async ({ page }) => {
    await page.goto("/delivery-locations/D001");

    await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "取引先基本情報" })).toBeVisible();

    await expect(field(page, "コード")).toContainText("D001");
    await expect(field(page, "名前")).toContainText("山田製作所 東京倉庫");
    await expect(field(page, "郵便番号")).toContainText("135-0061");
    await expect(field(page, "都道府県")).toContainText("東京都");
    await expect(field(page, "住所")).toContainText("江東区豊洲3-2-1");
    await expect(field(page, "電話番号")).toContainText("0362345678");
    await expect(field(page, "FAX番号")).toContainText("-");
    await expect(field(page, "担当者")).toContainText("-");
    await expect(field(page, "状態")).toContainText("有効");
  });

  test("納品先固有情報が表示される", async ({ page }) => {
    await page.goto("/delivery-locations/D001");

    await expect(page.getByRole("heading", { name: "納品先固有情報" })).toBeVisible();

    // 親得意先リンク
    const customerLink = page.getByRole("link", { name: "株式会社山田製作所" });
    await expect(customerLink).toBeVisible();
    await expect(customerLink).toHaveAttribute("href", "/customers/C001");

    // 配送時注意事項
    await expect(page.getByText("平日9:00-17:00のみ受付")).toBeVisible();
  });

  test("パンくずリンクから一覧に戻れる", async ({ page }) => {
    await page.goto("/delivery-locations/D001");

    const breadcrumb = page.getByRole("link", { name: "← 納品先一覧に戻る" });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();

    await expect(page).toHaveURL(/\/delivery-locations$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
  });

  test("親得意先リンクのhrefが正しい", async ({ page }) => {
    await page.goto("/delivery-locations/D003");

    const customerLink = page.getByRole("link", { name: "東京電子工業株式会社" });
    await expect(customerLink).toHaveAttribute("href", "/customers/C002");
  });

  test("NULL項目がハイフンまたは「なし」で表示される", async ({ page }) => {
    await page.goto("/delivery-locations/D007");

    await expect(field(page, "コード")).toContainText("D007");
    await expect(field(page, "名前")).toContainText("大阪機械 東大阪倉庫");

    // null項目はハイフン表示
    await expect(field(page, "電話番号")).toContainText("-");
    await expect(field(page, "FAX番号")).toContainText("-");
    await expect(field(page, "担当者")).toContainText("-");
    await expect(field(page, "状態")).toContainText("無効");

    // deliveryNotes=null は「なし」表示
    await expect(page.getByText("なし")).toBeVisible();
  });

  test("存在しない納品先コードで404が返る", async ({ page }) => {
    const response = await page.goto("/delivery-locations/NONEXIST");
    expect(response?.status()).toBe(404);
  });
});
