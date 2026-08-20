import { type Page, expect, test } from "@playwright/test";

/**
 * 見積一覧画面 S1 の E2E。seed-estimates.ts の決定的データに対し、一覧表示・検索 4 種・
 * クリア・代表選択（ADR-0051）の end-to-end・納品先列・新規登録ボタンの可視性を検証する。
 * read-only のため非 serial（商品一覧と同方針・ADR-0017）。Prisma 直接利用しない（ADR-0012）。
 *
 * 全シード見積は最小コード納品先 D001「山田製作所 東京倉庫」（親得意先 C001
 * 「株式会社山田製作所」）を参照する（seedEstimates の findFirst 既定順）。
 */
const FULL = "N9905001"; // 代表 V1=ACTIVE（NEW）→ 有効 + 代表金額
const ALL_INACTIVE = "N9905002"; // 全バリ INACTIVE → 無効
const REPAIR = "R9905001"; // REPAIR 区分

const CUSTOMER_NAME = "株式会社山田製作所";
const DELIVERY_LOCATION_NAME = "山田製作所 東京倉庫";
// 代表 V1 の永続合計（ADR-0033）: 明細小計 32,500（A 20,000 + B 4,500 + C 8,000）
// − 全体値引 1,000 ＝ 31,500、税 10% 3,150 → 34,650 円。
const FULL_REPRESENTATIVE_TOTAL = "34,650円";

/**
 * 一覧画面のハイドレーション完了を待つ。SearchForm（"use client"）の onSubmit が機能するには
 * React のハイドレーションが必要。DataTable の行表示でページがインタラクティブと判断する。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "見積管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する。 */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("見積一覧（管理者）", () => {
  test("一覧が表示され、管理者には「新規登録」ボタンが見える", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "見積管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "見積一覧" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("見積番号で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await page.getByLabel("見積番号").fill(FULL);
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/estimateNumber=N9905001/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: FULL })).toBeVisible();
  });

  test("得意先名で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await page.getByLabel("得意先名").fill("山田");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/customerName=/, { timeout: 10000 });
    await expect(page.getByText(CUSTOMER_NAME).first()).toBeVisible();
  });

  test("区分で検索できる", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await page.getByLabel("区分").selectOption("REPAIR");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/estimateType=REPAIR/, { timeout: 10000 });
    // 表示されている区分バッジがすべて「修理」であること（REPAIR シードは R9905001）。
    await expect(page.getByRole("link", { name: REPAIR })).toBeVisible();
    const typeCol = await getColumnIndex(page, "区分");
    const typeBadges = page.locator(`table tbody tr td:nth-child(${typeCol}) span`);
    const count = await typeBadges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(typeBadges.nth(i)).toHaveText("修理");
    }
  });

  test("有効/無効で検索できる（代表由来・ADR-0051）", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await page.getByLabel("有効/無効").selectOption("ACTIVE");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/activeStatus=ACTIVE/, { timeout: 10000 });
    // 代表が ACTIVE の見積のみ。全無効の N9905002 は除外される。
    const statusCol = await getColumnIndex(page, "有効/無効");
    const statusBadges = page.locator(`table tbody tr td:nth-child(${statusCol}) span`);
    const count = await statusBadges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toHaveText("有効");
    }
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto(`/estimates?estimateNumber=${FULL}`);
    await waitForListReady(page);

    await expect(page.getByLabel("見積番号")).toHaveValue(FULL);

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/estimates$/, { timeout: 10000 });
    await expect(page.getByLabel("見積番号")).toHaveValue("");
  });

  test("代表選択（ADR-0051）: 代表 ACTIVE は有効＋代表金額、全無効は無効", async ({ page }) => {
    // N9905001..004 を一括表示（R9905001 は接頭辞 R なので含まれない）。
    await page.goto("/estimates?estimateNumber=N990500");
    await waitForListReady(page);

    const statusCol = await getColumnIndex(page, "有効/無効");
    const amountCol = await getColumnIndex(page, "金額");

    // 代表 = V1（ACTIVE 最小番号）→ 有効バッジ ＋ V1 の永続合計。
    const fullRow = page.locator("table tbody tr", { hasText: FULL });
    await expect(fullRow.locator(`td:nth-child(${statusCol}) span`)).toHaveText("有効");
    await expect(fullRow.locator(`td:nth-child(${amountCol})`)).toHaveText(
      FULL_REPRESENTATIVE_TOTAL
    );

    // 全 INACTIVE → ACTIVE 不在でフォールバック、状態は正直に無効。
    const inactiveRow = page.locator("table tbody tr", { hasText: ALL_INACTIVE });
    await expect(inactiveRow.locator(`td:nth-child(${statusCol}) span`)).toHaveText("無効");
  });

  test("納品先列が表示される", async ({ page }) => {
    await page.goto(`/estimates?estimateNumber=${FULL}`);
    await waitForListReady(page);

    const deliveryCol = await getColumnIndex(page, "納品先");
    const fullRow = page.locator("table tbody tr", { hasText: FULL });
    await expect(fullRow.locator(`td:nth-child(${deliveryCol})`)).toHaveText(
      DELIVERY_LOCATION_NAME
    );
  });
});

test.describe("見積一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーにも「新規登録」ボタンが見える（Q5: isAdmin ゲート無し）", async ({ page }) => {
    await page.goto("/estimates");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "見積管理" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    // 商品一覧の「一般には見えない」を反転。見積は担当者の日常業務のため全員に表示。
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();
  });
});
