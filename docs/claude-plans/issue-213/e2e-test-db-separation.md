# E2Eテスト専用DB環境の構築 — 実装計画

## 概要

E2Eテストのデータ管理を安定化させるため、テスト専用DBを導入する。
開発DBとテストDBを完全分離し、E2E専用の軽量シードデータで毎回クリーンな状態からテストを実行できるようにする。

**スコープ**: 仕組みの導入のみ。既存テストの修正は段階的に行う（本計画の対象外）。

### 現状の問題
- テストデータを画面操作(UI)で作成 → 遅い、前提テストの失敗で連鎖
- 開発用Seedデータへの依存 → Seed変更でテスト壊れる
- afterEachでUI経由の削除 → 失敗時にゴミデータ蓄積

### 導入後のワークフロー
```
pnpm e2e:setup  → テストDB作成 + マイグレーション + E2Eシード（明示的に実行）
pnpm e2e        → テスト実行（DBは準備済み前提）
pnpm e2e:ui     → UIモードでテスト実行（DBは準備済み前提）
```

## 設計判断

### テストサーバーのポート分離
- A. 開発と同じ port 3000 を使用
- B. テスト専用の port 3001 を使用
- 決定: **B**（開発サーバーとテストサーバーの共存が可能。UIモード頻用のため特に有効）

### 環境変数ファイルの管理
- A. `.env.test` をリポジトリにコミット
- B. `.env.test.example` をコミットし、`.env.test` は各開発者が作成
- 決定: **B**（PostgreSQL接続情報がローカル環境に依存するため、既存の `.env` パターンと統一）

### Playwright setup db プロジェクトの扱い
- 採用しない。`pnpm e2e:setup` で明示的にDB準備を行う
- 理由: UIモードを頻繁に使用するため、毎回DB初期化が走ると煩わしい
- 認証用の setup プロジェクト（`auth.setup.ts`）は現状維持

## ステップ

### Step 1: 環境設定ファイルの作成

- 対象ファイル:
  - `NEW` `.env.test.example`
  - `.gitignore`
- 作業内容:
  - `.env.test.example` を作成（テスト用DB接続情報のテンプレート）
    ```
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/estimate_e2e
    BETTER_AUTH_SECRET=e2e-test-secret-local
    BETTER_AUTH_URL=http://localhost:3001
    ```
  - `.gitignore` に `!.env.test.example` を追加
- コミットメッセージ: `chore: E2Eテスト用環境設定テンプレート作成`

### Step 2: E2E専用シードデータの作成

- 対象ファイル:
  - `NEW` `prisma/seed-e2e.ts`
- 作業内容:
  - 既存 `prisma/seed.ts` の構造を参考に、最小限のデータセットを定義
  - 全テーブルの既存データクリア → シード実行（冪等性確保）
  - データ内容（最小構成）:
    - 部署: 3件（営業部、開発部、総務部）
    - 役職: 4件（課長、部長、本部長、社長）
    - 役割: 5件（社長、営業本部長、営業部長、開発部長、営業課長）
    - 従業員: 20件（認証用固定2名 + 役割持ち5名 + 一般13名）
    - 得意先: 3件 + 納品先: 5件
  - 認証用固定ユーザー:
    - `employee1@example.com` (admin) — `auth.setup.ts` との整合性維持
    - `employee2@example.com` (user)
  - パスワード: `pass123!`（開発用Seedと統一）
  - 参考: 既存 `prisma/seed.ts` のデータ構造・FK制約順序・`generateId()` ユーティリティ
- コミットメッセージ: `feat: E2Eテスト専用シードデータ作成`

### Step 3: E2Eセットアップスクリプトの作成

- 対象ファイル:
  - `NEW` `scripts/e2e-setup.ts`
- 作業内容:
  - `.env.test` を dotenv で読み込み（`dotenv` は既存依存パッケージ）
  - PostgreSQL DB の存在チェック + 自動作成
    - `createdb` コマンドを使用（ローカルPostgreSQL前提）
    - 既存DBがあればスキップ
  - `prisma migrate deploy` を実行（DATABASE_URL を env 経由で渡す）
    - `prisma.config.ts` の `import "dotenv/config"` は既存env変数を上書きしないため、スクリプトで設定したDATABASE_URLが優先される
  - E2Eシード実行（`tsx prisma/seed-e2e.ts`、同じくenv経由）
- コミットメッセージ: `feat: E2Eテストセットアップスクリプト作成`

### Step 4: Playwright 設定の更新

- 対象ファイル:
  - `playwright.config.ts`
- 作業内容:
  - dotenv の読み込み先を `.env` → `.env.test` に変更
  - `baseURL` を `http://localhost:3001` に変更
  - `webServer.command` を `pnpm dev --port 3001` に変更
  - `webServer.url` を `http://localhost:3001` に変更
- コミットメッセージ: `refactor: Playwright設定をテスト専用DB・ポート3001に対応`

### Step 5: NPMスクリプトの追加

- 対象ファイル:
  - `package.json`
- 作業内容:
  - `"e2e:setup": "tsx scripts/e2e-setup.ts"` 追加
  - `"e2e:seed": "tsx prisma/seed-e2e.ts"` 追加（シード単体再実行用）
- コミットメッセージ: `chore: E2Eテスト用NPMスクリプト追加`

### Step 6: CI ワークフローの更新

- 対象ファイル:
  - `.github/workflows/playwright.yml`
- 作業内容:
  - `BETTER_AUTH_URL` を `http://localhost:3001` に変更
  - シードコマンドを `pnpm db:seed` → `pnpm e2e:seed` に変更
  - （CIではDBはサービスコンテナで作成済みのため `e2e:setup` は不要、migrate + seed のみ）
- コミットメッセージ: `ci: PlaywrightワークフローをE2Eテスト専用シード対応に更新`

## 検証手順

1. `.env.test.example` をコピーして `.env.test` を作成、接続情報を自環境に合わせる
2. `pnpm e2e:setup` を実行 → テストDBが作成され、シードが投入されること
3. `pnpm e2e` を実行 → 既存テストがテスト専用DBに対して実行されること
4. 開発サーバー(port 3000)を起動した状態で `pnpm e2e` を実行 → テストが port 3001 で独立実行されること
5. `pnpm e2e:ui` を実行 → UIモードが正常動作すること
6. `pnpm e2e:setup` を再実行 → 冪等に動作し、クリーンな状態に戻ること
