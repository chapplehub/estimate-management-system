import { type Page, expect, test } from "@playwright/test";

/**
 * 見積申請（S2・§6・#494）の E2E。操作行「申請」→ 確認モーダル（プレビュー）→ 実行のフローを、
 * 承認免除（EXEMPT）・承認必要（REQUIRED）の両経路と、INACTIVE バリの申請ボタン無効化＋ツールチップで
 * 検証する。
 *
 * 認証は user 固定ユーザー（EMP000002・営業本部長）で実行する。申請の operator はログインセッションの
 * employeeId で、その上位役割（営業本部長 → 社長）が承認チェーンの起点になる。既定の admin（社長）は
 * 上位役割を持たず REQUIRED が BLOCKED になるため、上位を持つ user に切り替える（§5.1）。
 *
 * 検証範囲（ADR-0012・UI 観測可能な範囲。申請/免除レコードの DB 直接参照はドメイン/アプリの
 * ユニットテスト済みとして扱い、ここでは画面の状態遷移で観測する）:
 * - (1) 税込10万円未満は EXEMPT。「承認不要」＋免除理由 label を出し、申請→承認不要バッジへ遷移する
 * - (2) 税込10万〜100万は REQUIRED。承認チェーンを出し、申請→申請中バッジへ遷移する
 * - (3) INACTIVE バリの申請ボタンは無効（canApply=false）でツールチップを持つ／ACTIVE バリは活性
 */

// user 固定ユーザー（営業本部長・上位=社長）で実行する。operator の起点役割が要るため admin では不可。
test.use({ storageState: "playwright/.auth/user.json" });

const EN = {
  exempt: "N9905008",
  required: "N9905009",
  inactive: "N9905010",
} as const;

async function waitForDetailReady(page: Page, estimateNumber: string) {
  await expect(page.getByRole("heading", { level: 1, name: estimateNumber })).toBeVisible();
}

async function selectVariationTab(page: Page, variationNumber: number) {
  await page.getByRole("tab", { name: `バリエーション${variationNumber}` }).click();
}

test("税込10万円未満は承認不要（EXEMPT）で、申請すると承認不要バッジへ遷移する", async ({
  page,
}) => {
  await page.goto(`/estimates/${EN.exempt}`);
  await waitForDetailReady(page, EN.exempt);

  // 操作行の「申請」トリガーから確認モーダルを開く。
  await page.getByRole("button", { name: "申請", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // 承認不要（BELOW_THRESHOLD）: 免除理由 label と「申請する」ボタンが出る。
  await expect(page.getByText("10万円未満")).toBeVisible();
  await page.getByRole("button", { name: "申請する" }).click();

  // 申請後、承認不要（EXEMPTED）バッジへ遷移し、再申請できない（canApply=false）。
  await expect(page.getByText("承認不要", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "申請", exact: true })).toBeDisabled();
});

test("税込10万〜100万は承認必要（REQUIRED）で、申請すると申請中バッジへ遷移する", async ({
  page,
}) => {
  await page.goto(`/estimates/${EN.required}`);
  await waitForDetailReady(page, EN.required);

  await page.getByRole("button", { name: "申請", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // 承認必要: 承認チェーンの見出しと「申請する」ボタンが出る（具体役職名はチェーン構成に依存するため
  // 構造だけを観測する）。
  await expect(page.getByText("承認チェーン")).toBeVisible();
  await page.getByRole("button", { name: "申請する" }).click();

  // 申請後、申請中（PENDING）バッジへ遷移し、再申請できない（canApply=false）。
  await expect(page.getByText("申請中", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "申請", exact: true })).toBeDisabled();
});

test("INACTIVE バリの申請ボタンは無効でツールチップを持ち、ACTIVE バリは活性", async ({ page }) => {
  await page.goto(`/estimates/${EN.inactive}`);
  await waitForDetailReady(page, EN.inactive);

  // V2（INACTIVE）: 申請ボタンは無効化され、無効理由のツールチップを持つ。
  await selectVariationTab(page, 2);
  const inactiveApply = page.getByRole("button", { name: "申請", exact: true });
  await expect(inactiveApply).toBeDisabled();
  await expect(inactiveApply).toHaveAttribute("title", "無効なバリエーションは申請できません");

  // V1（ACTIVE・未申請）: 申請ボタンは活性。
  await selectVariationTab(page, 1);
  await expect(page.getByRole("button", { name: "申請", exact: true })).toBeEnabled();
});
