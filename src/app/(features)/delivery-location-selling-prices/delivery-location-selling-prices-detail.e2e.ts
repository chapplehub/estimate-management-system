import { type Page, expect, test } from "@playwright/test";

/**
 * 納品先別販売単価 詳細（管理画面・閲覧系・#547/#549）の E2E。
 *
 * D904 × PRD876 は納品先別上書きに失効/現在有効/将来の3期間を持ち、加えて得意先別（親 C903）1本・
 * 共通1本を併設する（today 相対シード・ADR-20260629-3x5）。状態バッジ（現在有効/将来/失効）と
 * authorityFor によるミューテーションボタンの出し分け（将来=編集/削除・現在有効=改定/適用終了・失効=操作なし）、
 * および上書きなし（集約なし）が正常な既定状態である納品先別固有の分岐を検証する。並列・共通シード（DB 不変）。
 * 管理者 storageState（既定）のため操作列が描画される（権限非表示は CRUD/権限 E2E で検証）。
 *
 * 得意先別販売単価 詳細（`customer-selling-prices/customer-selling-prices-detail.e2e.ts`）の同型写像。
 * 宛先キーが `(deliveryLocationCd, productCd)` になる点、親得意先情報が併記される点、上書きなしの文言が
 * 「得意先別販売単価を、無ければ共通販売単価を適用します」になる点、タイムラインが3段フォールバック
 * （納品先別 → 得意先別 → 共通）の3レーン構成になり従レーンが得意先別・共通の両層で帯を持つ点が
 * 納品先別固有の差分。
 */

/** 詳細のハイドレーション完了を待つ。適用期間テーブルの先頭行が見えた時点で操作可能と判断。 */
async function waitForDetailReady(page: Page) {
  await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

test.describe("納品先別販売単価 詳細（閲覧・#547）", () => {
  test("納品先・得意先・商品情報と3状態バッジが表示される", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    // 納品先情報
    await expect(
      page.getByRole("heading", { name: "納品先別販売単価", exact: true })
    ).toBeVisible();
    await expect(page.getByText("D904")).toBeVisible();
    await expect(page.getByText("E2E専用_納品先別単価CRUD納品先")).toBeVisible();

    // 親得意先情報（納品先別固有: 納品先は親得意先の文脈が無いと意味を成さない）
    await expect(page.getByText("C903")).toBeVisible();
    await expect(page.getByText("E2E専用_納品先別単価テスト商事")).toBeVisible();

    // 商品情報
    await expect(page.getByText("PRD876")).toBeVisible();
    await expect(page.getByText("納品先単価_詳細3状態テスト商品")).toBeVisible();

    // 3状態バッジ（失効/現在有効/将来）が揃う
    await expect(page.getByText("現在有効", { exact: true })).toBeVisible();
    await expect(page.getByText("将来", { exact: true })).toBeVisible();
    await expect(page.getByText("失効", { exact: true })).toBeVisible();

    // 将来行（無期限）の終了日が「無期限」表示
    await expect(page.getByText("無期限")).toBeVisible();
  });

  test("将来行は編集・削除のみ操作できる", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    const futureRow = page.locator("table tbody tr", { hasText: "将来" });
    await expect(futureRow.getByRole("button", { name: "編集" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "削除" })).toBeVisible();
    await expect(futureRow.getByRole("button", { name: "改定" })).not.toBeVisible();
    await expect(futureRow.getByRole("button", { name: "適用終了" })).not.toBeVisible();
  });

  test("現在有効行は改定・適用終了のみ操作できる", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    const activeRow = page.locator("table tbody tr", { hasText: "現在有効" });
    await expect(activeRow.getByRole("button", { name: "改定" })).toBeVisible();
    await expect(activeRow.getByRole("button", { name: "適用終了" })).toBeVisible();
    await expect(activeRow.getByRole("button", { name: "編集" })).not.toBeVisible();
    await expect(activeRow.getByRole("button", { name: "削除" })).not.toBeVisible();
  });

  test("失効行は操作できない（— 表示）", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    const expiredRow = page.locator("table tbody tr", { hasText: "失効" });
    await expect(expiredRow.getByRole("button")).toHaveCount(0);
    await expect(expiredRow.getByText("—")).toBeVisible();
  });

  test("上書きなしは404にならず、得意先別／共通適用の正常メッセージが表示される", async ({
    page,
  }) => {
    // D902×PRD873 は納品先別上書きが無い（集約なし・共通のみの読取専用帯）。納品先別固有: これは
    // 異常ではなく既定状態で、404 ではなく「得意先別販売単価を、無ければ共通販売単価を適用します」の
    // 案内を出す。変更系 D904×PRD87x は CRUD chain の残余行と衝突するため読取専用帯 D902 を使う。
    await page.goto("/delivery-location-selling-prices/D902/PRD873");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();

    await expect(
      page.getByText(
        "この納品先×商品の上書きはありません。価格決定は得意先別販売単価を、無ければ共通販売単価を適用します。"
      )
    ).toBeVisible();
    // 上書き行が無いのでテーブル本体は描かれない。
    await expect(page.locator("table tbody tr")).toHaveCount(0);
  });

  test("無効商品は弾かれずバッジ付きで表示される", async ({ page }) => {
    // D902×PRD875（無効商品＋上書き有効）へ直接到達。納品先 D902・親 C903 は有効なので
    // バッジは商品側の1つのみ。
    await page.goto("/delivery-location-selling-prices/D902/PRD875");
    await waitForDetailReady(page);

    await expect(page.getByText("納品先単価_無効商品テスト商品")).toBeVisible();
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("無効納品先は弾かれずバッジ付きで表示される", async ({ page }) => {
    // 無効納品先はセレクタ検索（有効のみ）に出ないため直接 URL で到達する。D903×PRD873 は上書きなし。
    // 商品 PRD873・親得意先 C903 は有効なのでバッジは納品先側の1つのみ。
    await page.goto("/delivery-location-selling-prices/D903/PRD873");
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();

    await expect(page.getByText("E2E専用_納品先別単価テスト無効納品先")).toBeVisible();
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("戻りリンクから選択納品先の一覧へ遷移できる", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    await page.getByRole("link", { name: "← 納品先別販売単価一覧に戻る" }).click();

    await expect(page).toHaveURL(/\/delivery-location-selling-prices\/D904$/, { timeout: 10000 });
  });

  test("存在しない商品コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/delivery-location-selling-prices/D904/PRD000NOTEXIST");

    expect(response?.status()).toBe(404);
  });

  test("存在しない納品先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/delivery-location-selling-prices/DL999/PRD876");

    expect(response?.status()).toBe(404);
  });
});

/**
 * 納品先別販売単価 タイムライン表示（3レーン・#547）の E2E。
 *
 * D904 × PRD876（納品先別3期間＋得意先別1＋共通1）で、既定はテーブル（帯なし）→ トグルでタイムライン帯を
 * 付加表示 → テーブルへ戻すと帯が消えることを検証する。主レーン（納品先別・3本）と従レーン
 * （得意先別・共通のフォールバック・計2本）を data-testid で区別する。凡例（現在有効/失効/将来）はテーブルの
 * 状態バッジとテキストが衝突するため testid でスコープし、従レーンの「得意先別・共通（フォールバック・表示専用）」
 * 凡例も確認する。得意先別 #509 の2レーン検証を3段フォールバックの3レーンへ拡張したもの。共通シード・DB 不変（並列可）。
 */
test.describe("納品先別販売単価 タイムライン表示（#547）", () => {
  test("既定はテーブル表示で、タイムライン帯は描かれない", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    await expect(page.getByTestId("price-timeline")).not.toBeVisible();
  });

  test("タイムラインへ切替えると主/従レーン帯・今日マーカー・凡例が表示される", async ({
    page,
  }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();

    const timeline = page.getByTestId("price-timeline");
    await expect(timeline).toBeVisible();

    // 主レーン（納品先別）3期間ぶんの帯と、従レーン（得意先別1＋共通1）計2本の淡色帯
    // ＝3段フォールバック全埋め（納品先別 → 得意先別 → 共通）。
    await expect(page.getByTestId("price-timeline-bar")).toHaveCount(3);
    await expect(page.getByTestId("price-timeline-secondary-bar")).toHaveCount(2);
    await expect(page.getByTestId("price-timeline-today")).toBeVisible();

    // 凡例（現在有効/失効/将来）は testid でスコープしてテーブルのバッジと区別する。
    const legend = page.getByTestId("price-timeline-legend");
    await expect(legend.getByText("現在有効", { exact: true })).toBeVisible();
    await expect(legend.getByText("失効", { exact: true })).toBeVisible();
    await expect(legend.getByText("将来", { exact: true })).toBeVisible();
    // 従レーン（得意先別・共通）の凡例（納品先別固有・フォールバック層の表示専用ラベル）。
    await expect(legend.getByText("得意先別・共通（フォールバック・表示専用）")).toBeVisible();
  });

  test("得意先別・共通が未設定の商品では従レーンに未設定プレースホルダが出る", async ({ page }) => {
    // D902×PRD871 は納品先別 上書き有効・無期限を持つが、親 C903 に得意先別上書きが無く共通単価も無い
    // （3段フォールバック従レーンが両方空になる納品先別固有ケース）。
    await page.goto("/delivery-location-selling-prices/D902/PRD871");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();
    await expect(page.getByTestId("price-timeline")).toBeVisible();

    // 主レーンは上書き1本、従レーンは帯なしで各層の未設定プレースホルダ。
    await expect(page.getByTestId("price-timeline-bar")).toHaveCount(1);
    await expect(page.getByTestId("price-timeline-secondary-bar")).toHaveCount(0);
    await expect(page.getByText("得意先別の上書きなし")).toBeVisible();
    await expect(page.getByText("共通販売単価は未設定")).toBeVisible();
  });

  test("テーブルへ戻すとタイムライン帯が消える", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/D904/PRD876");
    await waitForDetailReady(page);

    await page.getByRole("button", { name: "タイムライン" }).click();
    await expect(page.getByTestId("price-timeline")).toBeVisible();

    await page.getByRole("button", { name: "テーブル" }).click();
    await expect(page.getByTestId("price-timeline")).not.toBeVisible();

    // 操作テーブルは切替に関係なく常時表示（付加式）。
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });
});
