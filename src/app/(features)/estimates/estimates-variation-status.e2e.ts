import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S7（バリエーション無効化/有効化・C5）の E2E。seed-estimates の専用見積
 * N9905007（V1・V2 とも ACTIVE）に対し、無効化→○無効・タブ取消線、全無効→警告、再有効化→
 * ●有効・警告消滅を 1 本の serial chain で往復検証する（ADR-0020・状態変更は独立 chain）。
 *
 * 進行ロック（申請以降は無効化不可・ADR-0061）は現状 no-op の拡張点に閉じており、申請テーブル
 * 実装後に別途 E2E を足す。本テストは状態トグルそのものの往復のみを対象とする。
 */
const TOGGLE = "N9905007"; // V1・V2 とも ACTIVE。トグルで状態を往復させる専用データ。

/** ハイドレーション完了の揺らぎに備え、タブクリックが効くまでリトライする（detail E2E と同方針）。 */
async function selectTab(page: Page, tabName: string, expected: Locator): Promise<void> {
  await expect(async () => {
    await page.getByRole("tab", { name: tabName }).click();
    await expect(expected).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test.describe.serial("バリエーション無効化/有効化（S7・C5 / N9905007）", () => {
  test("有効バリを無効化すると ○無効・タブ取消線になる", async ({ page }) => {
    await page.goto(`/estimates/${TOGGLE}`);

    // 既定タブ＝最小番号 ACTIVE＝V1。状態インジケータは ● 有効。
    await expect(page.getByText("● 有効", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "無効化" }).click();
    await expect(page.getByText("バリエーションを無効化しました。")).toBeVisible();

    // 無効化後は既定タブが残る ACTIVE（V2）へ移る。V1 タブは取消線でグレーアウト。
    await expect(page.getByRole("tab", { name: "バリエーション1" })).toHaveClass(/line-through/);

    // V1 を選び直すと状態インジケータが ○ 無効。
    await selectTab(page, "バリエーション1", page.getByText("○ 無効", { exact: true }));
    await expect(page.getByText("○ 無効", { exact: true })).toBeVisible();
  });

  test("全バリ無効化で全無効警告が表示される", async ({ page }) => {
    await page.goto(`/estimates/${TOGGLE}`);

    // この時点で V1 は無効・V2 が ACTIVE。既定タブ＝V2 で無効化すると全バリ無効になる。
    await expect(page.getByText("● 有効", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "無効化" }).click();
    await expect(page.getByText("バリエーションを無効化しました。")).toBeVisible();

    await expect(page.getByText("すべてのバリエーションが無効です。")).toBeVisible();
  });

  test("再有効化で ●有効に戻り全無効警告が消える", async ({ page }) => {
    await page.goto(`/estimates/${TOGGLE}`);

    // 全バリ無効。既定タブ＝V1（ACTIVE 不在なら先頭）。V1 を有効化する。
    await page.getByRole("button", { name: "有効化" }).click();
    await expect(page.getByText("バリエーションを有効化しました。")).toBeVisible();

    // V2 も有効化して seed 状態（両 ACTIVE）へ戻す。
    await selectTab(page, "バリエーション2", page.getByRole("button", { name: "有効化" }));
    await page.getByRole("button", { name: "有効化" }).click();
    await expect(page.getByText("バリエーションを有効化しました。")).toBeVisible();

    // 全無効警告は消え、V2 は ● 有効。
    await expect(page.getByText("すべてのバリエーションが無効です。")).toHaveCount(0);
    await expect(page.getByText("● 有効", { exact: true })).toBeVisible();
  });
});
