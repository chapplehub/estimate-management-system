import { expect, test } from "@playwright/test";

/**
 * 見積申請詳細画面（/estimate-applications/[estimateNumber]/[variationNumber]・#574）の E2E。
 *
 * seed-estimate-applications.ts のフィクスチャに対し、表示ブロック（要約ヘッダ・最新申請の承認
 * チェーン・過去履歴の差戻コメント・免除記録）と一覧からの遷移・NotFound を配線検証する。
 * - N9905015: attempt1 差戻（過去履歴）＋ attempt2 多段チェーン（営業課長 承認済 → 営業部長 承認待ち）
 * - N9905013: 承認免除（EXEMPTED）
 *
 * 導出状態の網羅は BE 単体（#573 クエリテスト・§3.6 導出）に委ね、ここは画面配線の担保に集中する
 * （ADR-0012）。read-only のため非 serial。
 */
const RICH = "N9905015";
const EXEMPTED = "N9905013";
const NONEXISTENT = "N9999999";

test.describe("見積申請詳細", () => {
  test("APPLICATIONS: 要約・見積詳細リンク・最新チェーン・過去の差戻コメントが読める", async ({
    page,
  }) => {
    await page.goto(`/estimate-applications/${RICH}/1`);

    await expect(page.getByRole("heading", { name: "見積申請詳細" })).toBeVisible();

    // 要約ヘッダ: 見積番号は見積詳細（業務キー URL）へリンク・申請状態は最新=PENDING の「申請中」。
    await expect(page.getByRole("link", { name: RICH })).toHaveAttribute(
      "href",
      `/estimates/${RICH}`
    );
    await expect(page.getByText("申請中").first()).toBeVisible();

    // 最新申請（attempt2）: 申請者と多段チェーンの各ステップ状態・承認者を弁別する。
    await expect(page.getByRole("heading", { name: "最新の申請" })).toBeVisible();
    await expect(page.getByText("佐藤 太郎").first()).toBeVisible();

    // step1 営業課長=承認済（承認者 鈴木 次郎）、step2 営業部長=承認待ち。
    const latestStep1 = page
      .locator("tr")
      .filter({ hasText: "営業課長" })
      .filter({ hasText: "承認済" });
    await expect(latestStep1).toContainText("鈴木 次郎");
    const latestStep2 = page.locator("tr").filter({ hasText: "営業部長" });
    await expect(latestStep2).toContainText("承認待ち");

    // 過去履歴（attempt1）: 差戻ステップと差戻コメントが読める（画面主目的）。
    await expect(page.getByRole("heading", { name: "過去の申請履歴" })).toBeVisible();
    const pastRejected = page
      .locator("tr")
      .filter({ hasText: "営業課長" })
      .filter({ hasText: "差戻" });
    await expect(pastRejected).toContainText("鈴木 次郎");
    await expect(page.getByText("金額の根拠資料を添付してください")).toBeVisible();
  });

  test("EXEMPTED: 免除記録（理由・実施者）と要約ヘッダの「承認不要」バッジが読める", async ({
    page,
  }) => {
    await page.goto(`/estimate-applications/${EXEMPTED}/1`);

    await expect(page.getByRole("heading", { name: "見積申請詳細" })).toBeVisible();
    await expect(page.getByText("承認不要").first()).toBeVisible();

    // 免除記録: 理由 label（10万円未満）・実施者（高橋 三郎）。承認チェーン枝は出ない。
    await expect(page.getByRole("heading", { name: "免除記録" })).toBeVisible();
    await expect(page.getByText("10万円未満")).toBeVisible();
    await expect(page.getByText("高橋 三郎")).toBeVisible();
    await expect(page.getByRole("heading", { name: "最新の申請" })).toHaveCount(0);
  });

  test("NotFound: 存在しない見積番号で 404 になる", async ({ page }) => {
    const response = await page.goto(`/estimate-applications/${NONEXISTENT}/1`);
    expect(response?.status()).toBe(404);
  });

  test("一覧→詳細: 見積番号リンクをクリックして詳細へ着地する", async ({ page }) => {
    await page.goto(`/estimate-applications?estimateNumber=${RICH}`);
    await expect(page.getByRole("heading", { name: "見積申請一覧" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    await page.getByRole("link", { name: RICH }).click();

    await expect(page).toHaveURL(new RegExp(`/estimate-applications/${RICH}/1`));
    await expect(page.getByRole("heading", { name: "見積申請詳細" })).toBeVisible();
  });
});
