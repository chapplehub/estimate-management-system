# Issue #239: 得意先機能の管理者制御を削除 — 実装計画

## 概要

得意先（取引先）の作成・編集・削除・ステータス変更を全ユーザーに開放する。
現在は `isAdmin(session)` による UI 表示制御と `verifyAdmin()` による Server Action のアクセス制御が入っており、これらを全て削除して `verifySession()`（認証のみ）に置き換える。

**影響範囲**: プレゼンテーション層のみ。Application層・Domain層に権限チェックは存在しないため変更不要。

## 設計判断

### `CustomerDetailView` コンポーネントの扱い
- 管理者制御を削除すると、詳細画面は常に `CustomerUpdateForm`（編集フォーム）を表示するため `CustomerDetailView`（読み取り専用）は不要になる
- 推奨: 未使用コンポーネントとして削除（必要になれば git 履歴から復元可能）

## ステップ

### Step 1: 一覧画面から管理者制御を削除
- 対象ファイル: `src/app/(features)/customers/page.tsx`
- 作業内容:
  - `isAdmin` の import を削除
  - L125 の `{isAdmin(session) && (` 条件分岐を削除し、「新規登録」ボタンを常に表示
  - `session` 変数が不要になった場合は `verifySession()` の戻り値代入も削除
- コミットメッセージ: `refactor: 得意先一覧画面の管理者制御を削除`

### Step 2: 詳細画面から管理者制御を削除
- 対象ファイル: `src/app/(features)/customers/[code]/page.tsx`
- 作業内容:
  - `isAdmin` の import を削除
  - `canEdit` 変数を削除
  - L44: タイトルを常に「得意先編集」に固定
  - L50-57: 条件分岐を削除し、常に `CustomerUpdateForm` を表示
  - L98-108: `{canEdit && (` を削除し、アクションボタンを常に表示
  - `CustomerDetailView` の import を削除
  - コメント `{/* 取引先情報: 管理者は編集フォーム / 一般は読み取り専用 */}` と `{/* アクションボタン（管理者のみ） */}` を削除
- コミットメッセージ: `refactor: 得意先詳細画面の管理者制御を削除`

### Step 3: Server Actions の管理者チェックを認証チェックに置き換え
- 対象ファイル:
  - `src/app/(features)/customers/new/actions.ts`
  - `src/app/(features)/customers/[code]/actions.ts`
- 作業内容:
  - `import { verifyAdmin }` → `import { verifySession }` に変更
  - 各アクション内の `await verifyAdmin()` → `await verifySession()` に変更
  - 対象アクション: `createCustomer`, `updateCustomer`, `deleteCustomer`, `activateCustomer`, `deactivateCustomer`（計5箇所）
- コミットメッセージ: `refactor: 得意先Server Actionsの管理者チェックを認証チェックに変更`

### Step 4: 未使用コンポーネントの削除
- 対象ファイル: `src/app/(features)/customers/[code]/CustomerDetailView.tsx`
- 作業内容:
  - ファイルを削除（全ユーザーが編集フォームを使用するため不要）
- コミットメッセージ: `refactor: 未使用の CustomerDetailView コンポーネントを削除`

### Step 5: E2Eテストの修正
- 対象ファイル:
  - `src/app/(features)/customers/customers-list.e2e.ts`
  - `src/app/(features)/customers/customers-detail.e2e.ts`
- 作業内容:
  - **一覧テスト L31-32**: 「新規登録」ボタンの `not.toBeVisible()` → `toBeVisible()` に変更
  - **一般ユーザーテスト**: 一般ユーザーでも「新規登録」ボタンが見えることを検証追加
  - **詳細テスト**: `dt`/`dd` セレクタで読み取り専用ビューを検証している箇所が、編集フォーム表示に変わるため、実際の DOM に合わせて修正が必要になる可能性がある（テスト実行で確認）
- コミットメッセージ: `test: 得意先E2Eテストを管理者制御削除に合わせて修正`

## 検証

1. `pnpm lint` — 未使用 import がないことを確認
2. `pnpm build` — ビルドが通ることを確認
3. `pnpm e2e` — 得意先関連の E2E テストが通ることを確認
4. ブラウザで一般ユーザーログインし以下を確認:
   - 一覧画面で「新規登録」ボタンが表示される
   - 詳細画面で編集フォームとアクションボタンが表示される
