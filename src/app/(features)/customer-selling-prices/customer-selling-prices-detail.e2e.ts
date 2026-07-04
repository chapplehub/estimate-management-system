import { type Page, expect, test } from "@playwright/test";

/**
 * 得意先別販売単価 詳細（管理画面・閲覧系・#507/#509）の E2E。
 *
 * C902 × PRD866 は上書きに失効/現在有効/将来の3期間を持ち、共通販売単価を現在有効1本併設する
 * （today 相対シード・ADR-20260629-3x5）。状態バッジ（現在有効/将来/失効）と authorityFor による
 * ミューテーションボタンの出し分け（将来=編集/削除・現在有効=改定/適用終了・失効=操作なし）、および
 * 上書きなし（集約なし）が正常な既定状態である得意先別固有の分岐を検証する。並列・共通シード（DB 不変）。
 * 管理者 storageState（既定）のため操作列が描画される（権限非表示は CRUD/権限 E2E で検証）。
 *
 * 共通販売単価 詳細（`common-selling-prices/common-selling-prices-detail.e2e.ts`）の同型写像。宛先キーが
 * `(customerCd, productCd)` 複合になる点、現在有効行が「改定＋適用終了」の2操作を持つ点、上書きなしが
 * 404 ではなく正常表示になる点、タイムラインに共通フォールバックの従レーンが載る点が得意先別固有の差分。
 */

/** 詳細のハイドレーション完了を待つ。適用期間テーブルの先頭行が見えた時点で操作可能と判断。 */
async function waitForDetailReady(page: Page) {
  await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

test.describe("得意先別販売単価 詳細（閲覧・#507）", () => {
  test("得意先・商品情報と3状態バッジが表示される", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    // 得意先情報
    await expect(
      page.getByRole("heading", { name: "得意先別販売単価", exact: true })
    ).toBeVisible();
    await expect(page.getByText("C902")).toBeVisible();
    await expect(page.getByText("E2E専用_得意先別単価テスト商事")).toBeVisible();

    // 商品情報
    await expect(page.getByText("PRD866")).toBeVisible();
    await expect(page.getByText("得意先単価_詳細3状態テスト商品")).toBeVisible();

    // 3状態バッジ（失効/現在有効/将来）が揃う
    await expect(page.getByText("現在有効", { exact: true })).toBeVisible();
    await expect(page.getByText("将来", { exact: true })).toBeVisible();
    await expect(page.getByText("失効", { exact: true })).toBeVisible();

    // 将来行（無期限）の終了日が「無期限」表示
    await expect(page.getByText("無期限")).toBeVisible();
  });

  test("将来行は編集・削除のみ操作できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    const futureRow = page.locator("table tbody tr", { hasText: "将来" });
    await expect(futureRow.getByRole("button", { name: "編集" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "削除" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "改定" })).not.toBeVisible();
    await expect(futureRow.getByRole("button", { name: "適用終了" })).not.toBeVisible();
  });

  test("現在有効行は改定・適用終了のみ操作できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    const activeRow = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(activeRow.getByRole("button", { name: "改定" })).toBeVisible();
    await expect(activeRow.getByRole("button", { name: "適用終了" })).toBeVisible();
    await expect(activeRow.getByRole("button", { name: "編集" })).not.toBeVisible();
    await expect(activeRow.getByRole("button", { name: "削除" })).not.toBeVisible();
  });

  test("失効行は操作できない（— 表示）", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    const expiredRow = page.locator("table tbody tr", { hasText: "失効" });
    await expect(expiredRow.getByRole("button")).toHaveCount(0);
    await expect(expiredRow.getByText("—")).toBeVisible();
  });

  test("上書きなしは404にならず、共通適用の正常メッセージが表示される", async ({ page }) => {
    // PRD863 は C902 に上書きが無い（集約なし）。得意先別固有: これは異常ではなく既定状態で、
    // 404 ではなく「共通販売単価を適用します」の案内を出す（#506・封筒型 null は不在時のみ）。
    await page.goto("/customer-selling-prices/C902/PRD863");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();

    await expect(
      page.getByText("この得意先×商品の上書きはありません。価格決定は共通販売単価を適用します。")
    ).toBeVisible();
    // 上書き行が無いのでテーブル本体は描かれない。
    await expect(page.locator("table tbody tr")).toHaveCount(0);
  });

  test("無効商品は弾かれずバッジ付きで表示される", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD865");
    await waitForDetailReady(page);

    await expect(page.getByText("得意先単価_無効商品テスト商品")).toBeVisible();
    // 商品情報セクションの無効バッジ（得意先 C902 は有効なのでバッジは商品側の1つのみ）。
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("無効得意先は弾かれずバッジ付きで表示される", async ({ page }) => {
    // 無効得意先はセレクタ検索（有効のみ）に出ないため直接 URL で到達する。C004×PRD860 は上書きなし。
    await page.goto("/customer-selling-prices/C004/PRD860");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();

    await expect(page.getByText("名古屋精密機器株式会社")).toBeVisible();
    // 得意先情報セクションの無効バッジ（商品 PRD860 は有効なのでバッジは得意先側の1つのみ）。
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("戻りリンクから一覧へ遷移できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    await page.getByRole("link", { name: "← 得意先別販売単価一覧に戻る" }).click();

    await expect(page).toHaveURL(/\/customer-selling-prices$/, { timeout: 10000 });
    await expect(page.getByText("得意先を選択してください")).toBeVisible();
  });

  test("存在しない商品コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/customer-selling-prices/C902/PRD000NOTEXIST");

    expect(response?.status()).toBe(404);
  });

  test("存在しない得意先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/customer-selling-prices/C999/PRD860");

    expect(response?.status()).toBe(404);
  });
});

/**
 * 得意先別販売単価 タイムライン表示（2レーン・#507）の E2E。
 *
 * C902 × PRD866（上書き3期間＋共通1期間）で、既定はテーブル（帯なし）→ トグルでタイムライン帯を付加表示
 * → テーブルへ戻すと帯が消えることを検証する。主レーン（得意先別・3本）と従レーン（共通フォールバック・1本）
 * を data-testid で区別する。凡例（現在有効/失効/将来）はテーブルの状態バッジとテキストが衝突するため
 * testid でスコープし、従レーンの「共通（フォールバック・表示専用）」凡例も確認する。共通シード・DB 不変（並列可）。
 */
test.describe("得意先別販売単価 タイムライン表示（#507）", () => {
  test("既定はテーブル表示で、タイムライン帯は描かれない", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    await expect(page.getByTestId("price-timeline")).not.toBeVisible();
  });

  test("タイムラインへ切替えると主/従レーン帯・今日マーカー・凡例が表示される", async ({
    page,
  }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();

    const timeline = page.getByTestId("price-timeline");
    await expect(timeline).toBeVisible();

    // 主レーン（得意先別）3期間ぶんの帯と、従レーン（共通フォールバック）1期間ぶんの淡色帯。
    await expect(page.getByTestId("price-timeline-bar")).toHaveCount(3);
    await expect(page.getByTestId("price-timeline-secondary-bar")).toHaveCount(1);
    await expect(page.getByTestId("price-timeline-today")).toBeVisible();

    // 凡例（現在有効/失効/将来）は testid でスコープしてテーブルのバッジと区別する。
    const legend = page.getByTestId("price-timeline-legend");
    await expect(legend.getByText("現在有効", { exact: true })).toBeVisible();
    await expect(legend.getByText("失効", { exact: true })).toBeVisible();
    await expect(legend.getByText("将来", { exact: true })).toBeVisible();
    // 従レーン（共通）の凡例（得意先別固有・フォールバック層の表示専用ラベル）。
    await expect(legend.getByText("共通（フォールバック・表示専用）")).toBeVisible();
  });

  test("共通単価が未設定の商品では従レーンに未設定プレースホルダが出る", async ({ page }) => {
    // PRD861 は上書き有効・無期限を持つが共通販売単価が無い（従レーンが空になる得意先別固有ケース）。
    await page.goto("/customer-selling-prices/C902/PRD861");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();
    await expect(page.getByTestId("price-timeline")).toBeVisible();

    // 主レーンは上書き1本、従レーンは帯なしで「共通販売単価は未設定」プレースホルダ。
    await expect(page.getByTestId("price-timeline-bar")).toHaveCount(1);
    await expect(page.getByTestId("price-timeline-secondary-bar")).toHaveCount(0);
    await expect(page.getByText("共通販売単価は未設定")).toBeVisible();
  });

  test("テーブルへ戻すとタイムライン帯が消える", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902/PRD866");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();
    await expect(page.getByTestId("price-timeline")).toBeVisible();

    await page.getByRole("button", { name: "テーブル" }).click();
    await expect(page.getByTestId("price-timeline")).not.toBeVisible();

    // 操作テーブルは切替に関係なく常時表示（付加式）。
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });
});
