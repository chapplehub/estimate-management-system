import { type Page, expect, test } from "@playwright/test";

/**
 * 得意先別販売単価 CRUD/権限（UC-3/4/5/6＋ドメインエラー＋権限）の E2E。
 *
 * DB 変更系は専用得意先 C903 × 専用商品（PRD867=Chain A・PRD868=Chain B・PRD869=Chain C）に隔離し、
 * 関心ごとに serial chain へ分割する（ADR-0020 判断1）。隔離の自然な単位は商品ではなく得意先で、
 * 閲覧系 C902 帯とは物理的に分離する。入力日付は today（JST 暦日）相対で生成し、新規期間は不変条件上
 * 開始 ≥ 今日とする（ADR-20260629-3x5）。重複拒否は登録が拒否され DB を変えないため閲覧系 C902×PRD866
 * に相乗りで並列・不変として検証する。
 *
 * 共通販売単価 CRUD（`common-selling-prices/common-selling-prices-crud.e2e.ts`）の同型写像。宛先キーが
 * `(customerCd, productCd)` 複合になる点、入力ラベルが「得意先別販売単価」になる点、上書きなし（集約なし）が
 * 未設定ではなく「共通へフォールバックする正常状態」の文言になる点が得意先別固有の差分。
 *
 * 対象外（コメントのみ）:
 * - 楽観ロック競合（version 不一致）: UI からの誘発が困難（同一行の同時 2 操作が要る）。
 * - 状態別サーバ拒否（失効/現在有効行の編集削除など）: UI から不可達（ボタン自体が出ない）。
 *   認可・状態別不変条件の正本検証は BE/アクション層に委ねる（共通側と同判断）。
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

/** 上書きなし（集約なし）の既定文言。得意先別固有: 未設定ではなく共通フォールバックの正常状態。 */
const NO_OVERRIDE_MESSAGE =
  "この得意先×商品の上書きはありません。価格決定は共通販売単価を適用します。";

test.describe.serial("得意先別販売単価 Chain A（登録→編集→削除・C903×PRD867）", () => {
  test("UC-3: 将来期間を新規登録できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD867");
    await waitForAdminDetailReady(page);
    // 初期は上書きなし（CSP 集約なし＝共通へフォールバックする正常状態）。
    await expect(page.getByText(NO_OVERRIDE_MESSAGE)).toBeVisible();

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(30)); // 将来 [today+30, ∞)
    await page.getByLabel("得意先別販売単価（円）").fill("5000"); // 終了日は空＝無期限
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("¥5,000")).toBeVisible();
    await expect(row.getByText("無期限")).toBeVisible();
  });

  test("UC-4: 将来行の単価・適用開始日を編集できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD867");
    await waitForAdminDetailReady(page);

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await row.getByRole("button", { name: "編集" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の編集" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(45));
    await page.getByLabel("得意先別販売単価（円）").fill("6000");
    await page.locator("form").getByRole("button", { name: "更新" }).click();

    const updated = page.locator("table tbody tr", { hasText: "将来" });
    await expect(updated.getByText("¥6,000")).toBeVisible({ timeout: 10000 });
    await expect(updated.getByText(jstRelativeDate(45))).toBeVisible();
  });

  test("UC-5: 将来行を削除すると上書きなしに戻る", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD867");
    await waitForAdminDetailReady(page);

    const row = page.locator("table tbody tr", { hasText: "将来" });
    await row.getByRole("button", { name: "削除" }).click();
    // 行内2段階確認
    await expect(row.getByText("削除しますか？")).toBeVisible();
    await row.getByRole("button", { name: "削除する" }).click();

    // 0期間 → 上書きなしメッセージへ自己クリーン（未設定ではなく共通フォールバックの正常状態）。
    await expect(page.getByText(NO_OVERRIDE_MESSAGE)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table tbody tr")).toHaveCount(0);
  });

  test("#512 回帰: 最終行の削除後、詳細に留まったまま再登録できる（空集約シェルを残さない）", async ({
    page,
  }) => {
    // UC-5 で最後の1行を削除済み。B案（親ごと削除）以前はここに空集約シェル（親あり・0件）が
    // 残り、UI は0件を「上書きなし＝新規登録」と見なし version を送らないため再登録が ValidationError で
    // 詰まった（#512 同型）。親ごと消えていれば上書きなし商品と同じ insert 経路で再登録できる。
    await page.goto("/customer-selling-prices/C903/PRD867");
    await waitForAdminDetailReady(page);
    await expect(page.getByText(NO_OVERRIDE_MESSAGE)).toBeVisible();

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(60)); // 将来 [today+60, ∞)
    await page.getByLabel("得意先別販売単価（円）").fill("7000");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    // ValidationError（alert）で詰まらず、将来行が新規登録される。
    const row = page.locator("table tbody tr", { hasText: "将来" });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("¥7,000")).toBeVisible();
    await expect(row.getByText("無期限")).toBeVisible();
  });
});

test.describe.serial("得意先別販売単価 Chain B（登録→適用終了→改定・C903×PRD868）", () => {
  test("UC-3: 現在有効期間を新規登録できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD868");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(0)); // today → 現在有効 [today, ∞)
    await page.getByLabel("得意先別販売単価（円）").fill("4000");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const row = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(row.getByText("¥4,000")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("無期限")).toBeVisible();
  });

  test("UC-4: 現在有効行に適用終了日を設定できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD868");
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
    await page.goto("/customer-selling-prices/C903/PRD868");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(30)); // [today+30, ∞)（現在有効に隣接）
    await page.getByLabel("得意先別販売単価（円）").fill("4500");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const future = page.locator("table tbody tr", { hasText: "将来" });
    await expect(future.getByText("¥4,500")).toBeVisible({ timeout: 10000 });
    // 現在有効行（改定前）も残り、2期間が並ぶ
    await expect(page.locator("table tbody tr", { hasText: "現在有効" })).toBeVisible();
  });
});

test.describe.serial("得意先別販売単価 Chain C（ガイド付き単価改定・C903×PRD869）", () => {
  test("UC-3: 改定の起点となる現在有効期間を新規登録できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD869");
    await waitForAdminDetailReady(page);
    await expect(page.getByText(NO_OVERRIDE_MESSAGE)).toBeVisible();

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(0)); // today → 現在有効 [today, ∞)
    await page.getByLabel("得意先別販売単価（円）").fill("4000");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    const row = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(row.getByText("¥4,000")).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("無期限")).toBeVisible();
  });

  test("UC-6: 改定ボタンから現在有効単価を改定日で新単価へ切り替える", async ({ page }) => {
    await page.goto("/customer-selling-prices/C903/PRD869");
    await waitForAdminDetailReady(page);

    const active = page.locator("table tbody tr", { hasText: "現在有効" });
    await active.getByRole("button", { name: "改定" }).click();
    await expect(
      page.getByRole("heading", { name: "単価改定（改定日から新単価へ切替）" })
    ).toBeVisible();

    // 現単価が読み取り表示される（得意先別ラベル）。
    await expect(page.getByText("現在の得意先別販売単価")).toBeVisible();

    const revisionDate = jstRelativeDate(30);
    await page.getByLabel("改定日").fill(revisionDate);
    await page.getByLabel("改定後の得意先別販売単価（円）").fill("5000");
    // 値上げ方向ラベルが表示される（表示専用・据え置きも許容する設計）
    await expect(page.getByText("値上げ")).toBeVisible();

    await page.getByRole("button", { name: "改定する" }).click();

    // 旧行が改定日で終了（[today, today+30) のため依然「現在有効」だが終了日が入る）＋単価据え置き¥4,000
    const oldRow = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(oldRow.getByText(revisionDate)).toBeVisible({ timeout: 10000 });
    await expect(oldRow.getByText("¥4,000")).toBeVisible();

    // 改定日開始の新行（将来）が連続して追加され、新単価¥5,000・無期限。
    // 新行が存在すること自体が「旧行と重複せず連続した（接触境界）」＝重複エラー不発の証拠。
    const newRow = page.locator("table tbody tr", { hasText: "将来" });
    await expect(newRow.getByText("¥5,000")).toBeVisible();
    await expect(newRow.getByText(revisionDate)).toBeVisible();
    await expect(newRow.getByText("無期限")).toBeVisible();

    // 旧行（現在有効・改定日終了）＋新行（将来）の2期間が並ぶ
    await expect(page.locator("table tbody tr")).toHaveCount(2);
  });
});

test.describe("得意先別販売単価 ドメインエラー（重複拒否・C902×PRD866・DB不変）", () => {
  test("現在有効期間に重なる登録はフォームエラーで拒否される", async ({ page }) => {
    // 閲覧系 C902×PRD866 の現在有効上書き [today-30, today+30) に today 開始で重ねる。
    // 登録は拒否され DB を変えないため閲覧系シードに相乗りで並列・不変として検証する。
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForAdminDetailReady(page);

    await page.getByRole("button", { name: "新規追加" }).click();
    await expect(page.getByRole("heading", { name: "適用期間の登録" })).toBeVisible();

    await page.getByLabel("適用開始日").fill(jstRelativeDate(0));
    await page.getByLabel("得意先別販売単価（円）").fill("9999");
    await page.locator("form").getByRole("button", { name: "登録" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("得意先別販売単価（一般ユーザー・権限）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一覧・詳細は閲覧できる", async ({ page }) => {
    await page.goto("/customer-selling-prices");
    await expect(
      page.getByRole("heading", { name: "得意先別販売単価", exact: true })
    ).toBeVisible();

    await page.goto("/customer-selling-prices/C902/PRD866");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("ミューテーション系UIが一切表示されない", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    // 「操作」列ヘッダーごと描画されない。
    const headers = await page.locator("table thead th").allTextContents();
    expect(headers).not.toContain("操作");

    // 新規追加・各行操作ボタンが一切無い
    await expect(page.getByRole("button", { name: "新規追加" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "改定" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "適用終了" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
  });
});
