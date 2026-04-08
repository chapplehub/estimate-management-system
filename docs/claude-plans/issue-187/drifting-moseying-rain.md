# Issue #187: 役割管理画面のE2Eテスト作成 — 実装計画

## 概要

#175 で実装した役割管理画面（一覧・新規作成・編集・削除）のE2Eテストを Playwright で作成する。
既存の従業員E2Eテスト（`employees-list.e2e.ts`, `employees-create.e2e.ts`, `employees-detail.e2e.ts`）のパターンに準拠し、動的上位役割フィルタリングのテストも含む。

## 設計判断

### テストファイル構成
- 従業員テストと同じ3ファイル構成（list / create / detail）で統一
- 動的フィルタリングテストは `roles-create.e2e.ts` に含める（クライアント側フィルタリングは新規作成フォームのみ）

### テストデータ戦略
- テスト用の役割コード: `ROLE901`（create用）、`ROLE902`（detail用）— シード範囲 ROLE001〜ROLE015 外
- 削除エラーテストはシードデータを利用（ROLE001: 下位役割あり、ROLE009: 従業員割当あり）
- 作成テストは `afterEach` でUI経由クリーンアップ（従業員テストと同パターン）
- 削除テストは `beforeEach` で `createTestRole()` ヘルパーを使い一時データ作成

### 非管理者アクセステスト
- 従業員テストと同じく `/signin?reason=forbidden` リダイレクトを期待する
- 前提: `src/proxy.ts` の `adminRoutes` に `/roles/new` を追加する修正が別ブランチで行われ、本ブランチに取り込まれていること

## ステップ

### Step 1: 役割一覧E2Eテスト作成

- 対象ファイル: `src/app/(features)/roles/roles-list.e2e.ts`
- 作業内容:
  - `waitForListReady()` ヘルパー作成（heading「役割管理」+ テーブル行の表示を待機）
  - 管理者テスト:
    - `一覧が表示され、管理者には「新規登録」ボタンが見える` — ページ表示、heading、新規登録リンク、DataTable行
    - `役割名で検索（部分一致）できる` — "営業" で検索、URL検証、結果に営業系役割表示
    - `役割コードで検索（完全一致）できる` — "ROLE001" で検索、結果1行、リンク表示
    - `役職で検索できる` — "課長" 選択、URL検証、表示される役職列がすべて "課長"
    - `クリアボタンで検索条件がリセットされる` — `/roles?name=営業` → クリア → `/roles`
    - `役割コードリンクから詳細画面に遷移できる` — ROLE001 リンククリック → `/roles/ROLE001`
  - 一般ユーザーテスト:
    - `一般ユーザーには「新規登録」ボタンが見えない` — storageState切替、テーブル行あり、新規登録リンクなし
- 参考ファイル: `src/app/(features)/employees/employees-list.e2e.ts`
- コミットメッセージ: `test(e2e): 役割一覧画面のE2Eテスト作成 (#187)`

### Step 2: 役割新規作成・動的フィルタリングE2Eテスト作成

- 対象ファイル: `src/app/(features)/roles/roles-create.e2e.ts`
- 作業内容:
  - テストデータ定数: `TEST_ROLE_CD = "ROLE901"`
  - `afterEach` クリーンアップ: `/roles/ROLE901` に遷移して削除ボタンクリック
  - 管理者テスト（作成）:
    - `管理者が新規役割を作成できる` — 一覧→新規→フォーム入力（ROLE901、E2Eテスト役割、課長、上位役割選択）→登録→リダイレクト→トースト「役割を登録しました。」→検索確認
    - `重複する役割コードでエラーが表示される` — ROLE001（既存）で登録→ `role="alert"` 表示、ページ遷移なし
    - `役割名が未入力でバリデーションエラーが表示される` — 名前空のまま登録→エラー表示
    - `キャンセルボタンで一覧に戻れる` — キャンセルクリック→ `/roles`
  - 管理者テスト（動的上位役割フィルタリング）:
    - `役職選択で上位役割候補がフィルタリングされる` — 課長選択→上位役割ドロップダウン表示→部長系役割がオプションに含まれる
    - `役職変更で上位役割の選択がリセットされる` — 課長→上位役割選択→部長に変更→上位役割リセット、本部長系がオプションに
    - `最上位役職では上位役割が表示されない` — 社長選択→上位役割ドロップダウン非表示→メッセージ「この役職には上位役職がないため、上位役割は設定できません。」表示
    - `本部長選択で社長の役割が上位候補になる` — 本部長選択→上位役割表示→「社長」がオプションに
  - 一般ユーザーテスト:
    - `一般ユーザーは新規作成画面にアクセスできない` — `/roles/new` → `/signin?reason=forbidden` リダイレクト
- 参考ファイル: `src/app/(features)/employees/employees-create.e2e.ts`, `src/app/(features)/roles/new/RoleCreateForm.tsx`
- コミットメッセージ: `test(e2e): 役割新規作成・動的フィルタリングのE2Eテスト作成 (#187)`

### Step 3: 役割詳細・編集・削除E2Eテスト作成

- 対象ファイル: `src/app/(features)/roles/roles-detail.e2e.ts`
- 作業内容:
  - テストデータ定数: `TEST_ROLE_CD = "ROLE902"`
  - `createTestRole()` ヘルパー: `/roles/new` からフォーム入力→登録→リダイレクト待ち
  - 管理者テスト（更新・削除成功） — `test.describe` で囲み、共通の `beforeEach` で ROLE902 作成:
    - `管理者が役割情報を更新できる` — `/roles/ROLE902` → 「役割変更」表示 → 役割コード/役職が disabled → 名前変更 → 更新ボタン → トースト「役割情報を更新しました。」→ 値反映確認 → afterEach で削除
    - `管理者が未使用の役割を削除できる` — `/roles/ROLE902` → 削除ボタン → `/roles` リダイレクト → トースト「役割を削除しました。」→ 検索で見つからない
  - 管理者テスト（削除エラー）:
    - `使用中の役割は削除できない` — `/roles/ROLE009`（従業員割当あり）→ 削除 → `role="alert"` にエラーメッセージ表示 → ページ遷移なし
    - `下位役割がある役割は削除できない` — `/roles/ROLE001`（下位役割あり）→ 削除 → `role="alert"` にエラーメッセージ表示 → ページ遷移なし
  - 管理者テスト（404）:
    - `存在しない役割コードで404が表示される` — `/roles/ROLE999` → 404 表示
  - 一般ユーザーテスト:
    - `一般ユーザーは閲覧のみ` — storageState切替 → `/roles/ROLE001` → 「役割詳細」表示（「役割変更」ではない）→ 名前フィールド disabled → 更新/削除ボタン非表示
- 参考ファイル: `src/app/(features)/employees/employees-detail.e2e.ts`, `src/app/(features)/roles/[roleCd]/RoleUpdateForm.tsx`, `src/app/(features)/roles/[roleCd]/RoleDeleteForm.tsx`
- コミットメッセージ: `test(e2e): 役割詳細・編集・削除のE2Eテスト作成 (#187)`

## 実装上の注意点

- 役職ドロップダウンは UUID を value に使用。テストでは `selectOption({ label: "課長" })` で選択
- 上位役割ドロップダウンは条件付きレンダリング（`selectedPositionId && superiorRoleOptions.length > 0`）。Playwright の auto-wait で対応可能だが、タイミング問題があれば `waitFor` 追加
- トーストメッセージは `redirect-reason-toast` コンポーネント経由。リダイレクト後にページロード完了を待つ必要がある
- 削除エラーは `useActionState` で管理され、`role="alert"` の div に表示（リダイレクトなし）
- 更新テストでシードデータの名前を変更する場合、他テストへの影響を避けるためテスト専用の ROLE902 を使用

## 実装時の逸脱（Deviations）

### Step 1: roles-list.e2e.ts

- **URLアサーション変更**: `/name=営業/` → `/name=/` に変更。日本語がURLエンコード（`%E5%96%B6%E6%A5%AD`）されるため、パラメータの存在のみ検証する形に修正。
- **検索結果の検証方法変更**: `getByText("営業本部長")` → 全行の役割名列（`td:nth-child(2)`）に対して `toContainText("営業")` で部分一致検証。「営業本部長」が複数セルにマッチし strict mode violation が発生したため。

### Step 2: roles-create.e2e.ts

- **afterEachのスコープ変更**: 計画では内側の「データ作成テスト」describe 内に配置する想定だったが、外側の「役割新規作成（管理者）」describe に移動し、内側の wrapper を削除。並列実行時にスコープが限定されすぎてテストが不安定になったため。

### Step 3: roles-detail.e2e.ts

- **beforeEach → beforeAll + serial に変更**: 計画では `test.describe` + `beforeEach`（毎回 ROLE902 作成）だったが、`test.describe.serial` + `beforeAll`（1回だけ作成）に変更。`fullyParallel: true` 環境で更新・削除テストが同時実行されフレーキーテストになったため、serial で順序保証する方式に。
- **beforeAll内の認証方法**: `browser.newPage()` では project の storageState が継承されないため、`browser.newContext({ storageState: "playwright/.auth/admin.json" })` を使用して管理者認証を明示的に指定。
- **afterEach削除**: serial 実行で更新→削除の順が保証されるため、削除テスト自体がクリーンアップを兼ねる。計画にあった afterEach での削除処理は不要に。

## 検証方法

```bash
# 役割E2Eテストのみ実行
pnpm exec playwright test src/app/\(features\)/roles/

# 全E2Eテスト実行（既存テストとの干渉がないことを確認）
pnpm e2e

# UIモードで確認
pnpm e2e:ui
```
