# Issue #206: 部署関連画面のE2Eテストを作成する — 実装計画

## 概要

部署管理画面（一覧・新規作成・詳細/編集/削除）のE2Eテストを3ファイル作成する。
従業員管理画面の既存E2Eテスト（`employees-list.e2e.ts`, `employees-create.e2e.ts`, `employees-detail.e2e.ts`）のパターンを踏襲し、管理者・一般ユーザーの権限別テストを分離する。

### 従業員テストとの主な差分

| 項目 | 従業員 | 部署 |
|------|--------|------|
| owner権限 | 本人なら編集可 | なし（管理者のみ） |
| 親子関係 | なし | 親部署selectフィールドあり |
| isActive | なし | 更新フォームにcheckboxあり |
| 削除制約 | なし | 子部署ありの場合エラー |
| 一般ユーザー詳細 | 「従業員詳細」/「従業員変更」(本人) | 「部署詳細」のみ（全フィールドdisabled） |

## 設計判断

### proxy.tsへの`/departments/new`追加

**対応済み**: `src/proxy.ts` の `adminRoutes` に `/departments/new` が追加済み（origin/develop に反映済み）。
本計画での修正は不要。

### 更新テストのデータ方式

更新テスト（名前変更、isActive変更）ではテスト用部署を beforeEach で作成し、そのデータに対して更新操作を行う。

- seedデータに触れないため、他テストとの干渉リスクがない
- afterEach でテスト用部署を削除してクリーンアップする

## ステップ

### Step 1: 一覧画面E2Eテスト

- 対象ファイル:
  - `src/app/(features)/departments/departments-list.e2e.ts`（新規作成）
- 作業内容:
  - `waitForListReady()` ヘルパー実装（見出し「部署管理」+ テーブル1行目の表示待ち）
  - 管理者テスト（7ケース）:
    - 一覧表示 + 「新規登録」ボタン表示
    - 部署名で検索（部分一致: 「営業」→ `name=営業` → 「営業部」表示）
    - 略称で検索（部分一致: 「営業」→ `abbreviation=` → 「営業部」表示）
    - 部署コードで検索（完全一致: 「DEPT001」→ 1行 → DEPT001リンク）
    - 状態で検索（「有効」→ `isActive=true` → 全行「有効」Badge）
    - クリアボタンで検索条件リセット
    - 部署コードリンクから詳細画面に遷移
  - 一般ユーザーテスト（1ケース）:
    - 「新規登録」ボタンが非表示
- コミットメッセージ: `test: 部署一覧画面のE2Eテストを作成`

### Step 2: 新規作成画面E2Eテスト

- 対象ファイル:
  - `src/app/(features)/departments/departments-create.e2e.ts`（新規作成）
- 作業内容:
  - テストデータ定数定義（DEPT901, E2Eテスト部署, E2Eテスト）
  - 管理者テスト（3ケース）:
    - 新規部署作成（入力→登録→トースト「部署を登録しました。」→ afterEachで削除）
    - 重複部署コードでエラー（DEPT001→ `role="alert"` → ページ遷移なし）
    - キャンセルボタンで一覧に戻れる
  - 一般ユーザーテスト（1ケース）:
    - `/departments/new` → `/signin?reason=forbidden` リダイレクト（proxy.ts対応済み）
- コミットメッセージ: `test: 部署新規作成画面のE2Eテストを作成`

### Step 3: 詳細・編集・削除画面E2Eテスト

- 対象ファイル:
  - `src/app/(features)/departments/departments-detail.e2e.ts`（新規作成）
- 作業内容:
  - ヘルパー関数実装:
    - `createTestDepartment(page, { departmentCd, name, abbreviation, parentName? })` — UI経由でテスト部署を作成
    - `deleteTestDepartment(page, departmentCd)` — UI経由でテスト部署を削除
  - テストデータ定数定義:
    - 更新テスト用: DEPT904
    - 削除テスト用: DEPT902
    - 親子テスト用: DEPT901（親）, DEPT903（子）
    - isActiveテスト用: DEPT905
  - 管理者テスト（6ケース）:
    - 部署情報更新（beforeEachでDEPT904作成→名前変更→トースト→afterEachで削除）
    - 削除ボタン表示確認
    - 部署削除（beforeEachでDEPT902作成→削除→トースト→検索で見つからない）
    - 子部署ありで削除不可（beforeEachで親子ペア作成→親削除→エラー→afterEachで子→親の順に削除）
    - 存在しない部署コードで404
    - isActive変更（beforeEachでDEPT905作成→チェックボックスOFF→更新→反映確認→afterEachで削除）
  - 一般ユーザーテスト（1ケース）:
    - 閲覧のみ（「部署詳細」見出し、フィールドdisabled、更新・削除ボタン非表示）
- コミットメッセージ: `test: 部署詳細・編集・削除画面のE2Eテストを作成`

## 参照ファイル

### テストパターン参照（従業員E2E）
- `src/app/(features)/employees/employees-list.e2e.ts`
- `src/app/(features)/employees/employees-create.e2e.ts`
- `src/app/(features)/employees/employees-detail.e2e.ts`

### 部署画面の実装
- `src/app/(features)/departments/page.tsx` — 一覧ページ
- `src/app/(features)/departments/new/page.tsx` — 新規作成ページ
- `src/app/(features)/departments/new/DepartmentCreateForm.tsx` — 作成フォーム
- `src/app/(features)/departments/[departmentCd]/page.tsx` — 詳細ページ
- `src/app/(features)/departments/[departmentCd]/DepartmentUpdateForm.tsx` — 更新フォーム
- `src/app/(features)/departments/[departmentCd]/DepartmentDeleteForm.tsx` — 削除フォーム
- `src/app/(features)/departments/[departmentCd]/actions.ts` — Server Actions（更新・削除）
- `src/app/(features)/departments/new/actions.ts` — Server Action（作成）
- `src/app/_components/redirect-reason-toast.tsx` — トーストメッセージ定義
- `src/proxy.ts` — ミドルウェアの管理者ルート定義

### トーストメッセージ
- 作成成功: `"部署を登録しました。"`
- 更新成功: `"部署情報を更新しました。"`
- 削除成功: `"部署を削除しました。"`

### seedデータ
- DEPT001: 営業部（営業）、DEPT002: 開発部（開発）、DEPT003: 総務部（総務）、DEPT004: 人事部（人事）、DEPT005: 経理部（経理）

## 検証方法

```bash
# 全部署E2Eテスト実行
pnpm e2e --grep "部署"

# ファイル単位で実行
pnpm e2e src/app/\(features\)/departments/departments-list.e2e.ts
pnpm e2e src/app/\(features\)/departments/departments-create.e2e.ts
pnpm e2e src/app/\(features\)/departments/departments-detail.e2e.ts

# headed モードで確認（ブラウザが開く）
pnpm e2e:headed src/app/\(features\)/departments/departments-list.e2e.ts
```

全18テストケース（管理者16 + 一般ユーザー3、ただし一般ユーザーの一覧テスト1含む）がパスすること。
