# Issue #206: 部署E2Eテストを CRUD 直列化方式にリファクタリング — 実装計画

## 概要

`departments-create.e2e.ts` と `departments-detail.e2e.ts` を `departments-crud.e2e.ts` に統合する。
副作用のあるテスト（create → update → isActive → delete）を `test.describe.serial` で直列実行し、
create がデータセットアップ、delete がクリーンアップを兼ねる構成にする。
子部署削除制約テストは独自のデータライフサイクルが必要なため、2つ目の `test.describe.serial` チェーンで対応する。
副作用のないテスト（重複エラー、キャンセル、404、権限テスト等）は並列のまま維持する。
`departments-list.e2e.ts` は参照系のため変更なし。

### 背景

Issue #225 で確立された CRUD 直列化パターンに従い、部署テストもリファクタリングする。
Prisma 7.x の TypeScript 生成クライアントが Playwright の esbuild と非互換のため、
beforeEach/afterEach + ヘルパー関数によるデータ管理を廃止し、serial チェーンに統一する。
また、今回からテスト用DB（seed-e2e.ts）上でテストを実行するため、シードデータとの互換性を確認済み。

## テスト用DBシードデータ互換性

テストが参照するシードデータが `prisma/seed-e2e.ts` に存在するか照合した結果、
**全てのテストが現在のseed-e2e.tsデータで動作可能であり、追加は不要**。

### E2E seed の部署データ（3件）

| コード | 名前 | 略称 | isActive | 親部署 |
|--------|------|------|----------|--------|
| DEPT001 | 営業部 | 営業 | true | なし |
| DEPT002 | 開発部 | 開発 | true | なし |
| DEPT003 | 総務部 | 総務 | true | なし |

### テストごとのシードデータ依存

| テスト | 必要なシードデータ | E2E seed |
|--------|-------------------|----------|
| 重複エラー | DEPT001 が存在すること | OK |
| 削除ボタン表示 | DEPT003 が存在すること | OK |
| 404テスト | DEPT999 が存在しないこと | OK |
| 一般ユーザー閲覧 (DEPT001) | DEPT001 が存在すること | OK |
| リスト: 部署名検索 "営業" | "営業部" が存在すること | OK |
| リスト: 略称検索 "営業" | 略称 "営業" が存在すること | OK |
| リスト: コード検索 DEPT001 | DEPT001 が1件のみ | OK |
| リスト: 状態検索 isActive=true | 有効な部署が1件以上 | OK |
| CRUDチェーン (DEPT901等) | UIから作成するためシード不要 | — |

## 設計判断

### 子部署削除制約テストの構造

- A. 2つ目の `describe.serial` チェーン（5テスト: 親作成 → 子作成 → 制約テスト → 子削除 → 親削除）
- B. 単一の自己完結テスト（1テスト内でインラインにセットアップ・検証・クリーンアップ）
- 推奨: A（失敗時にどのステップで止まったかが明確。途中失敗時に孤立データが残るリスクも serial のスキップ挙動で軽減される）

## ファイル構造

```
departments-crud.e2e.ts
│
├── Constants:
│   TEST_DEPT_CD = "DEPT901"         (メインCRUDチェーン)
│   TEST_DEPT_NAME = "E2Eテスト部署"
│   TEST_DEPT_ABBR = "E2Eテスト"
│   PARENT_DEPT_CD = "DEPT902"       (子部署制約チェーン)
│   CHILD_DEPT_CD = "DEPT903"        (子部署制約チェーン)
│
├── describe "部署CRUD（管理者）"
│   ├── describe.serial "作成・更新・削除テスト"
│   │   ├── test: "管理者が新規部署を作成できる"       ← create.e2e.ts
│   │   ├── test: "管理者が部署情報を更新できる"       ← detail.e2e.ts（対象: DEPT901）
│   │   ├── test: "管理者がisActiveを変更できる"       ← detail.e2e.ts（対象: DEPT901）
│   │   └── test: "管理者が部署を削除できる"           ← detail.e2e.ts（対象: DEPT901）
│   │
│   ├── describe.serial "子部署削除制約テスト"
│   │   ├── test: "親部署を作成できる"                 ← inline（DEPT902）
│   │   ├── test: "子部署を作成できる"                 ← inline（DEPT903, parent=DEPT902）
│   │   ├── test: "子部署がある場合は削除できない"     ← detail.e2e.ts
│   │   ├── test: "子部署を削除できる"                 ← cleanup（DEPT903）
│   │   └── test: "親部署を削除できる"                 ← cleanup（DEPT902）
│   │
│   ├── test: "重複する部署コードでエラーが表示される" ← create.e2e.ts（seed DEPT001）
│   ├── test: "キャンセルボタンで一覧に戻れる"         ← create.e2e.ts
│   ├── test: "管理者には削除ボタンが表示される"       ← detail.e2e.ts（seed DEPT003）
│   └── test: "存在しない部署コードで404が表示される"  ← detail.e2e.ts
│
└── describe "部署（一般ユーザー）"  [storageState: user.json]
    ├── test: "一般ユーザーは新規作成画面にアクセスできない" ← create.e2e.ts
    └── test: "一般ユーザーは閲覧のみ"                      ← detail.e2e.ts（seed DEPT001）
```

### 排除されるコード

- `createTestDepartment()` ヘルパー関数
- `deleteTestDepartment()` ヘルパー関数
- 全ての `test.beforeEach` / `test.afterEach` フック
- テストデータ定数 `DEPT904`, `DEPT905`（不要になる）

## ステップ

### Step 1: departments-crud.e2e.ts を作成

- 対象ファイル: `src/app/(features)/departments/departments-crud.e2e.ts`（新規作成）
- 作業内容:
  - 上記ファイル構造に従い、2ファイルのテストを統合した新規ファイルを作成
  - `test.describe.serial` でメインCRUDフロー（create → update → isActive → delete）を直列化
  - 2つ目の `test.describe.serial` で子部署削除制約フローを直列化
  - 更新・isActive・削除テストの対象を全て `TEST_DEPT_CD`（DEPT901）に統一
  - ヘルパー関数・beforeEach・afterEach を全て排除
  - 副作用のないテスト・権限テストはそのまま移植
- コミットメッセージ: `test: 部署E2Eテストを departments-crud.e2e.ts に統合 (#206)`

### Step 2: 旧テストファイルを削除

- 対象ファイル:
  - `src/app/(features)/departments/departments-create.e2e.ts`（削除）
  - `src/app/(features)/departments/departments-detail.e2e.ts`（削除）
- 作業内容:
  - 2つの旧テストファイルを削除
  - `departments-list.e2e.ts` が変更されていないことを確認
- コミットメッセージ: `refactor: 統合済みの部署E2Eテストファイルを削除 (#206)`

### Step 3: テスト実行・動作確認

- 作業内容:
  - `npx playwright test src/app/\(features\)/departments/` で部署テストのみ実行
  - `pnpm e2e` で全E2Eテスト実行
- 確認ポイント:
  - メインserial CRUDチェーンが正常に通過する（create → update → isActive → delete）
  - 子部署制約serialチェーンが正常に通過する（親作成 → 子作成 → 制約テスト → 子削除 → 親削除）
  - 並列テストが正常に通過する（重複エラー、キャンセル、削除ボタン表示、404）
  - 一般ユーザー権限テストが正常に通過する
  - `departments-list.e2e.ts` に影響がないこと

## 検証方法

```bash
# 部署テストのみ実行
npx playwright test src/app/\(features\)/departments/

# 全E2Eテスト実行
pnpm e2e
```
