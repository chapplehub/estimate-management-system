import { expect, test } from "@playwright/test";

/**
 * 成功系CRUD用: テスト内で作成・削除する従業員データ
 * seed-e2e.ts の E2E 専用名前空間 EMP999xxx に属する（EMP999001 は既存 E2E 専用従業員）
 */
const TEST_EMPLOYEE_CD = "EMP999901";
const TEST_EMAIL = "e2e-create-test@example.com";
// 担当役割の残存回帰で使う役割名（roleCd 昇順の先頭 ROLE001）。
// Step6 の警告テスト（ROLE004/EMP000004）と非干渉で、EMP999901 は本チェーン末尾で削除される。
const TEST_ROLE_NAME = "社長";

test.describe("従業員CRUD（管理者）", () => {
  // 作成→更新→削除の順で実行（同一テストデータを使い回すため serial で順序保証）
  test.describe.serial("作成・更新・削除テスト", () => {
    // 作成時に選んだ担当役割の value を後続の更新テストへ引き継ぐ（serial で同一 worker）。
    let assignedRoleValue = "";

    test("管理者が新規従業員を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/employees");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/employees/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規従業員登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("名前").fill("E2Eテスト従業員");
      await page.getByLabel("メールアドレス").fill(TEST_EMAIL);
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByLabel("所属部署").selectOption({ index: 1 }); // 最初の部署を選択
      await page.getByLabel("パスワード").fill("testpass123");
      // 権限はデフォルト「一般ユーザー」のまま

      // 担当役割を選択（残存回帰の起点）。選んだ value を後続テストへ引き継ぐ
      const roleSelect = page.getByLabel("担当役割");
      await roleSelect.selectOption({ label: TEST_ROLE_NAME });
      assignedRoleValue = await roleSelect.inputValue();
      expect(assignedRoleValue).not.toBe("");

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("従業員を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した従業員が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).toBeVisible();
    });

    test("管理者が従業員情報を更新できる", async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);

      // 編集モードで表示されること
      await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 従業員コードが読み取り専用であること
      await expect(page.locator("#employeeCd-display")).toBeDisabled();

      // 作成時に選んだ担当役割が preselect されている（残存回帰の前提）
      await expect(page.getByLabel("担当役割")).toHaveValue(assignedRoleValue);

      // 複数フィールドを変更して更新（担当役割セレクトには一切触れない）
      const nameField = page.getByLabel("名前");
      await nameField.clear();
      await nameField.fill("E2E更新テスト");

      const emailField = page.getByLabel("メールアドレス");
      await emailField.clear();
      await emailField.fill("e2e-updated@example.com");

      await page.getByLabel("所属部署").selectOption({ index: 2 }); // 別の部署に変更

      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("従業員情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト");
      await expect(emailField).toHaveValue("e2e-updated@example.com");

      // リリースハザード F1 の網: 担当役割を送っていない更新でも役割が消えず残存すること。
      // （#565 BE は「roleId 未指定＝解除」。フォームが roleId を往復し損ねると保存後に空になる）
      await expect(page.getByLabel("担当役割")).toHaveValue(assignedRoleValue);
    });

    test("管理者が従業員を削除できる", async ({ page }) => {
      // 作成・更新済みの従業員の詳細画面に遷移
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した従業員が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).not.toBeVisible();
    });
  });

  // 課員（担当役割なし）の上位役割の設定・更新・解除フロー（#567・ADR-20260707-k4e）
  test.describe.serial("課員の上位役割 設定・更新・解除テスト", () => {
    const KAIN_EMPLOYEE_CD = "EMP999902";
    const KAIN_EMAIL = "e2e-kain-superior@example.com";

    test("課員に上位役割（課長級）を設定して作成できる", async ({ page }) => {
      await page.goto("/employees/new");
      await expect(page.getByRole("heading", { name: "新規従業員登録" })).toBeVisible();

      await page.getByLabel("名前").fill("E2E課員上位役割");
      await page.getByLabel("メールアドレス").fill(KAIN_EMAIL);
      await page.getByLabel("従業員コード").fill(KAIN_EMPLOYEE_CD);
      await page.getByLabel("所属部署").selectOption({ index: 1 });
      await page.getByLabel("パスワード").fill("testpass123");

      // 担当役割は（担当役割なし）のまま＝課員。上位役割セレクトが表示される。
      const superiorSelect = page.getByLabel("上位役割");
      await expect(superiorSelect).toBeVisible();
      // 未設定なので申請不可の警告が出ている
      await expect(page.getByText(/上位役割を設定するまで/)).toBeVisible();

      // 課長級の上位役割を選ぶと警告は消える
      await superiorSelect.selectOption({ label: "営業課長" });
      await expect(page.getByText(/上位役割を設定するまで/)).not.toBeVisible();

      await page.getByRole("button", { name: "登録" }).click();
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("詳細画面で上位役割が preselect され、別の課長級へ更新できる", async ({ page }) => {
      await page.goto(`/employees/${KAIN_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 課員なので担当役割は（担当役割なし）、上位役割は営業課長が preselect
      await expect(page.getByLabel("担当役割")).toHaveValue("");
      await expect(page.getByLabel("上位役割").locator("option:checked")).toHaveText("営業課長");

      // 別の課長級（開発課長）へ変更して更新
      await page.getByLabel("上位役割").selectOption({ label: "開発課長" });
      await page.getByRole("button", { name: "更新" }).click();
      await expect(page.getByText("従業員情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 更新後も開発課長が残存している
      await expect(page.getByLabel("上位役割").locator("option:checked")).toHaveText("開発課長");
    });

    test("上位役割を解除すると申請不可の警告が出て解除保存できる", async ({ page }) => {
      await page.goto(`/employees/${KAIN_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 上位役割を（上位役割なし）へ → 申請不可の警告が反応的に表示される
      await page.getByLabel("上位役割").selectOption({ label: "（上位役割なし）" });
      await expect(page.getByText(/上位役割を設定するまで/)).toBeVisible();

      await page.getByRole("button", { name: "更新" }).click();
      await expect(page.getByText("従業員情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 解除が残存（空選択）
      await expect(page.getByLabel("上位役割")).toHaveValue("");
    });

    test("担当役割を割り当てると上位役割セレクトが消え自動導出の注記になる", async ({ page }) => {
      await page.goto(`/employees/${KAIN_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 課員なので上位役割セレクトあり
      await expect(page.getByLabel("上位役割")).toBeVisible();

      // 担当役割を割り当てると上位役割セレクトはアンマウントされ自動導出の注記に切替
      await page.getByLabel("担当役割").selectOption({ label: "営業課長" });
      await expect(page.getByLabel("上位役割")).toBeHidden();
      await expect(page.getByText(/担当役割から自動的に導出/)).toBeVisible();

      // 保存はしない（このテストは表示切替の検証のみ。後続の削除で片付ける）
    });

    test("作成した課員を削除できる", async ({ page }) => {
      await page.goto(`/employees/${KAIN_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  test("重複する従業員コードでエラーが表示される", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByLabel("名前").fill("重複テスト");
    await page.getByLabel("メールアドレス").fill("e2e-duplicate-test@example.com");
    await page.getByLabel("従業員コード").fill("EMP000001"); // 既存の従業員コード
    await page.getByLabel("所属部署").selectOption({ index: 1 });
    await page.getByLabel("パスワード").fill("testpass123");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/employees\/new/);
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/employees$/, { timeout: 10000 });
  });

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test("役割の唯一メンバーが担当役割を変更すると承認者不在ワーニングが表示される", async ({
    page,
  }) => {
    // EMP000004 は ROLE004「開発部長」の唯一メンバー（seed-e2e）。DB は変更せず表示のみ検証する。
    await page.goto("/employees/EMP000004");
    await expect(page.getByText("従業員変更")).toBeVisible();

    const roleSelect = page.getByLabel("担当役割");
    // 現在の担当役割「開発部長」が preselect され、初期状態では警告は出ていない
    await expect(roleSelect.locator("option:checked")).toHaveText("開発部長");
    await expect(page.getByRole("status")).not.toBeVisible();

    // 担当役割を解除（（担当役割なし））すると旧役割名入りの警告が反応的に表示される。
    // 解除で課員になると上位役割未設定の警告も同時に出るため、承認者不在警告はテキストで特定する。
    await roleSelect.selectOption({ label: "（担当役割なし）" });
    const warning = page.getByText(/唯一の担当者/);
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("開発部長");

    // 元の担当役割へ戻すと承認者不在警告は消える（非ブロッキング・反応的）
    await roleSelect.selectOption({ label: "開発部長" });
    await expect(page.getByText(/唯一の担当者/)).not.toBeVisible();

    // 保存はしない（DB 不変フィクスチャを維持）
  });

  test("存在しない従業員コードで404が表示される", async ({ page }) => {
    await page.goto("/employees/EMP999999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

// SKILL §11: /employees/new は admin 専用（src/proxy.ts の adminRoutes）のため
// 権限差異あり機能に該当し、一般ユーザー簡易 chain（作成→削除）は省略する。
// 本ブロックは権限エラーテスト（必須）と owner 編集 / 他人閲覧の挙動検証に絞る。
test.describe("従業員（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/employees/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });

  test("本人は自分の情報を編集できる（owner権限）", async ({ page }) => {
    // employee2 (EMP000002) は user 認証のアカウント
    await page.goto("/employees/EMP000002");

    await expect(page.getByText("従業員変更")).toBeVisible();
    // フィールドが有効（disabled でない）
    await expect(page.getByLabel("名前")).toBeEnabled();
    await expect(page.getByLabel("メールアドレス")).toBeEnabled();
    // 更新ボタンが表示される
    await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
  });

  test("一般ユーザーは他人の情報を閲覧のみ", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    // 閲覧モードで表示されること
    await expect(page.getByText("従業員詳細")).toBeVisible();
    // フィールドが無効（disabled）
    await expect(page.getByLabel("名前")).toBeDisabled();
    await expect(page.getByLabel("メールアドレス")).toBeDisabled();
    // 更新ボタンが表示されない
    await expect(page.getByRole("button", { name: "更新" })).not.toBeVisible();
    // 削除ボタンが表示されない
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });
});
