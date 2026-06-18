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
 * - (4) 改訂元（凍結）は「内容を編集」が消え「メモを編集」だけ出る。メモのみ編集→保存できる（#388）
 *
 * #388 以前は「改訂元の凍結」は UI 観測できなかった（VariationDTO に per-variation の凍結情報が
 * 無く、改訂元にも誤って「内容を編集」が出ていた＝#359 deviations ⑤）。#388 で VariationDTO に
 * revisionRole を表面化し、改訂元は「メモを編集」のみを出すようにしたため、本ファイルでも (4) として
 * 凍結を UI 観測する。「改訂系譜の DB 記録」は引き続き Prisma 直接参照が要るため ADR-0012 により
 * E2E では検証せず、ドメイン/アプリのユニットテスト済みとして扱う。
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

  test("改訂元（凍結）は『内容を編集』が消え『メモを編集』だけ出る（#388）", async ({ page }) => {
    // 直前までで N9905006 は改訂済み。V1 は改訂元（凍結）。
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    await selectVariationTab(page, 1);
    // 凍結ゆえ全体編集（内容を編集）は不可・メモのみ編集できる。
    await expect(page.getByRole("button", { name: "内容を編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "メモを編集" })).toBeVisible();
  });

  test("改訂元のメモのみ編集フォームは明細・価格 read-only で、メモを編集して保存できる（#388）", async ({
    page,
  }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    await selectVariationTab(page, 1);
    await page.getByRole("button", { name: "メモを編集" }).click();

    // 明細・価格は read-only（数量等の編集入力が存在しない）。明細メモ入力だけが出る。
    await expect(page.getByLabel(/数量/)).toHaveCount(0);
    await expect(page.getByPlaceholder("顧客メモ").first()).toBeVisible();

    // バリ単位メモ（exact ラベル）と明細メモを編集して保存 → 成功フラッシュ。
    const stamp = `rev-memo-${Date.now()}`;
    await page.getByLabel("顧客メモ", { exact: true }).fill(stamp);
    await page.getByPlaceholder("顧客メモ").first().fill(`item-${stamp}`);
    await page.getByRole("button", { name: "メモを保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible({ timeout: 10000 });

    // 保存後の閲覧（既定タブ＝V1）にバリ顧客メモが反映される。
    await selectVariationTab(page, 1);
    await expect(page.getByText(stamp, { exact: true })).toBeVisible();
  });
});
