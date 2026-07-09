# Issue #585: e2e用envファイルを .env.test → .env.e2e に改名し env命名を統一する — 実装計画

## 概要

e2e テスト用の env ファイル `.env.test` / `.env.test.example` を `.env.e2e` / `.env.e2e.example` に改名し、env ファイル命名を用途ベースで統一する（`.env`=開発 / `.env.unit`=単体 / `.env.e2e`=e2e）。

前提として #584（単体テスト専用DB・`.env.unit`）は既に develop に取り込み済み。そのため本 issue 完了時点で `.env` / `.env.unit` / `.env.e2e` の完全対称な命名体系となる。`.env.test` の "test" が単体/e2e どちらを指すか曖昧という課題が、隣に `.env.unit` が並ぶ現状で際立っており、リネームの動機は強い。

CI（`.github/workflows/playwright.yml`）は `DATABASE_URL` を直接設定しており `.env.test` を参照していないため、本改名による CI 影響はない（確認済み）。

## 設計判断

### スコープ境界
- 585 は e2e env のリネームに厳密に限定する。`.env.unit` の導入は #584（取り込み済み）の責務。
- 判断不要（会話で合意済み・境界確定）。

### ADR-0012 の扱い
- A. 新規ADRを起票する
- B. ADR-0012 を現地編集する
- 選択: **B**。理由: 決定の本体（テンプレート方式・port分離・外部スクリプト）は不変で、変わるのは env ファイル名のみ。リネームは後戻り容易でトレードオフの再判断ではないため、ADR起票の3条件（後戻り困難・文脈なしに驚く・実質的トレードオフ）を満たさない。ADR-0012 内の該当語を `.env.e2e` / `.env.e2e.example` に置換し、最終更新日を更新、影響セクションにリネームの一文を追記する。

### 既存開発者の移行方式
- A. コード側に旧 `.env.test` へのフォールバックを入れる
- B. フォールバックなし。案内はエラーメッセージ更新とPR本文の移行手順で行う
- 選択: **B**。理由: 互換コードは「曖昧さ解消」という目的に逆行し負債化する。`.env.test` は gitignore 対象で各自ローカルのため、潔く切り替え `mv .env.test .env.e2e` を PR本文で案内すれば十分。

### 対象外の判断
- `learning/` 配下の env メモ2件は Next.js 一般規約（`.env.local` 等）の学習ノートで `.env.test` を名指ししないため対象外。
- `docs/claude-plans/` 配下の過去プラン文書は時点の記録のため据え置き。
- CONTEXT.md は env 命名がインフラ・ツーリングでありドメイン用語ではないため対象外。

## ステップ

### Step 1: env テンプレートファイルと .gitignore のリネーム
- 対象ファイル: `.env.test.example`（→ `.env.e2e.example`）、`.gitignore`
- 作業内容:
  - `git mv .env.test.example .env.e2e.example`
  - `.gitignore:36` の `!.env.test.example` を `!.env.e2e.example` に変更
  - ローカル `.env.test` → `.env.e2e`（非コミット。手元検証用に自worktree分を実施）
- コミットメッセージ: `refactor: e2e用env テンプレートを .env.e2e.example に改名`

### Step 2: コード・設定の参照追随
- 対象ファイル: `playwright.config.ts`、`scripts/e2e-setup.ts`、`prisma/seed-e2e.ts`、`prisma/seed-estimates.ts`、`scripts/unit-setup.ts`
- 作業内容:
  - `playwright.config.ts:9` dotenv パスを `.env.e2e` に変更
  - `scripts/e2e-setup.ts:15,18,20,28` パス定義とエラーメッセージ（`cp .env.e2e.example .env.e2e` 案内含む）を更新
  - `prisma/seed-e2e.ts:17` config パスを `.env.e2e` に変更
  - `prisma/seed-estimates.ts:6` コメント `e2e=.env.test` → `e2e=.env.e2e`
  - `scripts/unit-setup.ts:10` コメント内の e2e 参照名を追随
- コミットメッセージ: `refactor: e2e env の参照を .env.e2e に追随`

### Step 3: ADR-0012 の現地編集
- 対象ファイル: `docs/adr/0012-e2e-test-db-separation-strategy.md`
- 作業内容:
  - 判断2の見出し・本文、決定、根拠、影響（41,45,71,76,82,84行付近）の `.env.test` / `.env.test.example` / `cp .env.test.example .env.test` を `.env.e2e` 系に置換
  - 最終更新日を 2026-07-09 に更新
  - 影響セクションに「#585 で `.env.test` → `.env.e2e` にリネーム（"test" が単体/e2e で曖昧になるのを回避）」の一文を追記
- コミットメッセージ: `docs: ADR-0012 を .env.e2e リネームに追随`

### Step 4: 疎通検証
- 対象ファイル: （検証のみ）
- 作業内容:
  - `.env.e2e` へのリネーム後、`pnpm e2e:setup` / `pnpm e2e:seed` の疎通を確認しリネーム漏れを検出
  - E2E テスト本体の全実行はCIに委ねる
- コミットメッセージ: （検証のみ・コミットなし）
