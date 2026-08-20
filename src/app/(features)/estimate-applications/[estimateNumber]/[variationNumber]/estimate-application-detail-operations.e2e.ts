import { expect, test } from "@playwright/test";

/**
 * 見積申請詳細画面の操作動線（承認・差戻・取下・#575）の E2E。
 *
 * 主役は employee2（EMP000002＝営業本部長＝ROLE002）。storageState を user.json に差し替えて
 * ログインする（既定 project は admin.json＝社長のため）。seed-estimate-applications.ts の操作動線
 * 専用フィクスチャ（N9905016〜19・いずれも PENDING）に対し、operations フラグ由来のボタン出し分けと
 * 各操作の成功結末（バッジ遷移・成功トースト・操作ブロック消滅）を配線検証する。
 *
 * - N9905016: 単段・承認待ち＝営業本部長 → employee2 が承認して「承認済」。
 * - N9905017: 2 段（営業本部長 → 社長）→ employee2 が step1 を承認して途中承認（申請中のまま）。
 * - N9905018: 単段・承認待ち＝営業本部長 → employee2 がコメント付きで差し戻して「差戻」。
 * - N9905019: 単段・申請者＝営業本部長・承認待ち＝社長 → employee2 が本人として取り下げて「取下」。
 * - N9905015: employee2 は申請者でも承認待ち役割メンバーでもない → 操作ボタンが一切出ない純粋閲覧。
 *
 * 競合・ガード拒否（楽観ロック・非メンバー）はフレーキー回避のため単体に委譲し、ここには載せない。
 * 各テストは互いに素なフィクスチャを 1 回だけ変更するため serial 化しない。
 */

// 主役 employee2 でログインする（営業本部長）。
test.use({ storageState: "playwright/.auth/user.json" });

const APPROVE = "N9905016";
const MID_APPROVE = "N9905017";
const REJECT = "N9905018";
const WITHDRAW = "N9905019";
const VIEW_ONLY = "N9905015";

test.describe("見積申請詳細 操作動線", () => {
  test("承認: 最終承認で「承認済」になり成功トースト＋操作ブロックが消える", async ({ page }) => {
    await page.goto(`/estimate-applications/${APPROVE}/1`);
    await expect(page.getByRole("heading", { name: "見積申請詳細" })).toBeVisible();

    await page.getByRole("button", { name: "承認", exact: true }).click();
    await page.getByRole("button", { name: "承認する" }).click();

    // 成功トースト（最終承認の言い切り）＋恒久的な結末（バッジ「承認済」・承認ボタン消滅）。
    await expect(page.getByText("この申請は承認済になりました")).toBeVisible();
    await expect(page.getByText("承認済").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "承認", exact: true })).toHaveCount(0);
  });

  test("途中承認: 申請中のまま自ステップが承認され「次の承認ステップに進みました」", async ({
    page,
  }) => {
    await page.goto(`/estimate-applications/${MID_APPROVE}/1`);
    await expect(page.getByRole("button", { name: "承認", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "承認", exact: true }).click();
    await page.getByRole("button", { name: "承認する" }).click();

    // 途中承認: 文言で結果を言い切り、バッジは「申請中」のまま・承認ボタンは消える（社長が承認待ち）。
    await expect(page.getByText("次の承認ステップに進みました")).toBeVisible();
    await expect(page.getByText("申請中").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "承認", exact: true })).toHaveCount(0);
  });

  test("差戻: コメントを入力して差し戻すと「差戻」になりコメントが読める", async ({ page }) => {
    await page.goto(`/estimate-applications/${REJECT}/1`);

    await page.getByRole("button", { name: "差戻", exact: true }).click();
    await page.getByLabel("差戻理由").fill("金額の内訳を再確認してください");
    await page.getByRole("button", { name: "差し戻す" }).click();

    await expect(page.getByText("差し戻しました")).toBeVisible();
    await expect(page.getByText("差戻").first()).toBeVisible();
    await expect(page.getByText("金額の内訳を再確認してください")).toBeVisible();
    await expect(page.getByRole("button", { name: "差戻", exact: true })).toHaveCount(0);
  });

  test("取下: 申請者本人が取り下げると「取下」になり成功トースト", async ({ page }) => {
    await page.goto(`/estimate-applications/${WITHDRAW}/1`);

    await page.getByRole("button", { name: "取下", exact: true }).click();
    await page.getByRole("button", { name: "取り下げる" }).click();

    await expect(page.getByText("取り下げました")).toBeVisible();
    await expect(page.getByText("取下").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "取下", exact: true })).toHaveCount(0);
  });

  test("負: 資格の無い閲覧者には操作ボタンが一切出ない（純粋閲覧）", async ({ page }) => {
    await page.goto(`/estimate-applications/${VIEW_ONLY}/1`);
    await expect(page.getByRole("heading", { name: "見積申請詳細" })).toBeVisible();

    // employee2 は申請者（佐藤 太郎）でも承認待ち役割（営業部長）メンバーでもない。
    await expect(page.getByRole("button", { name: "承認", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "差戻", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "取下", exact: true })).toHaveCount(0);
  });
});
