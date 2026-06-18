import { expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S4（バリ内容編集 / C4）の E2E。seed-estimates / seed-e2e の決定的データに対し、
 * 編集可否ゲート・インライン編集の金額ライブプレビュー・明細追加（直下挿入）・削除・全体値引/メモ・
 * 周辺商品サジェストを検証する（ADR-0017/0020）。
 *
 * D&D 並べ替えは dnd-kit のポインタ操作が Playwright で不安定なため E2E に含めず、並べ替え
 * ロジックは reorderNodes のユニットテストで担保する（ヘッダー編集 E2E が税率不一致を除外するのと同方針）。
 */
const EDITABLE = "N9905003"; // 単一 ACTIVE バリ・1明細・セット群なし・非改訂（編集対象）
// 系譜あり改訂済み（seed が reviseForCustomer 実行済み）。V2=改訂先(TARGET・内容編集不可)。
const REVISED = "N9905004";

test.describe("バリ内容編集（編集可否ゲート）", () => {
  test("編集可能バリでは『内容を編集』が表示される", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await expect(page.getByRole("button", { name: "内容を編集" })).toBeVisible();
  });

  test("改訂先（系譜あり）では『内容を編集』が表示されない（revisionRole 駆動・#388）", async ({
    page,
  }) => {
    await page.goto(`/estimates/${REVISED}`);
    // 改訂先 V2（REVISION_TARGET）は行構成固定で内容編集不可。UI 抑止（最終強制はドメイン）。
    await page.getByRole("tab", { name: "バリエーション2" }).click();
    await expect(page.getByRole("button", { name: "内容を編集" })).toHaveCount(0);
  });
});

test.describe.serial("バリ内容編集（S4・C4 / N9905003）", () => {
  test("編集モードに入り、数量変更で金額ライブプレビューが即時更新される", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    // 編集テーブル（明細追加ボタン）が現れる。
    await expect(page.getByRole("button", { name: "明細追加" })).toBeVisible();

    // 編集対象明細（数量1・単価1000）→ 行金額 1,000円。
    const row = page.locator("tr", { hasText: "編集対象明細" });
    await expect(row).toContainText("1,000円");

    // 数量を 3 に変更 → 行金額 3,000円（クライアント簡易プレビュー・保存しない）。
    await page.getByLabel("数量（編集対象明細）").fill("3");
    await expect(row).toContainText("3,000円");
  });

  test("明細追加（商品選択→直下挿入）→保存→閲覧に反映される", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    await page.getByRole("button", { name: "明細追加" }).click();
    await page.locator("#modal-search-name").fill("標準デスク");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /標準デスク/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 商品スナップショットは非同期解決（getProductLineSnapshot）。行が現れる＝作業コピー反映済み。
    await expect(page.getByRole("button", { name: "明細を削除（標準デスク）" })).toBeVisible();
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    // 閲覧モードの明細テーブルに追加した商品名スナップショットが現れる。
    await expect(page.locator("table tbody tr", { hasText: "標準デスク" })).toBeVisible();
  });

  test("明細を削除→保存→閲覧から消える", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    // 前テストで追加した「標準デスク」を削除する（確認なし・§5）。
    await page.getByRole("button", { name: "明細を削除（標準デスク）" }).click();
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "標準デスク" })).toHaveCount(0);
  });

  test("全体値引・顧客メモを編集→保存→閲覧に反映される", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    await page.getByLabel("全体値引").fill("100");
    await page.getByLabel("顧客メモ", { exact: true }).fill("E2E顧客メモ");

    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    await expect(page.getByText("全体値引: -100円")).toBeVisible();
    await expect(page.getByText("E2E顧客メモ", { exact: true })).toBeVisible();
  });

  test("周辺商品サジェスト：本体追加で提案が出て周辺も追加→保存→両方表示", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);
    await page.getByRole("button", { name: "内容を編集" }).click();

    // 本体（周辺商品を持つ商品）を追加する。
    await page.getByRole("button", { name: "明細追加" }).click();
    await page.locator("#modal-search-name").fill("S4周辺テスト本体");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /S4周辺テスト本体/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 周辺商品サジェストダイアログが開き、周辺が既定でチェック済み。
    const dialog = page.getByRole("dialog", { name: "周辺商品の提案" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "周辺商品 S4周辺テスト周辺" })).toBeChecked();
    await dialog.getByRole("button", { name: /件を追加/ }).click();

    // 本体・周辺の両行が作業コピーに入るのを待ってから保存する。
    await expect(
      page.getByRole("button", { name: "明細を削除（S4周辺テスト本体）" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "明細を削除（S4周辺テスト周辺）" })
    ).toBeVisible();
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "S4周辺テスト本体" })).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "S4周辺テスト周辺" })).toBeVisible();
  });
});
