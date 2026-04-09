# Issue #225: 従業員E2Eテストを CRUD 直列化方式にリファクタリング — 実装計画

## 概要

`employees-create.e2e.ts` と `employees-detail.e2e.ts` を `employees-crud.e2e.ts` に統合する。
副作用のあるテスト（create → update → delete）を `test.describe.serial` で直列実行し、
create がデータセットアップ、delete がクリーンアップを兼ねる構成にする。
副作用のないテスト（重複エラー、キャンセル、404、権限テスト等）は並列のまま維持する。

### 背景

Prisma 7.x の TypeScript 生成クライアントが Playwright の esbuild と非互換であるため、
Prisma による直接DB操作を断念し、CRUD テストの直列化でデータ管理を解決する。

## 設計判断

### 更新テストの対象をシリアルCRUDフローの作成済み従業員に変更

- A. 現行通り seed データ（EMP000050）を更新対象にする
- B. シリアルフローで作成した従業員（EMP099901）を更新対象にする
- 推奨: B（CRUDライフサイクルの一貫性を保ち、seed データへの副作用を排除するため）

### createTestEmployee ヘルパーの扱い

- 現行: `employees-detail.e2e.ts` の `createTestEmployee` は `beforeEach` でのみ使用
- 統合後: シリアルフローの最初のテストが作成を担うため、ヘルパー不要
- 既存パターン（`roles-detail.e2e.ts`）と一致

## ファイル構造

```
employees-crud.e2e.ts
│
├── Constants: TEST_EMPLOYEE_CD = "EMP099901", TEST_EMAIL = "e2e-create-test@example.com"
│
├── describe "従業員CRUD（管理者）"
│   ├── describe.serial "作成・更新・削除テスト"
│   │   ├── test: "管理者が新規従業員を作成できる"     ← create.e2e.ts から移植
│   │   ├── test: "管理者が従業員情報を更新できる"     ← detail.e2e.ts から移植（対象をEMP099901に変更）
│   │   └── test: "管理者が従業員を削除できる"         ← detail.e2e.ts から移植
│   ├── test: "重複する従業員コードでエラーが表示される" ← create.e2e.ts（seed EMP000001使用）
│   ├── test: "キャンセルボタンで一覧に戻れる"         ← create.e2e.ts
│   ├── test: "管理者には削除ボタンが表示される"       ← detail.e2e.ts（seed EMP000003使用）
│   └── test: "存在しない従業員コードで404が表示される" ← detail.e2e.ts
│
└── describe "従業員（一般ユーザー）"  [storageState: user.json]
    ├── test: "一般ユーザーは新規作成画面にアクセスできない" ← create.e2e.ts
    ├── test: "本人は自分の情報を編集できる（owner権限）"   ← detail.e2e.ts（EMP000002）
    └── test: "一般ユーザーは他人の情報を閲覧のみ"         ← detail.e2e.ts（EMP000003）
```

## ステップ

### Step 1: ADR-0012 にテストデータ管理方針（判断4）を追記

- 対象ファイル: `docs/adr/0012-e2e-test-db-separation-strategy.md`
- 作業内容:
  - コンテキストに Prisma 7.x の `import.meta.url` 非互換問題を追記
  - 「判断4: テストデータのセットアップ・クリーンアップ方式」を追加
    - A. Prisma クライアントで直接DB操作（不採用）— Prisma 7.x の TypeScript 生成クライアントが `import.meta.url` を使用し、Playwright の esbuild トランスパイラと非互換
    - B. CRUD テストの直列化（`test.describe.serial`）でデータ管理（採用）— 副作用テスト（create → update → delete）を直列実行し、create がセットアップ、delete がクリーンアップを兼ねる。副作用のないテスト（参照系・権限）は並列維持
  - 決定セクション・根拠セクション・影響セクションにも反映
- コミットメッセージ: `docs: ADR-0012 にCRUD直列化テスト方針を追記 (#225)`

### Step 2: employees-crud.e2e.ts を作成

- 対象ファイル: `src/app/(features)/employees/employees-crud.e2e.ts`（新規作成）
- 作業内容:
  - 上記ファイル構造に従い、2ファイルのテストを統合した新規ファイルを作成
  - `test.describe.serial` で CRUD フロー（create → update → delete）を直列化
  - 更新テストの対象を `TEST_EMPLOYEE_CD`（EMP099901）に変更
  - `createTestEmployee` ヘルパー・`afterEach` クリーンアップ・`beforeEach` セットアップを削除
  - 副作用のないテストは独立した describe ブロックに配置
  - 一般ユーザーテストを1つの describe ブロックに統合
- コミットメッセージ: `test: 従業員E2Eテストを employees-crud.e2e.ts に統合 (#225)`

### Step 3: 旧テストファイルを削除

- 対象ファイル:
  - `src/app/(features)/employees/employees-create.e2e.ts`（削除）
  - `src/app/(features)/employees/employees-detail.e2e.ts`（削除）
- 作業内容:
  - 2つの旧テストファイルを削除
- コミットメッセージ: `refactor: 統合済みの従業員E2Eテストファイルを削除 (#225)`

### Step 4: e2e-helpers/prisma.ts を削除

- 対象ファイル: `e2e-helpers/prisma.ts`（削除）、`e2e-helpers/` ディレクトリ（削除）
- 作業内容:
  - `e2e-helpers/prisma.ts` を削除（どこからもインポートされていない）
  - 空になる `e2e-helpers/` ディレクトリを削除
- コミットメッセージ: `chore: 未使用の e2e-helpers/prisma.ts を削除 (#225)`

### Step 5: テスト実行・動作確認

- 作業内容:
  - `pnpm e2e` で全E2Eテストが通ることを確認
  - 特に employees-crud.e2e.ts の serial テストが create → update → delete の順で正常動作すること
  - employees-list.e2e.ts が変更なく正常動作すること

## 検証方法

```bash
# 従業員テストのみ実行
npx playwright test src/app/\(features\)/employees/

# 全E2Eテスト実行
pnpm e2e
```

確認ポイント:
- serial CRUD チェーンが正常に通過する（create → update → delete）
- 並列テストが正常に通過する（重複エラー、キャンセル、削除ボタン表示、404）
- 一般ユーザー権限テストが正常に通過する
- employees-list.e2e.ts に影響がないこと
