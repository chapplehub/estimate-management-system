import { expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S6（バリエーション複製・新規追加 / C3）の E2E。seed-estimates / seed-e2e の
 * 決定的データに対し、適格性ゲート（複製ボタンの表示可否）・提出区分を選んだ新規追加・既存バリの
 * 複製プリフィル→保存→一覧反映を検証する（ADR-0017/0020）。
 *
 * 「系譜が作られない」ことは DB を直接参照しないと観測できず、ADR-0012（テストで Prisma 直接利用
 * 禁止）に反するため E2E では検証しない。系譜なしは C3 AddVariation の設計上の保証（ドメイン
 * ユニットテスト済み）として扱い、ここでは UI 観測可能な結果（提出区分固定・内容プリフィル・
 * 新タブ出現）のみを検証する。
 */
const SOURCE = "N9905003"; // 単一 ACTIVE バリ(V1・CUSTOMER・1明細・セット群なし・非改訂)
const HAS_REVISED_LINE = "N9905001"; // 既定タブ V1 に改訂価格明細を含む（複製元にできない）

test.describe("バリエーション複製・新規追加（適格性ゲート）", () => {
  test("複製可能バリでは『複製』『＋バリエーション追加』が表示される", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await expect(page.getByRole("button", { name: "複製", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "＋バリエーション追加" })).toBeVisible();
  });

  test("改訂明細を含むタブでは『複製』が表示されない（状態不問・改訂先は複製不可）", async ({
    page,
  }) => {
    await page.goto(`/estimates/${HAS_REVISED_LINE}`);
    // 既定タブ＝V1（改訂価格明細あり）。UI 抑止（最終強制はドメイン）。
    await expect(page.getByRole("button", { name: "複製", exact: true })).toHaveCount(0);
  });
});

test.describe.serial("バリエーション複製・新規追加（S6・C3 / N9905003）", () => {
  test("提出区分を選んで新規追加→空バリ保存→新タブ（提出区分つき）が現れる", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await page.getByRole("button", { name: "＋バリエーション追加" }).click();

    // 新規追加は提出区分を選択できる（白紙）。納品先向けを選ぶ。
    await page.getByLabel("提出区分").selectOption("DELIVERY_LOCATION");
    // 明細ゼロのまま保存（ドメインが空配列を許可・§5）。
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    // 新バリ(V2)タブが現れ、提出区分バッジが納品先向け。
    const tab2 = page.getByRole("tab", { name: "バリエーション2" });
    await expect(tab2).toBeVisible();
    await tab2.click();
    await expect(page.getByText("納品先向け")).toBeVisible();
  });

  test("既存バリを複製→提出区分固定でプリフィル→保存→新タブが現れる", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    // 既定タブ＝V1(CUSTOMER・1明細)。複製で作成フォームを開く。
    await page.getByRole("button", { name: "複製", exact: true }).click();

    // 提出区分は複製元から引き継ぎ固定（変更不可）。
    await expect(page.getByText("（複製元から引き継ぎ・変更不可）")).toBeVisible();
    // 複製元の明細がプリフィルされている（削除ボタンの存在で確認）。
    await expect(page.getByRole("button", { name: /明細を削除/ })).toBeVisible();

    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("見積を更新しました。")).toBeVisible();

    // 複製で新タブ（V3＝前テストの新規追加 V2 の次）が現れる。
    await expect(page.getByRole("tab", { name: "バリエーション3" })).toBeVisible();
    // 複製元 V1 は不変（既定タブに元の明細が残る）。
    await page.getByRole("tab", { name: "バリエーション1" }).click();
    await expect(page.locator("table tbody tr", { hasText: "編集対象明細" })).toBeVisible();
  });
});
