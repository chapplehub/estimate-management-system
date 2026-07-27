# Issue #643: CI に lint / 型チェック / ユニットテスト / build を追加する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`.github/workflows/ci.yml` を新設し、PR ごとに `pnpm lint` / `tsc --noEmit` / `pnpm build` / vitest フルスイート（DB 統合テスト含む）を実行する。ジョブは DB 不要の `static`（lint / typecheck / build）と postgres サービスコンテナを持つ `test`（vitest）の 2 並列。既存の `playwright.yml` には手を入れない。

`static` ジョブの build は **DB 非到達環境**で実行する。これは #647 がイシューコメントで申し送った ADR-20260727-2fb の担保の本体であり、「DB 無しでビルドが通ること」自体が「認証配下ページの静的化が再発していないこと」の回帰テストになる（`next build` は静的判定したページの Server Component をビルド時に実行するため、静的化が再発すればビルド時に DB クエリが走って失敗する）。

ワークフローが Renovate の実物 PR で動くことを確認した後、両 ruleset（`protect-develop` / `protect-main`）に required status checks（`static` / `test`）を追加する。

設計の詳細な経緯は `learning/next-build-executes-pages-db-unreachable-build-as-regression-test.md` を参照。

## 設計判断

`/grill-with-docs` で確定済み。新規 ADR は起票しない（決定はいずれも可逆で、DB 非到達 build の設計は ADR-20260727-2fb に、CI を Renovate の防壁とする位置づけは ADR-20260726-d3b に記録済み。今回の判断は YAML コメントとコミットボディで記録する）。

### build の DATABASE_URL（イシュー案からの変更 1）
- A. `localhost:5432/dummy`（イシュー本文の案）
- B. `.invalid` ホストの到達不能ダミー
- **選択: B**（`postgresql://build:build@db-unreachable.invalid:5432/build_check`）。`.invalid` は RFC 2606 で解決されないことが保証され、「偶然の到達不能」ではなく「宣言された到達不能」になる。localhost は将来 static ジョブに postgres service を足す事故で担保が無言で消える。未定義にしないのは、`src/server/prisma.ts` がモジュール評価時（Collecting page data フェーズ、動的ページも通る）に `new PrismaPg()` を実行し、未定義時の挙動が `@prisma/adapter-pg` / `pg` のバージョン依存になるため（Renovate が更新するライブラリの未文書化挙動に検査機構が依存する循環を避ける）。「ビルド赤 ⇔ ビルド中にクエリ実行 ⇔ 静的化再発」の一意な対応を固定する。
- ジョブ定義に「なぜ DB を与えないか」「`getaddrinfo ENOTFOUND db-unreachable.invalid` が出たら `(features)` 配下の静的化再発を疑え」の意図コメントを残す（#647 コメントの依頼）。
- **「DB 非到達で build が通ること」を本 issue の受け入れ条件に昇格させる。**

### Node バージョン（イシュー案 A の修正 = 変更 2）
- A. イシュー案どおり新ワークフローも 24.15.0 をハードコード
- B. 新ワークフローは 22.14.0 をハードコード（playwright.yml の 24.15.0 は据え置き）
- **選択: B**。24.15.0 ピンの根拠は Playwright 固有のバグ（24.16.0 で archive 展開がハング）であり、E2E 以外の workload には適用されない。tsc / vitest / build が「既知良好」なのはローカル pre-push（22.14.0）で毎日実証されている 22 系のほうで、`engines.node ^22` の宣言とも一致する（#641 が問題視する「CI が環境を代表していない」状態を新設ジョブへ拡大しない）。ハードコード箇所には #641（Node 統一の既存 issue・OPEN）への参照コメントを残す。#641 がどちらに決着しても ci.yml は 1 行変更で追随できる。

### build の BETTER_AUTH_*（イシュー案からの変更 3）
- A. イシュー案どおり「実装時に env なしで試し、落ちたら足す」
- B. 最初からダミーを決め打ちで与える
- **選択: B**（`BETTER_AUTH_SECRET: build-time-placeholder` / `BETTER_AUTH_URL: http://localhost:3000`）。`src/server/shared/auth/better-auth/auth.ts` は `betterAuth()` をモジュールスコープで実行し、secret 不在時の挙動（警告か throw か）は better-auth の内部ポリシーでバージョン依存。better-auth 自体が Renovate 更新対象のため、env なし運用は依存更新 PR 上で「更新がビルドを壊した」ように見える偽陽性を生みうる。DATABASE_URL を未定義にしない判断と同型。

### test ジョブの DB 名（イシュー案からの変更 4）
- A. イシュー案どおり `unit_db`（ジョブ env が dotenv の非上書き既定で `.env.unit` に勝つことに依存）
- B. `estimate_management_unit` に統一（サービスコンテナ `POSTGRES_DB`・ジョブ env・`.env.unit.example` の三者一致）
- **選択: B**。接続先候補が 1 つになれば dotenv の優先順位の勝敗が無意味になり、「上書きしない」既定（dotenv も Renovate 更新対象）への依存が消える。イシューが予定していた「意図的にテーブルを落として接続先を確認する」検証は、確認すべき曖昧さごと不要になる。ローカル `test:setup` が作る DB 名とも一致する。
- ジョブ env の `DATABASE_URL` は残す（`prisma migrate deploy` は `prisma.config.ts` 経由で `.env` しか読まず、ジョブ env が無いと migrate だけ接続先を失う）。`cp .env.unit.example .env.unit` は必要（`seed-unit.ts` / `vitest.config.ts` がファイルの存在を要求する）。

### Required status checks
- **両 ruleset（`protect-develop` / `protect-main`）に `static` / `test` の 2 つのみ**を追加する。このリポジトリの保護は classic branch protection ではなく ruleset 運用。
- ジョブ名は `static` / `test` の 2 語をそのまま表示名に使う（required check はジョブ表示名の文字列一致で照合されるため、リネーム = 保護が外れる識別子として扱う。説明は step 名に任せる）。
- `e2e report` は必須にしない。playwright.yml に path filters が残っており、必須化すると docs のみの PR が「Expected — Waiting for status」のままマージ不能になる。必須化の要否は automerge（ADR-20260726-d3b §保留事項 3）解禁の検討時に「E2E の paths を外すか」とセットで判断する。

### ロールアウト順序
- **ci.yml マージ → Renovate 実物 PR で全ジョブ実行を確認（Dependency Dashboard の rebase で `synchronize` を発生させる）→ 両 ruleset に required checks 追加**。
- 必須化を最後に置く理由: 未検証のチェックを必須にすると不備があったとき全 PR のマージが止まり、修正 PR 自身も縛られる。また ruleset 変更は即座に open な全 PR へ適用されるため、影響を認識した上でタイミングを選ぶ。

### イシュー推奨をそのまま採用した判断
- path filters は付けない（required check と相性が悪く、Renovate PR を確実に検査する要件と衝突）
- `format:check` は入れない（Renovate の書き出す package.json / pnpm-lock.yaml が Prettier と食い違うリスク）
- E2E ワークフローとは統合しない / commitlint は CI に入れない（スコープ外）
- `concurrency` は #653 の申し送りどおり playwright.yml と同じ 2 行（`group: ${{ github.workflow }}-${{ github.ref }}` / `cancel-in-progress: true`）を直書き
- timeout は static 15 分 / test 20 分

## ステップ

### Step 1: `.github/workflows/ci.yml` を新設し static ジョブを追加する
- [x] **完了**
- 対象ファイル: `.github/workflows/ci.yml`（新規）
- テスト戦略: テスト不要（設定ファイル。検証は CI の実 run で行う）
- 作業内容:
  - トリガーは `workflow_dispatch` + `pull_request`（branches: [main, develop]）。path filters は付けない
  - `concurrency` を playwright.yml と同じ 2 行で直書きする
  - `static` ジョブ（表示名も `static`）: checkout → pnpm/action-setup@v4 → setup-node@v5（`node-version: 22.14.0` + #641 参照コメント）→ `pnpm install --frozen-lockfile` → `pnpm db:generate` → `pnpm lint` → `pnpm tsc --noEmit` → `pnpm build`
  - env はダミー決め打ち: `DATABASE_URL: postgresql://build:build@db-unreachable.invalid:5432/build_check` / `BETTER_AUTH_SECRET: build-time-placeholder` / `BETTER_AUTH_URL: http://localhost:3000`
  - 「なぜ DB を与えないか（ADR-20260727-2fb の担保・ビルド赤 = 静的化再発）」「BETTER_AUTH をなぜ決め打ちするか」の意図コメントを YAML に残す
  - `timeout-minutes: 15`
- コミットメッセージ: `ci: lint / 型チェック / DB 非到達 build を PR ごとに実行する static ジョブを追加する`
  - ボディに記載する設計判断: `.invalid` ダミーの理由（宣言された到達不能・未定義はライブラリ依存）、Node 22.14.0 の理由（この workload の既知良好版・engines ^22 と一致・#641 参照）、BETTER_AUTH 決め打ちの理由

### Step 2: ci.yml に test ジョブ（vitest フルスイート）を追加する
- [ ] **完了**
- 対象ファイル: `.github/workflows/ci.yml`
- テスト戦略: テスト不要（設定ファイル。検証は CI の実 run で行う）
- 作業内容:
  - `test` ジョブ（表示名も `test`）: postgres:16 サービスコンテナ（`POSTGRES_DB: estimate_management_unit`、playwright.yml と同じ health check・`-U postgres` 明示）
  - ジョブ env: `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/estimate_management_unit`（`.env.unit.example` と完全一致させる理由をコメントで残す）/ `BETTER_AUTH_SECRET: test-secret-for-ci-only` / `BETTER_AUTH_URL: http://localhost:3000`
  - steps: checkout → pnpm → setup-node（22.14.0）→ install → `cp .env.unit.example .env.unit`（seed-unit.ts / vitest.config.ts が存在を要求するため）→ `pnpm db:generate` → `pnpm exec prisma migrate deploy` → `pnpm exec tsx prisma/seed-unit.ts` → `pnpm exec vitest run`
  - `timeout-minutes: 20`
- コミットメッセージ: `ci: vitest フルスイートを PR ごとに実行する test ジョブを追加する`
  - ボディに記載する設計判断: DB 名を `.env.unit.example` と一致させ dotenv の優先順位依存を消したこと（イシューが予定した「テーブルを落として接続先を確認」の検証を不要化）

### Step 3: PR を作成し、この PR 自身で static / test の実 run を確認する
- [ ] **完了**
- 対象ファイル: なし（必要に応じて `.github/workflows/ci.yml` の修正）
- テスト戦略: テスト不要（実測確認）
- 作業内容:
  - PR 上で `static` / `test` の両ジョブが緑で完走することを確認する
  - `static` の build ログで、DB 接続エラーが発生していない（= 静的化が起きていない）ことを確認する
  - 既存の `Playwright Tests` ワークフローと concurrency グループが分かれて共存していることを確認する
  - 計画から逸脱した対応があれば `docs/claude-plans/issue-643/deviations.md` に記録する
- コミットメッセージ: 修正が発生した場合のみ（内容に応じて `ci:`）

### Step 4: マージ後、Renovate の実物 PR で全ジョブ実行を確認する
- [ ] **完了**
- 対象ファイル: なし
- テスト戦略: テスト不要（実測確認）
- 作業内容:
  - Dependency Dashboard の rebase チェックボックスで既存の Renovate PR に `synchronize` イベントを発生させる
  - Renovate PR 上で `static` / `test` が実行され結果が出ることを確認する（受け入れ条件「renovate/types など実物で全ジョブが実行されること」）

### Step 5: 両 ruleset に required status checks を追加する
- [ ] **完了**
- 対象ファイル: なし（GitHub リポジトリ設定。`gh api` で実施）
- テスト戦略: テスト不要（リポジトリ設定）
- 作業内容:
  - `protect-develop`（id: 12978563）と `protect-main`（id: 12978605）の両 ruleset に `required_status_checks` rule を追加し、`static` / `test` を指定する
  - **実行前にユーザーへ最終確認を取る**（即座に open な全 PR へ適用されるため）
  - 追加後、適当な PR で「checks 待ちでマージがブロックされる」ことを確認する

## 受け入れ条件

- [ ] PR に対して `pnpm lint` が実行される
- [ ] PR に対して `tsc --noEmit` が実行される
- [ ] PR に対して Vitest のフルスイート（DB 統合テスト含む）が実行される
- [ ] PR に対して `pnpm build` が実行される
- [ ] **build は DB 非到達環境（`.invalid` ダミー）で実行され、それで通ること**（ADR-20260727-2fb の担保・#647 申し送りの履行）
- [ ] 上記が失敗したときに PR がマージできない（両 ruleset の required status checks）
- [ ] Renovate の実物 PR で全ジョブが実行されることを確認した

## スコープ外（イシュー本文どおり + 本計画で追加）

- Node バージョンの単一ソース化 → **#641（起票済み・OPEN）**
- `e2e report` の必須化 → automerge（ADR-20260726-d3b §保留事項 3）検討時に playwright.yml の paths とセットで判断
- `pnpm install --prod` 検証 / commitlint の CI 実行 / カバレッジ計測 / E2E webServer の production build 化
