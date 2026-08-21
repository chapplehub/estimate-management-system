# Issue #765: 本番DBの初期データ投入経路が無い（正準マスタ + 初期管理者ユーザー） — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

EC2 上のデプロイ先を「本番」ではなく**公開デモ環境**と定義し直し、初期データ投入に既存の開発 seed（`prisma/seed-dev.ts`）をそのまま流用する。

`seed-dev.ts` は Better Auth の `hashPassword` を直接使って Employee / User / Account を作れるため、Issue が挙げた「初期管理者を作る手段が無い（ニワトリと卵）」は元々存在しない。一方 `seed-dev.ts` は全テーブルを `deleteMany` する DB リセットスクリプトであるため、デプロイと分離した明示的な手動 one-shot として実行する。

実行アーティファクトは既存の `migrate` イメージに相乗りさせ、新規イメージ・新規タグ・新規 `*_IMAGE` 変数を作らない。新設する環境変数は seed の値ノブ 2 つのみ。

根拠と棄却した代替案は **ADR-20260821-4f1**（`docs/adr/20260821-4f1-deploy-target-is-public-demo-reuse-dev-seed.md`）に記録済み。

## 設計判断

会話で合意済み。#1・#2・#4・#5 は ADR-20260821-4f1 に記録、#3・#6〜#8 は各ステップのコミットボディに記載する。

### 1. デプロイ先環境の定義
- A. 実データを入れて運用する本番
- B. ダミーデータ込みで動きを見せる公開デモ環境
- **決定: B** — 学習目的のリポジトリであり実業務データを扱わない。この定義があって初めて「全消し再構築」と「ダミー 2000 従業員」が仕様として成立する

### 2. 初期データ投入の方式
- A. 本番専用 seed（`seed-prod.ts`）を新設し、正準マスタ + 初期管理者だけを upsert
- B. 開発 seed（`seed-dev.ts`）をそのまま流用
- **決定: B** — A の利点（ダミー混入の回避）は実業務データがある場合にのみ価値を持つ。4 系統目の seed を恒久保守するコストだけが残り、かつ空アプリはデモとして何も見せられない

### 3. 実行契機
- A. migrate と同じ one-shot に組み込み自動実行
- B. デプロイと分離した明示的な手動 one-shot（compose profile で `up -d` から除外）
- C. 条件付き自動（Employee が 0 件なら実行）
- **決定: B** — A はデプロイのたびに DB が全消しされる。C は判定が外れた瞬間に全消しが走り、かつ開発 seed に「本番かどうか」の挙動分岐を持ち込む。#761 / #762 と同じく「暗黙の副作用を明示操作に落とす」方向へ揃える

### 4. 実行アーティファクトの置き場
- A. `migrate` ステージに相乗り（compose 側で `command` を上書き）
- B. 専用 `seed` ステージ + 3 つ目の GHCR イメージ
- **決定: A** — `deps` が `--prod` なしで全依存を入れており、`migrate` は既に dev 依存込み 972MB の `node_modules`（`tsx` 含む）を持つ。追加は数 MB で、B は中身がほぼ同一のイメージ・タグ・env 変数を増やすだけ

### 5. デフォルトパスワードの扱い
- A. `pass123!` のまま（public リポジトリの平文がそのまま実環境の値）
- B. `SEED_DEFAULT_PASSWORD` 由来、未設定時は `pass123!`
- **決定: B** — 「デモだからパスワードは公開してよい」と「リポジトリに平文を焼き込む」は別。既定値を据え置くので開発環境は挙動不変

### 6. 従業員件数の扱い
- A. 2000 件固定
- B. `SEED_TOTAL_EMPLOYEES` 由来、未設定時 2000
- **決定: B** — EC2 のインスタンスサイズが未定（ADR-20260818-7pn は t4g 系としか拘束していない）。2000 件は 1 件ずつ `await` した `$transaction` で作られ所要時間が件数に線形なため、サイズ確定後に seed 本体を触らず調整できる余地を残す

### 7. `seed-dev.ts` への改造の線引き
- **挙動分岐は入れない / 値の外出しのみ許す** — 挙動分岐は開発 seed に「本番かどうか」という概念を持ち込むため汚染。既定値据え置きのノブは持ち込まない。改造は #5・#6 の 2 箇所に限定する

### 8. Prisma Client 生成物の持ち込み方
- A. `COPY --from=build /app/generated ./generated`
- B. `migrate` ステージ内で `prisma generate`（ダミー `DATABASE_URL` を `RUN` 内のみで渡す）
- **決定: B** — `Dockerfile:63-65` が示すとおり `migrate` が `deps` にしか依存しない独立性は意図的な設計。A は migrate イメージのビルドを `next build` の成否に結合させる

### 9. `COPY` の粒度
- A. `generateId.ts` / `auth/types.ts` をピンポイント指定
- B. `prisma/` と `src/` を丸ごと
- **決定: B** — tsx は実行時にモジュールを解決するため、A の漏れは `docker build` にも CI にも引っかからず、**EC2 上で seed を叩いた瞬間に `MODULE_NOT_FOUND`** で落ちる。サイズ論拠は `node_modules` 972MB の前では成立しない

### 10. seed 実行中の app の扱い
- A. app を動かしたまま叩く
- B. app を停止してから叩き、完了後に再開する
- **決定: B** — `deleteMany` は 1 トランザクションで包まれておらず、数分間 DB の中間状態が外から読める。停止すれば nginx が 502 を返すだけで状態が読みやすい

### 消滅した論点（Issue の未決事項のうち、決定ではなく問いごと消えたもの）
- **冪等性 / 再実行時の挙動 / 二重実行防止** — 毎回全消し再構築のため、何回叩いても同じ結果になる
- **初期管理者のニワトリと卵** — `seed-dev.ts:4` の `hashPassword` 直挿しで元々解決済み
- **初回ログイン後のパスワード変更強制** — 共有デモアカウントのため強制しない（誰かが変えると他の人が入れなくなる）

## ステップ

### Step 1: seed-dev.ts のデフォルトパスワードと従業員件数を env で上書き可能にする
- [x] **完了**
- 対象ファイル: `prisma/seed-dev.ts`
- テスト戦略: テスト不要（seed スクリプト）
- 作業内容:
  - `DEFAULT_PASSWORD` を `process.env.SEED_DEFAULT_PASSWORD ?? "pass123!"` に変更する
  - `TOTAL_EMPLOYEES` を `Number(process.env.SEED_TOTAL_EMPLOYEES) || 2000` に変更する
  - 既定値据え置きにより開発環境（`pnpm db:seed`）の挙動が変わらないことを確認する
  - 末尾のログインアカウント一覧出力（`seed-dev.ts:1225`）は `DEFAULT_PASSWORD` 参照のため自動的に正しい値を表示する。変更不要
  - 「挙動分岐は入れず値の外出しに限る」線引きをコメントとして残す
- コミットメッセージ: `chore: seed のデフォルトパスワードと従業員件数を env で上書き可能にする`

### Step 2: migrate ステージに seed 実行アーティファクトを載せる
- [x] **完了**
- 対象ファイル: `Dockerfile`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - `migrate` ステージの `COPY prisma/schema.prisma` / `COPY prisma/migrations` を `COPY prisma ./prisma` に置き換える
  - `COPY src ./src` を追加する（`seed-dev.ts` が参照する `generateId` / `auth/types` を含む。ピンポイント指定は実行時にしか壊れないため採らない）
  - ダミー `DATABASE_URL`（`.invalid` ホスト）を `RUN` 内のみで渡して `prisma generate` を実行し、`generated/prisma` をステージ内で生成する
  - `USER node` より前に生成を済ませる（生成物の所有者・権限に注意）
  - `CMD` は `prisma migrate deploy` のまま据え置く（seed は compose 側で `command` を上書きして呼ぶ）
- コミットメッセージ: `ci: migrate ステージに seed 実行アーティファクトを載せる`

### Step 3: compose.prod.yaml に profile 付き seed one-shot サービスを追加する
- [ ] **完了**
- 対象ファイル: `compose.prod.yaml`, `.env.production.example`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - `seed` サービスを追加する。`image` は `migrate` と同じ `${MIGRATE_IMAGE:-...}` を共有し、`command` を `["node_modules/.bin/tsx", "prisma/seed-dev.ts"]` で上書きする
  - `profiles: ["seed"]` を付け、`up -d` の対象から除外する
  - `restart: "no"`、`depends_on: db (service_healthy)` を設定する
  - `environment` に `DATABASE_URL` / `SEED_DEFAULT_PASSWORD` / `SEED_TOTAL_EMPLOYEES` を渡す
  - `MIGRATE_IMAGE` を共有する理由（新規イメージ・タグ・env 変数を作らない）と、変数名と実態のずれを許容した理由をコメントに残す
  - `.env.production.example` に `SEED_DEFAULT_PASSWORD` / `SEED_TOTAL_EMPLOYEES` を追記する（値は書かず、キー名と用途のみ）
- コミットメッセージ: `ci: 公開デモ向けの seed one-shot サービスを compose.prod.yaml に追加する`

### Step 4: 公開デモ環境の初期データ投入手順を CLAUDE.md に追記する
- [ ] **完了**
- 対象ファイル: `CLAUDE.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 「Production Docker（ローカル検証）」セクションに、デプロイ先が公開デモ環境である旨と ADR-20260821-4f1 への参照を追記する
  - 初期データ投入手順を追記する: `stop app` → `--profile seed run --rm seed` → `start app`
  - seed が破壊的（全テーブル削除後に再構築）であること、初回デプロイ後に叩き忘れると空アプリのままになることを明記する
  - `SEED_DEFAULT_PASSWORD` / `SEED_TOTAL_EMPLOYEES` の存在に触れる
- コミットメッセージ: `agent: 公開デモ環境の初期データ投入手順を CLAUDE.md に追記する`

### Step 5: ローカルで一式を検証する
- [ ] **完了**
- 対象ファイル: なし（検証のみ）
- テスト戦略: テスト不要（動作検証）
- 作業内容:
  - `docker build --target runner -t ems-app:local .` / `docker build --target migrate -t ems-migrate:local .` が通ること
  - `docker compose -f compose.prod.yaml --env-file .env.production up -d --wait` で db → migrate → app → nginx が起動すること
  - `up -d` の時点では seed が走らないこと（profile による除外の確認）
  - `stop app` → seed 実行 → `start app` の手順が通り、seed が正常終了すること
  - `SEED_TOTAL_EMPLOYEES` を小さい値（例 20）にして所要時間が短縮されること
  - `SEED_DEFAULT_PASSWORD` に指定した値でログインでき、`pass123!` では入れないこと
  - `http://localhost/signin` からログインし、一覧・見積が表示されること
  - seed を 2 回叩いても同じ結果になること（全消し再構築の確認）
  - `docker compose -f compose.prod.yaml --env-file .env.production down -v` で片付くこと
- コミットメッセージ: なし（検証のみ。問題が見つかった場合は該当 Step へ戻る）
