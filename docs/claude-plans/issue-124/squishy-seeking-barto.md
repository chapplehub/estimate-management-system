# Issue #124: employees管理画面のE2Eテスト作成

## Context

employees管理画面（一覧・新規作成・詳細編集・削除）のE2Eテストを作成する。
既存のコンポーネントテスト（EmployeeCreateForm.test.tsx, EmployeeUpdateForm.test.tsx）はVitest + RTLで
Server Actionをモックした単体テストのみ。画面遷移・サーバーアクション連携・権限制御を含むE2Eテストは未整備。

---

## テスト境界の設計方針: コンポーネント統合テスト vs E2E テスト

### 現状の既存テスト（コンポーネント単体テスト）がカバーしていること

- フォームの描画（フィールド・ラベル・ヒント表示）
- ユーザー入力操作（値の入力・セレクト変更）
- フォーム送信時のFormData組み立て（モックされたServer Actionの呼び出し確認）
- バリデーションエラーの表示（フィールドレベル・グローバル）
- canUpdate=true/falseによるUI出し分け

### 既存テストがカバーしていないこと（=E2Eで担保すべきこと）

| カテゴリ | 具体例 |
|---------|--------|
| **実際のサーバーアクション** | Server Actionが本当にDB保存・バリデーション・リダイレクトするか |
| **ページ間遷移** | 作成→一覧リダイレクト、一覧→詳細遷移、キャンセル→一覧戻り |
| **権限制御** | admin/user/ownerによるアクセス制御・UI出し分けが実際に機能するか |
| **検索機能** | URL駆動の検索がサーバーサイドで正しくフィルタリングされるか |
| **トースト通知** | リダイレクト後のSonnerトーストが表示されるか |
| **データ永続化** | 作成したデータが一覧に反映される、削除後に消えるなど |

### コンポーネント統合テスト（中間層）は必要か？

**結論: 現時点では不要。E2Eテストで十分カバーできる。**

理由:
- Next.js App Routerでは、Server Components / Server Actions / route権限チェックがすべてサーバーランタイムに依存
- `cookies()`, `redirect()`, `verifySession()` 等はNext.jsサーバーなしでは動作せず、中間層テストで再現が困難
- コンポーネント単体テスト + E2Eテストの2層で、投資対効果が最も高い
- 将来的にフォームのインタラクションが複雑化した場合は、コンポーネント単体テスト側を拡充すればよい

### テスト層の責務まとめ

```
コンポーネント単体テスト (Vitest + RTL)
  → UIロジック、フォーム入力、モック境界での動作確認
  → 高速・安定・大量に書ける

E2Eテスト (Playwright)
  → ユーザージャーニー、サーバー連携、権限、画面遷移
  → 遅い・不安定になりやすいので、重要フローに絞る
```

---

## E2Eテストケース設計

### ファイル構成

既存パターン（feature配下にco-locate）に従う:

```
src/app/(features)/employees/
  employees-list.e2e.ts        # 一覧画面
  employees-create.e2e.ts      # 新規作成画面
  employees-detail.e2e.ts      # 詳細・編集・削除画面
```

### 前提: テストデータ

- Seed: 2000件の従業員（EMP000001〜EMP002000）
- Admin: employee1@example.com (EMP000001) → `playwright/.auth/admin.json`
- User: employee2@example.com (EMP000002) → `playwright/.auth/user.json`
- chromiumプロジェクトはデフォルトでadmin認証

### A. `employees-list.e2e.ts` — 一覧画面 (7テスト)

| # | テスト名 | 認証 | 検証内容 |
|---|---------|------|---------|
| 1 | 一覧が表示され、管理者には「新規登録」ボタンが見える | admin | heading「従業員管理」、「新規登録」リンク、DataTableの行が表示 |
| 2 | 一般ユーザーには「新規登録」ボタンが見えない | user | 一覧は表示されるが「新規登録」リンクがない |
| 3 | メールアドレスで検索（部分一致）できる | admin | 「employee1」で検索→URLに`?email=employee1`→結果にemployee1@example.comを含む |
| 4 | 従業員コードで検索（完全一致）できる | admin | 「EMP000001」で検索→1件表示 |
| 5 | 権限で検索できる | admin | 「管理者」選択→結果のバッジがすべて「管理者」 |
| 6 | クリアボタンで検索条件がリセットされる | admin | 検索→クリア→URLパラメタなし |
| 7 | 従業員コードリンクから詳細画面に遷移できる | admin | リンククリック→`/employees/EMP...`に遷移 |

### B. `employees-create.e2e.ts` — 新規作成画面 (4テスト)

| # | テスト名 | 認証 | 検証内容 |
|---|---------|------|---------|
| 1 | 管理者が新規従業員を作成できる（Happy Path） | admin | 一覧→新規登録→フォーム入力→登録→一覧にリダイレクト→トースト「従業員を登録しました。」→作成した従業員が検索で見つかる |
| 2 | 一般ユーザーは新規作成画面にアクセスできない | user | `/employees/new`直接アクセス→`/signin?reason=forbidden`にリダイレクト |
| 3 | 重複する従業員コードでエラーが表示される | admin | EMP000001で登録→エラーメッセージ表示 |
| 4 | キャンセルボタンで一覧に戻れる | admin | キャンセルクリック→`/employees`に遷移 |

### C. `employees-detail.e2e.ts` — 詳細・編集・削除画面 (6テスト)

| # | テスト名 | 認証 | 検証内容 |
|---|---------|------|---------|
| 1 | 管理者が従業員情報を更新できる | admin | EMP000050の詳細→名前変更→更新→トースト「従業員情報を更新しました。」→変更が反映 |
| 2 | 本人は自分の情報を編集できる（owner権限） | user | EMP000002（本人）→「従業員変更」表示→フィールド有効→「更新」ボタンあり |
| 3 | 一般ユーザーは他人の情報を閲覧のみ | user | EMP000003→「従業員詳細」表示→フィールド無効→「更新」ボタンなし→「削除」ボタンなし |
| 4 | 管理者には削除ボタンが表示される | admin | EMP000003の詳細→「削除」ボタンあり |
| 5 | 管理者が従業員を削除できる | admin | テスト用従業員を作成→削除→一覧にリダイレクト→トースト「従業員を削除しました。」→検索で見つからない |
| 6 | 存在しない従業員コードで404が表示される | admin | `/employees/EMP999999`→Not Foundページ |

**合計: 17テスト**

---

## 実装ステップ

### Step 1: employees-list.e2e.ts の作成
- 一覧画面の7テストを実装
- 既存のdashboard.e2e.tsをパターン参考にする
- `test.use({ storageState })` でuser権限テストを実装

### Step 2: employees-create.e2e.ts の作成
- 新規作成画面の4テストを実装
- Happy Pathテストで使う従業員コードは `EMP099901`（seed範囲外）
- トーストの検証は `page.getByText("従業員を登録しました。")` で行う

### Step 3: employees-detail.e2e.ts の作成
- 詳細・編集・削除画面の6テストを実装
- 削除テストはStep 2で作成した従業員を使うか、別途作成してから削除する
- 更新テストはEMP000050など影響の少ないseed従業員を使用

### Step 4: テスト実行・確認
- `npx playwright test src/app/(features)/employees/` でemployeesテストのみ実行
- 失敗があれば修正

---

## テストデータ戦略

| 用途 | 使用する従業員 | 理由 |
|------|-------------|------|
| 一覧表示確認 | seed全体 | 件数を問わず「表示される」ことを確認 |
| 検索テスト | seed内の既知データ | EMP000001（コード完全一致）、employee1（メール部分一致）、admin（権限フィルタ） |
| 作成テスト | EMP099901（新規作成） | seed範囲(〜EMP002000)外で衝突回避 |
| 更新テスト | EMP000050 | 認証アカウント(001,002)以外のseed従業員 |
| 削除テスト | テスト内で作成した従業員 | 他テストへの影響を防ぐ |
| 権限テスト | EMP000002(本人), EMP000003(他人) | user認証はEMP000002なので |

## 重要ファイル

- `src/app/(features)/dashboard/dashboard.e2e.ts` — E2Eテストの参考パターン
- `src/app/(auth)/auth.setup.ts` — 認証セットアップ（admin.json, user.json生成）
- `playwright.config.ts` — Playwright設定
- `src/app/(features)/employees/page.tsx` — 一覧画面
- `src/app/(features)/employees/new/page.tsx` — 新規作成画面
- `src/app/(features)/employees/[employeeCd]/page.tsx` — 詳細画面
- `src/app/_components/redirect-reason-toast.tsx` — トースト表示ロジック（reason→メッセージ変換）
- `src/shared/constants/redirect-reasons.ts` — リダイレクト理由定数

## 検証方法

```bash
# employeesのE2Eテストのみ実行
npx playwright test src/app/(features)/employees/

# 全E2Eテスト実行（回帰確認）
npx playwright test

# UIモードで確認（デバッグ用）
npx playwright test --ui
```
