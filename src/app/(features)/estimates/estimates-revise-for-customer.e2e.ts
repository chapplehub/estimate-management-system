import { type Page, expect, test } from "@playwright/test";

/**
 * 得意先改訂（C7・§7.2）の E2E。納品先宛 ACTIVE バリの操作行「得意先改訂」から確認モーダルを開き、
 * 同一見積内に得意先宛の改訂先バリエーションを生成する。改訂先の内容はドメインが改訂元から全複写で
 * 決定するため利用者の入力面はなく、UI は「ボタン → 確認 → 純粋コマンド送信」に徹する。
 *
 * 検証範囲（ADR-0017/0020・UI 観測可能な範囲）:
 * - (1) 操作行の「得意先改訂」は納品先宛 ACTIVE バリにのみ出る（得意先宛では出ない）
 * - (2) ボタン → 確認モーダル → 実行で、同一見積内に得意先宛の改訂先バリが出現する＋専用フラッシュ
 * - (3) 初回改訂後、ヘッダー編集（C2）の見積日・税端数・得意先が disabled になる（ヘッダーロック）
 *
 * 「改訂系譜の記録」「改訂元の凍結（編集不可）」は Prisma 直接参照なしでは UI 観測できない
 * （VariationDTO は per-variation 凍結フラグを持たず、改訂元の「内容を編集」ボタンは残る＝凍結は
 * ドメイン assertEditable が強制する二重防御の内側）。ADR-0012 によりここでは検証せず、ドメイン/
 * アプリのユニットテスト済みとして扱い、E2E は UI 観測可能な結果（改訂先の出現・ヘッダーロック・
 * フラッシュ）のみを検証する。
 */
const SOURCE = "N9905006"; // 改訂前・hasRevision=false（V1=納品先宛 ACTIVE・V2=得意先宛 ACTIVE）

async function waitForDetailReady(page: Page, estimateNumber: string) {
  await expect(page.getByRole("heading", { level: 1, name: estimateNumber })).toBeVisible();
}

async function selectVariationTab(page: Page, variationNumber: number) {
  await page.getByRole("tab", { name: `バリエーション${variationNumber}` }).click();
}

test.describe.serial("得意先改訂（C7 / N9905006）", () => {
  test("「得意先改訂」は納品先宛 ACTIVE バリにのみ出る（得意先宛では出ない）", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    // V1（納品先宛・ACTIVE）= 改訂元適格 → ボタンが出る。
    await selectVariationTab(page, 1);
    await expect(page.getByRole("button", { name: "得意先改訂" })).toBeVisible();

    // V2（得意先宛・ACTIVE）= 適格外 → ボタンが出ない。
    await selectVariationTab(page, 2);
    await expect(page.getByRole("button", { name: "得意先改訂" })).toHaveCount(0);
  });

  test("ボタン → 確認モーダル → 実行で得意先宛の改訂先バリが出現する", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    // 改訂前は V1・V2 の 2 タブのみ（V3 はまだ無い）。
    await expect(page.getByRole("tab", { name: "バリエーション3" })).toHaveCount(0);

    // V1（改訂元）の操作行から確認モーダルを開く。
    await selectVariationTab(page, 1);
    await page.getByRole("button", { name: "得意先改訂" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // モーダル内の実行ボタンで改訂を確定する（入力面は無く確認のみ）。
    await page.getByRole("button", { name: "得意先改訂する" }).click();

    // 専用フラッシュ（ESTIMATE_REVISED）。
    await expect(page.getByText("得意先改訂しました。")).toBeVisible({ timeout: 10000 });
    // 同一見積内に改訂先 V3（得意先宛）が出現する。
    await expect(page.getByRole("tab", { name: "バリエーション3" })).toBeVisible();
    await selectVariationTab(page, 3);
    await expect(page.getByText("得意先向け", { exact: true })).toBeVisible();
  });

  test("初回改訂後、ヘッダー編集の見積日・税端数・得意先が disabled になる（ヘッダーロック）", async ({
    page,
  }) => {
    // 直前のテストで N9905006 は初回改訂済み（hasRevision=true）。
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    // 閲覧モードに「改訂あり」バッジが出る（ADR-0049）。
    await expect(page.getByText("改訂あり", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "編集", exact: true }).click();

    // ロック対象（§7.2）: 見積日・税端数区分・得意先選択は不可。
    await expect(page.getByLabel("見積日")).toBeDisabled();
    await expect(page.getByLabel("税端数区分")).toBeDisabled();
    await expect(page.getByRole("button", { name: "得意先を選択" })).toBeDisabled();
    // 締切日・部署は改訂後も編集可。
    await expect(page.getByLabel("締切日")).toBeEnabled();
    await expect(page.getByLabel("部署")).toBeEnabled();
  });
});
