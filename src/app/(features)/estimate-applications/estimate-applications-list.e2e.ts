import { type Page, expect, test } from "@playwright/test";

/**
 * 見積申請一覧画面（/estimate-applications・#572）の E2E。seed-estimate-applications.ts の
 * 代表フィクスチャ（N9905011 PENDING / N9905012 APPROVED / N9905013 EXEMPTED /
 * N9905014 WITHDRAWN+INACTIVE）に対し、一覧表示・状態バッジ・行リンク・検索各種を検証する。
 *
 * 5値状態の導出網羅は単体（SearchEstimateApplicationsQuery.test.ts）に委ね、ここは画面配線の
 * 担保に集中する（ADR-0012）。他テストの UI 駆動申請が同一 DB に混じり得るため、件数は断定せず
 * 既知の見積番号でスコープした行の存在・値のみを断定する。read-only のため非 serial。
 */
const PENDING = "N9905011";
const APPROVED = "N9905012";
const EXEMPTED = "N9905013";
const WITHDRAWN_INACTIVE = "N9905014";

/**
 * 一覧のハイドレーション完了を待つ。SearchForm（"use client"）の onSubmit が機能するには
 * React のハイドレーションが必要。非空ビューの行表示で interactive と判断する（空ビューを
 * 起点にすると待てないため、各テストは非空の起点から入りフォームで絞り込む）。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "見積申請一覧" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する。 */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

/** 見積番号でスコープした行 locator。 */
function rowOf(page: Page, estimateNumber: string) {
  return page.locator("table tbody tr", { hasText: estimateNumber });
}

/** 実行時の今日（JST 暦日）に dayOffset 日を加えた "YYYY-MM-DD"（date 入力の値形式）。 */
function jstRelativeDate(dayOffset: number): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const base = Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate());
  const shifted = new Date(base + dayOffset * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("見積申請一覧", () => {
  test("一覧が 10 列で表示され、代表行の状態バッジ・承認待ち役割・申請者が読める", async ({
    page,
  }) => {
    await page.goto(`/estimate-applications?estimateNumber=N990501`);
    await waitForListReady(page);

    // 10 列のヘッダーが揃う。
    for (const header of [
      "見積番号",
      "バリ番号",
      "得意先",
      "納品先",
      "提出区分",
      "金額",
      "申請状態",
      "承認待ち役割",
      "申請者",
      "申請日時",
    ]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }

    const stateCol = await getColumnIndex(page, "申請状態");
    const awaitingCol = await getColumnIndex(page, "承認待ち役割");
    const applicantCol = await getColumnIndex(page, "申請者");

    // PENDING（申請中）: 承認待ち役割=営業課長・申請者=佐藤 太郎。
    const pendingRow = rowOf(page, PENDING);
    await expect(pendingRow.locator(`td:nth-child(${stateCol})`)).toHaveText("申請中");
    await expect(pendingRow.locator(`td:nth-child(${awaitingCol})`)).toHaveText("営業課長");
    await expect(pendingRow.locator(`td:nth-child(${applicantCol})`)).toHaveText("佐藤 太郎");

    // APPROVED（承認済）: 承認待ち役割は空・申請者=鈴木 次郎。
    const approvedRow = rowOf(page, APPROVED);
    await expect(approvedRow.locator(`td:nth-child(${stateCol})`)).toHaveText("承認済");
    await expect(approvedRow.locator(`td:nth-child(${awaitingCol})`)).toHaveText("");
    await expect(approvedRow.locator(`td:nth-child(${applicantCol})`)).toHaveText("鈴木 次郎");

    // EXEMPTED（承認不要）: 申請者列は免除者=高橋 三郎。
    const exemptedRow = rowOf(page, EXEMPTED);
    await expect(exemptedRow.locator(`td:nth-child(${stateCol})`)).toHaveText("承認不要");
    await expect(exemptedRow.locator(`td:nth-child(${applicantCol})`)).toHaveText("高橋 三郎");

    // 既定は ACTIVE のみ＝INACTIVE の WITHDRAWN 行は現れない。
    await expect(rowOf(page, WITHDRAWN_INACTIVE)).toHaveCount(0);
  });

  test("見積番号セルは詳細ネストルートへリンクする（#574・デッドリンクでも href を配線）", async ({
    page,
  }) => {
    await page.goto(`/estimate-applications?estimateNumber=${PENDING}`);
    await waitForListReady(page);

    await expect(page.getByRole("link", { name: PENDING })).toHaveAttribute(
      "href",
      `/estimate-applications/${PENDING}/1`
    );
  });

  test("見積番号で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/estimate-applications");
    await waitForListReady(page);

    await page.getByLabel("見積番号").fill(APPROVED);
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/estimateNumber=N9905012/, { timeout: 10000 });
    await expect(rowOf(page, APPROVED)).toHaveCount(1);
    await expect(rowOf(page, PENDING)).toHaveCount(0);
  });

  test("申請者名で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/estimate-applications");
    await waitForListReady(page);

    await page.getByLabel("申請者名").fill("鈴木");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/applicantName=/, { timeout: 10000 });
    await expect(rowOf(page, APPROVED)).toHaveCount(1);
    await expect(rowOf(page, PENDING)).toHaveCount(0);
  });

  test("申請状態チェックボックスで絞り込める", async ({ page }) => {
    await page.goto("/estimate-applications?estimateNumber=N990501");
    await waitForListReady(page);

    await page.getByRole("checkbox", { name: "承認済" }).check();
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/state=APPROVED/, { timeout: 10000 });
    await expect(rowOf(page, APPROVED)).toHaveCount(1);
    await expect(rowOf(page, PENDING)).toHaveCount(0);
    await expect(rowOf(page, EXEMPTED)).toHaveCount(0);
  });

  test("承認待ち役割で絞り込める（PENDING のみ承認待ち役割を持つ）", async ({ page }) => {
    await page.goto("/estimate-applications?estimateNumber=N990501");
    await waitForListReady(page);

    await page.getByLabel("承認待ち役割").selectOption({ label: "営業課長" });
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/awaitingRoleId=/, { timeout: 10000 });
    await expect(rowOf(page, PENDING)).toHaveCount(1);
    await expect(rowOf(page, APPROVED)).toHaveCount(0);
  });

  test("申請日レンジ（From）で絞り込める", async ({ page }) => {
    await page.goto("/estimate-applications");
    await waitForListReady(page);

    // PENDING の申請日時は昨日。翌日以降を下限にすると圏外になる。
    await page.getByLabel("見積番号").fill(PENDING);
    await page.getByLabel("申請日From").fill(jstRelativeDate(1));
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/appliedFrom=/, { timeout: 10000 });
    await expect(rowOf(page, PENDING)).toHaveCount(0);
  });

  test("「無効も含む」トグルで INACTIVE の取下行が現れる", async ({ page }) => {
    await page.goto("/estimate-applications");
    await waitForListReady(page);

    // 既定（ACTIVE のみ）では INACTIVE の N9905014 は出ない。
    await page.getByLabel("見積番号").fill(WITHDRAWN_INACTIVE);
    await page.getByRole("button", { name: "検索" }).click();
    await expect(page).toHaveURL(/estimateNumber=N9905014/, { timeout: 10000 });
    await expect(rowOf(page, WITHDRAWN_INACTIVE)).toHaveCount(0);

    // 「無効も含む」を有効化すると取下（WITHDRAWN）行が現れる。
    await page.getByRole("checkbox", { name: "無効も含む" }).check();
    await page.getByRole("button", { name: "検索" }).click();
    await expect(page).toHaveURL(/includeInactive=true/, { timeout: 10000 });

    const stateCol = await getColumnIndex(page, "申請状態");
    const withdrawnRow = rowOf(page, WITHDRAWN_INACTIVE);
    await expect(withdrawnRow).toHaveCount(1);
    await expect(withdrawnRow.locator(`td:nth-child(${stateCol})`)).toHaveText("取下");
  });
});
