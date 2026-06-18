import { type Page, expect, test } from "@playwright/test";

/**
 * 見積複製（C6・ADR-0057）の E2E。複製元詳細画面のヘッダー「見積複製」モーダルから、バリ選択（≥1）・
 * 新ヘッダ（見積日/締切日/部署）を収集し DuplicateEstimate を駆動、新採番の別見積へ遷移する。
 *
 * 検証範囲（ADR-0017/0020・UI 観測可能な範囲）:
 * - (1) バリ選択→複製→新採番見積へ遷移＋単価クリア注記フラッシュ／複製元は不変
 * - (2) 0 件選択は確定不可（≥1 必須・ADR-0042）
 * - (3) 改訂明細を含むバリはチェック不可（状態不問・isVariationDuplicatable）
 * - (4) §8.7 税率不一致（8%/10% 境界）でモーダル内フォーム警告・複製されない
 *
 * 「系譜記録」「単価が 0 にクリアされた DB 状態」は Prisma 直接参照なしでは観測できず ADR-0012 に
 * 反するため E2E では検証しない（ドメイン/アプリのユニットテスト済み）。ここでは新タブ出現・複製元
 * 不変・単価クリア注記フラッシュなど UI 観測可能な結果のみを検証する。
 */
const SOURCE = "N9905003"; // 単一 ACTIVE・非改訂バリ（複製可）
const MIXED = "N9905001"; // V1=改訂明細(複製不可)・V2/V3=複製可

async function waitForDetailReady(page: Page, estimateNumber: string) {
  await expect(page.getByRole("heading", { level: 1, name: estimateNumber })).toBeVisible();
}

async function openDuplicateModal(page: Page) {
  await page.getByRole("button", { name: "見積複製" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe.serial("見積複製（成功系・S6/C6 / N9905003）", () => {
  test("バリを選んで複製→新採番見積へ遷移し単価クリア注記が出る／複製元は不変", async ({
    page,
  }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    await openDuplicateModal(page);
    // 単一 ACTIVE バリ（第1案・得意先向け・有効）を選択。日付・部署は既定（今日・複製元部署）で送る。
    await page.getByRole("checkbox", { name: /第1案/ }).check();
    await page.getByRole("button", { name: "複製", exact: true }).click();

    // 単価クリアを促すフラッシュ（ESTIMATE_DUPLICATED）。
    await expect(page.getByText(/見積を複製しました/)).toBeVisible({ timeout: 10000 });
    // 新採番の別見積詳細へ遷移（複製元番号とは異なる）。
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(SOURCE);
    // 複製元の明細名が複写されている（内容は複写・単価のみクリア）。
    await expect(page.getByText("編集対象明細")).toBeVisible();

    // 複製元は不変（単一バリ・元の明細が残る）。
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);
    await expect(page.locator("table tbody tr", { hasText: "編集対象明細" })).toBeVisible();
  });
});

test.describe("見積複製（バリデーション・適格性・税率）", () => {
  test("バリを1件も選ばず複製すると ≥1 必須エラーが出て遷移しない（ADR-0042）", async ({
    page,
  }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    await openDuplicateModal(page);
    await page.getByRole("button", { name: "複製", exact: true }).click();

    await expect(page.getByText("複製するバリエーションを1つ以上選択してください")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/estimates/${SOURCE}`));
  });

  test("改訂明細を含むバリはチェック不可（状態不問・複製元にできない）", async ({ page }) => {
    await page.goto(`/estimates/${MIXED}`);
    await waitForDetailReady(page, MIXED);

    await openDuplicateModal(page);
    // 第1案は改訂価格明細を含むためチェック不可。第2案（複製可）は選択可能。
    await expect(page.getByRole("checkbox", { name: /第1案/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /第2案/ })).toBeEnabled();
  });

  test("見積日と締切日で税率が異なると §8.7 警告が出て複製されない", async ({ page }) => {
    await page.goto(`/estimates/${SOURCE}`);
    await waitForDetailReady(page, SOURCE);

    await openDuplicateModal(page);
    await page.getByRole("checkbox", { name: /第1案/ }).check();
    // 8%(〜2019-09-30) と 10%(2019-10-01〜) の境界をまたぐ。
    await page.getByLabel("見積日").fill("2019-09-30");
    await page.getByLabel("締切日").fill("2019-10-01");
    await page.getByRole("button", { name: "複製", exact: true }).click();

    await expect(page.getByText(/税率が異なります/)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(`/estimates/${SOURCE}`));
  });
});
