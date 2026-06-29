import { type Page, expect, test } from "@playwright/test";

/**
 * 共通販売単価 CRUD/権限（UC-3/4/5＋ドメインエラー＋権限）の E2E。
 *
 * DB 変更系は専用商品（PRD822=Chain A・PRD824=Chain B）に隔離し、関心ごとに serial chain へ分割する
 * （ADR-0020 判断1）。入力日付は today（JST 暦日）相対で生成し、新規期間は不変条件上 開始 ≥ 今日とする
 * （ADR-20260629-3x5）。重複拒否は登録が拒否され DB を変えないため母体 PRD820 で並列・不変として検証する。
 *
 * 対象外（コメントのみ）:
 * - 楽観ロック競合（version 不一致）: UI からの誘発が困難（同一行の同時 2 操作が要る）。
 * - 状態別サーバ拒否（失効/現在有効行の編集削除など）: #482 後は UI から不可達（ボタン自体が出ない）。
 *   認可・状態別不変条件の正本検証は BE/アクション層に委ねる（deviations.md 参照）。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 実行時の今日（JST 暦日）に dayOffset 日を加えた `"YYYY-MM-DD"`。シードの jstRelativeDate と同型。 */
function jstRelativeDate(dayOffset: number): string {
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const baseUtcMs = Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate());
  const shifted = new Date(baseUtcMs + dayOffset * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 管理者の詳細パネルが操作可能になるのを待つ（新規追加ボタンの可視＝admin 用 UI 描画済み）。 */
async function waitForAdminDetailReady(page: Page) {
  await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新規追加" })).toBeVisible();
}

test.describe.serial("共通販売単価 Chain A（登録→編集→削除・PRD822）", () => {
  test("UC-3: 将来期間を新規登録できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD822");
    await waitForAdminDetailReady(page);
    // 初期は未設定（CSP 集約なし）
    await expect(page.getByText("適用期間が未設定です")).toBeVisible();

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(30)); // 将来 [today+30, ∞)
    await page.getByLabel("共通販売単価（円）").fill("5000"); // 終了日は空＝無期限
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("¥5,000")).toBeVisible();
    await expect(row.getByText("無期限")).toBeVisible();
  });

  test("UC-4: 将来行の単価・適用開始日を編集できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD822");
    await waitForAdminDetailReady(page);

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await row.getByRole("button", { name: "編集" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の編集" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(45));
    await page.getByLabel("共通販売単価（円）").fill("6000");
    await page.locator("form").getByRole("button", { name: "更新" }).click();

    const updated = page.locator("table tbody tr", { hasText: "将来" });
    await expect(updated.getByText("¥6,000")).toBeVisible({ timeout: 10000 });
    await expect(updated.getByText(jstRelativeDate(45))).toBeVisible();
  });

  test("UC-5: 将来行を削除すると未設定に戻る", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD822");
    await waitForAdminDetailReady(page);

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await row.getByRole("button", { name: "削除" }).click();
    // 行内2段階確認
    await expect(row.getByText("削除しますか？")).toBeVisible();
    await row.getByRole("button", { name: "削除する" }).click();

    // 0期間 → 未設定メッセージへ自己クリーン
    await expect(page.getByText("適用期間が未設定です")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table tbody tr")).toHaveCount(0);
  });
});

test.describe.serial("共通販売単価 Chain B（登録→適用終了→改定・PRD824）", () => {
  test("UC-3: 現在有効期間を新規登録できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD824");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(0)); // today → 現在有効 [today, ∞)
    await page.getByLabel("共通販売単価（円）").fill("4000");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const row = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(row.getByText("¥4,000")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("無期限")).toBeVisible();
  });

  test("UC-4: 現在有効行に適用終了日を設定できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD824");
    await waitForAdminDetailReady(page);

    const row = page.locator("table tbody tr", { hasText: "現在有効" });
    await row.getByRole("button", { name: "適用終了" }).click();
    await expect(page.getByRole("heading", { name: "適用終了（終了日の設定）" })).toBeVisible();

    await page.getByLabel("適用終了日").fill(jstRelativeDate(30));
    // 行アクションの「適用終了」と衝突するためフォーム内の送信ボタンにスコープする
    await page.locator("form").getByRole("button", { name: "適用終了" }).click();

    // [today, today+30) のため依然「現在有効」だが、終了日が設定される
    const active = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(active.getByText(jstRelativeDate(30))).toBeVisible({ timeout: 10000 });
  });

  test("UC-3: 改定として新たな将来期間を追加できる", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD824");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(30)); // [today+30, ∞)（現在有効に隣接）
    await page.getByLabel("共通販売単価（円）").fill("4500");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const future = page.locator("table tbody tr", { hasText: "将来" });
    await expect(future.getByText("¥4,500")).toBeVisible({ timeout: 10000 });
    // 現在有効行（改定前）も残り、2期間が並ぶ
    await expect(page.locator("table tbody tr", { hasText: "現在有効" })).toBeVisible();
  });
});

test.describe("共通販売単価 ドメインエラー（重複拒否・PRD820・DB不変）", () => {
  test("現在有効期間に重なる登録はフォームエラーで拒否される", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD820");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    // today は現在有効 [today-30, today+30) に含まれるため、重複で拒否される
    await page.getByLabel("適用開始日").fill(jstRelativeDate(0));
    await page.getByLabel("共通販売単価（円）").fill("9999");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("共通販売単価（一般ユーザー・#482）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一覧・詳細は閲覧できる", async ({ page }) => {
    await page.goto("/common-selling-prices");
    await expect(page.getByRole("heading", { name: "共通販売単価一覧" })).toBeVisible();

    await page.goto("/common-selling-prices/PRD820");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("ミューテーション系UIが一切表示されない", async ({ page }) => {
    await page.goto("/common-selling-prices/PRD820");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    // 「操作」列ヘッダーごと描画されない（#482・PR #484）
    const headers = await page.locator("table thead th").allTextContents();
    expect(headers).not.toContain("操作");

    // 新規追加・各行操作ボタンが一切無い
    await expect(page.getByRole("button", { name: "新規追加" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "適用終了" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
  });
});
