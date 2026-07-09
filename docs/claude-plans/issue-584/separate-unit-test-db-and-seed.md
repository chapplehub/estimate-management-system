# Issue #584: 単体テスト用DB・seedの完全分離（e2e型の横展開） — 実装計画

## 概要

現状、単体テスト（vitest）は開発DB（`.env` の `DATABASE_URL`）を手動確認用 seed（`seed.ts`）と共有している。このため「手動確認用に seed をリッチにすると単体テストに影響しうる」という懸念があった。

実態調査の結果、単体テストが seed に要求しているのは**正準マスタ（`position` POS001-004 / `role` ROLE001-015 / `taxRate`）のみ**であり、シナリオデータ（部署・従業員・得意先・納品先・商品・価格）は各テストが `ensure*Fixtures` ヘルパーや予約コード帯で**自前生成**していることが判明した（seed のシナリオコードを前提読みするテストはゼロ）。

これを踏まえ、既に e2e で確立している「別 env・別 DB・別 seed・setup スクリプトで自動化」の型を単体テストへ横展開し、**単体テスト用 DB／seed と 開発用 DB／seed を完全分離**する。

- e2e（既存）: `.env.test` / e2e専用DB / `seed-e2e.ts` / `scripts/e2e-setup.ts`
- unit（新規）: `.env.unit` / 単体テスト専用DB（同一Postgres内・新規）/ `seed-unit.ts` / `scripts/unit-setup.ts`
- dev（改名）: `.env` / 開発DB / `seed-dev.ts`（現 `seed.ts`。手動確認用にリッチ化・自由拡張）

## 設計判断

### 単体テスト用 seed に含めるデータ範囲
- A. 現 `seed.ts` をそのまま流用する
- B. 正準マスタ（position / role / taxRate）のみに絞る
- **採用: B**。理由: テストが seed に依存するのは `@unique` 制約で test-local 生成できない正準マスタだけ（position は約26ファイル、role は約26ファイル、taxRate は約19ファイルが code 引きで前提読み）。シナリオデータは各テストが自前生成するため不要。unit seed を最小化することで、開発 seed の変更から構造的に独立させる。

### マスタ定義の重複回避（POSITIONS / TAX_RATES）
- A. seed-unit と seed-dev の2箇所に同一定義を重複させる
- B. 共有定数モジュールに切り出し両 seed が import する
- **採用: B（POSITIONS / TAX_RATES のみ）**。理由: これらは ADR-0063 の役職4段鎖・税率マスタで、ほぼ変化しない固定値。`prisma/seed-shared/masterData.ts` に配列だけ切り出して両 seed が参照する。「seed の合成」ではなく「定数の共有」であり、DB・seed 実行・シナリオデータは完全に別のまま、値のドリフト（ADR変更時の片側腐り）だけを防ぐ。

### ROLES の共有可否
- A. ROLES も共有定数に切り出す
- B. seed-unit / seed-dev が各自で保持する
- **採用: B**。理由: 開発 seed 側では今後シナリオ用に役割を増やす想定があり、共有すると単体テスト用の正準集合が揺れる。よって共有せず、`seed-unit.ts` は**テストが code 引きする ROLE001-015 を必ず含む**ことを契約とし、`seed-dev.ts` はそれを包含しつつ自由に拡張する。

### vitest の env 読み込み切り替え
- 現 `vitest.config.ts` は `config()`（`.env`）を読む。これを `config({ path: ".env.unit" })` に変更し、単体テスト専用 DB を向くようにする（e2e/playwright と同じ考え方）。

### `.env*` ファイルの取り扱い（作業分担）
- **前提: Claude は `.env` / `.env.test` / `.env.unit` / `.env.example` などの `.env*` ファイルを閲覧・編集できない（権限制約）。**
- したがって、`.env*` 本体の新規作成・編集は **Claude が中身（キー・値・コメント）を提示し、ユーザがファイルへ反映する**運用とする。Claude はファイルへ直接書き込まない。
- `.gitignore` / `scripts/unit-setup.ts` / `vitest.config.ts` / `package.json` などの通常ファイルは Claude が編集する（`.env*` 制約の対象外）。

## ステップ

### Step 1: 共有マスタ定数の切り出し
- 対象ファイル: `prisma/seed-shared/masterData.ts`（新規）、`prisma/seed.ts`
- 作業内容:
  - `seed.ts` から `POSITIONS` 配列・`TAX_RATES` 配列を `prisma/seed-shared/masterData.ts` へ移設し export
  - `seed.ts` は当該定数を import する形に置換（この時点では挙動不変・リグレッション回避）
- コミットメッセージ: `refactor: seedのPOSITIONS/TAX_RATESを共有定数へ切り出す`

### Step 2: 単体テスト用 seed の新規作成
- 対象ファイル: `prisma/seed-unit.ts`（新規）
- 作業内容:
  - 共有定数（POSITIONS / TAX_RATES）を import
  - ROLES（ROLE001-015・テストが code 引きする正準集合）を seed-unit 内に定義
  - `position` → `role` → `taxRate` の順で投入（FK 順序遵守）
  - `.env.unit` の `DATABASE_URL` を読むよう `config({ path })` を設定（seed-e2e.ts の env 読み込み方式に合わせる）
  - 冪等化（既存パターンに合わせ deleteMany → create、または upsert）
- コミットメッセージ: `feat: 単体テスト用の正準マスタseed（seed-unit）を追加する`

### Step 3: 開発用 seed への改名
- 対象ファイル: `prisma/seed.ts` → `prisma/seed-dev.ts`、`package.json`
- 作業内容:
  - `seed.ts` を `seed-dev.ts` へリネーム
  - `package.json` の `db:seed`（`tsx prisma/seed.ts`）と `prisma.seed` フックを `seed-dev.ts` に追随
- コミットメッセージ: `refactor: 開発確認用seedをseed-devへ改名する`

### Step 4: 単体テスト環境の env・setup スクリプト整備
- 対象ファイル: `scripts/unit-setup.ts`（新規・Claude作成）、`.gitignore`（Claude編集）／ `.env.unit.example`・`.env.unit`（**ユーザが作成**、Claudeは中身を提示）
- Claude が行う作業:
  - `scripts/e2e-setup.ts` を雛形に `scripts/unit-setup.ts` を作成（`.env.unit` 読み込み → DB作成 → `prisma migrate deploy` → `seed-unit.ts` 投入）
  - `.gitignore` に `.env.unit` を追加（`.env.test` と同様）
  - `.env.unit.example` と `.env.unit` に記載すべき内容（`DATABASE_URL` に単体テスト専用DB名。例: `ems_unit`）をユーザへ提示する
- ユーザが行う作業（`.env*` はClaude不可視のため）:
  - Claude提示の内容で `.env.unit.example`（コミット対象）を作成
  - 同内容で手元の `.env.unit`（gitignore対象・非コミット）を作成
- コミットメッセージ: `feat: 単体テスト用DBのセットアップスクリプトを追加する`
  - ※ `.env.unit.example` はユーザ作成のため、コミット時に含まれていれば一緒にコミットする（無ければ Claude作成分のみコミットし、example はユーザ側で別途追加）

### Step 5: vitest 設定と npm scripts の切り替え
- 対象ファイル: `vitest.config.ts`、`package.json`
- 作業内容:
  - `vitest.config.ts` の `config()` を `config({ path: ".env.unit" })` に変更
  - `package.json` に `test:setup`（`tsx scripts/unit-setup.ts`）を追加
  - `test` スクリプトを冪等な seed 前置き型に変更（e2e の `"e2e": "tsx prisma/seed-e2e.ts && playwright test"` と同型 = `"test": "tsx prisma/seed-unit.ts && vitest"`）
- コミットメッセージ: `feat: vitestを単体テスト専用DBに向け、test:setupを追加する`

### Step 6: 動作確認とドキュメント追随
- 対象ファイル: `CLAUDE.md`（Commands 節・Claude編集）／ `.env.example` 系の注記（必要なら**ユーザが編集**、Claudeは文面を提示）
- Claude が行う作業:
  - `pnpm test:setup` → `pnpm test` が新DBで通ることを確認（`.env.unit` はユーザ作成後に実施）
  - CLAUDE.md の Commands に単体テストDBの初期化手順（`pnpm test:setup`）を追記
  - `.env.example` 系へ注記が必要な場合は、その文面をユーザへ提示する
- ユーザが行う作業（`.env*` はClaude不可視のため）:
  - 手元に `.env.unit` を用意（Step 4 で提示済みの内容）
  - 必要に応じ Claude提示の文面で `.env.example` 系へ注記を追加
- コミットメッセージ: `docs: 単体テスト用DBの初期化手順をCLAUDEmdに追記する`
