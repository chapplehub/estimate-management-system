import { expect, test } from "@playwright/test";

/**
 * 見積詳細画面 S3（ヘッダー編集 / C2）の E2E。seed-estimates.ts の決定的データに対し、
 * 基本情報の編集（締切日・部署・税端数）／修理情報の編集／得意先変更での納品先リセット／
 * 改訂済みのロック表示を検証する（ADR-0017/0020）。税率不一致はユニットで担保し E2E には含めない。
 */
const EDITABLE = "N9905003"; // シンプルな NEW（編集対象）
const REPAIR = "R9905001"; // 事前修理（修理情報の編集対象）
const REVISED = "N9905004"; // 得意先改訂済み（hasRevision＝ロック表示）

test.describe("見積ヘッダー編集（基本情報）", () => {
  test("締切日・部署・税端数を編集して保存でき、閲覧モードに反映される", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);

    await page.getByRole("button", { name: "編集", exact: true }).click();

    // 部署（select・改訂後も変更可）と税端数区分（select）を変更する。
    await page.getByLabel("部署").selectOption({ label: "開発部" });
    await page.getByLabel("税端数区分").selectOption("ROUND_UP");
    // 締切日（改訂後も変更可）を変更する。
    await page.getByLabel("締切日").fill("2026-05-31");

    await page.getByRole("button", { name: "保存" }).click();

    // 保存成功 → リダイレクトでトースト＋閲覧モードへ。
    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    await expect(page.getByRole("button", { name: "編集", exact: true })).toBeVisible();
    // 閲覧モードに税端数区分（切上）と部署（開発部）が反映される。
    await expect(page.getByText("切上", { exact: true })).toBeVisible();
    await expect(page.getByText("開発部", { exact: true })).toBeVisible();
  });
});

test.describe("見積ヘッダー編集（修理情報）", () => {
  test("修理情報の故障内容を編集して保存でき、閲覧モードに反映される", async ({ page }) => {
    await page.goto(`/estimates/${REPAIR}`);

    await page.getByRole("button", { name: "編集", exact: true }).click();

    await expect(page.getByText("修理情報", { exact: true })).toBeVisible();
    await page.getByLabel("故障内容").fill("基板交換が必要");

    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("見積を更新しました。")).toBeVisible();
    await expect(page.getByText("基板交換が必要", { exact: true })).toBeVisible();
  });
});

test.describe("見積ヘッダー編集（得意先変更で納品先リセット）", () => {
  test("得意先を変更すると納品先が未選択にリセットされる", async ({ page }) => {
    await page.goto(`/estimates/${EDITABLE}`);

    await page.getByRole("button", { name: "編集", exact: true }).click();

    // 得意先選択モーダルを開き、現在と異なる得意先（東京電子）を選ぶ。
    await page.getByRole("button", { name: "得意先を選択" }).click();
    await page.getByLabel("名称").fill("東京電子");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /東京電子/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 得意先をまたぐと納品先は不整合になるためクリアされる（再選択が必要）。
    await expect(page.getByText("未選択", { exact: true })).toBeVisible();
  });
});

test.describe("見積ヘッダー編集（改訂ロック表示）", () => {
  test("改訂済みでは見積日・税端数が disabled、締切日・部署は編集可", async ({ page }) => {
    await page.goto(`/estimates/${REVISED}`);

    // 改訂ありバッジ（閲覧モード）。
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
