# Issue #758: プロダクション用 Docker 構成（Dockerfile + compose.prod.yaml + Nginx）を作成する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

将来の EC2 デプロイ（学習 + 実運用準備）に向けて、プロダクション用の Docker 構成一式を作成する。
成果物はコアのみに絞る: **Dockerfile（マルチステージ）+ `compose.prod.yaml` + Nginx 設定 + `.env.production.example`**。
EC2 なしで、ローカル（WSL2）で「イメージビルド → migrate → app 起動 → Nginx 経由でアクセス」まで検証して閉じる。

/grill-me（2026-08-07）で合意した全体設計:

```
[EC2 (単一インスタンス)]
  Nginx コンテナ (80/443公開・SSL終端・certbot更新)
    ↓ 内部ネットワーク
  Next.js app コンテナ (standalone・非公開)
    ↑ migrate one-shot サービスが先行実行
    ↓
  PostgreSQL コンテナ (非公開・pgdataボリューム)

イメージ供給: git push → GitHub Actions build → GHCR → SSH して pull/up（後続イシュー）
```

## 設計判断

/grill-me で選択肢を比較して合意済み。詳細な比較は Issue #758 の「未決事項」に対応する。

### デプロイ全体像（本イシューの前提となる決定）
- DB 配置: RDS ではなく **EC2 内コンテナ**。`DATABASE_URL` を env 外出しし RDS 移行余地を残す（コスト最小・学習効果最大のため）
- ビルド経路: **GitHub Actions → GHCR → EC2 は pull のみ**（イミュータブルデプロイ。EC2 上ビルドは OOM リスクがあるため不採用）
- HTTPS: **Nginx + certbot**（設計ドキュメント Phase 2 構想どおり。学習価値を優先し Caddy 案を退けた）
- マイグレーション: **compose の one-shot サービス**。`depends_on: condition: service_completed_successfully` で app 起動前に自動適用（entrypoint 実行案・手動 SSH 案を退けた）
- シークレット: **EC2 上の `.env` ファイル手動配置**（chmod 600・git 管理外）。リポジトリには `.env.production.example` でキー名のみ文書化
- デプロイトリガー: **手動 SSH + デプロイスクリプト**（スクリプト自体は後続イシュー）
- バックアップ: **段階導入**。本イシューでは作らない。S3 退避 + IAM は後続イシュー。本番トラフィックを受ける前に必須
- ドメイン: **未取得**。certbot の実有効化はドメイン取得後（後続）。本イシューでは設定雛形まで

### 本イシュー内の実装方針
- ベースイメージ: `node:24-slim` 系（`.nvmrc` = 24.18.1 に合わせてピン留め。Renovate 更新対象）
- Prisma は Rust エンジンレス構成（`provider = "prisma-client"` + `engineType = "client"` + `@prisma/adapter-pg`）のため slim イメージで OpenSSL 問題を踏まない
- `next.config.ts` に `output: "standalone"` を追加（Vercel は本設定を無視するため現行デプロイに影響なし）
- compose は **`compose.prod.yaml` として独立ファイル**（overlay にしない。dev 版と差分が大きく継承関係は事故のもと）
- 本番 compose では **DB ポートを publish しない**（公開は Nginx の 80/443 のみ）
- migrate one-shot 用に Dockerfile へ **Prisma CLI を含む専用ステージ**を設ける（standalone ランタイムには CLI が入らないため）
- app のヘルスチェック用に `/api/health` ルートを追加（Next.js に既定のヘルスエンドポイントがないため）
- イメージタグ: git SHA + `latest` の二重タグ（ロールバックは SHA 指定で pull し直すだけにする）

### 後続イシュー候補（本イシューのスコープ外・積み残しの記録）
1. ドメイン取得 + DNS 設定（EC2 構築の前提）
2. GitHub Actions の build & push ワークフロー（GHCR）
3. deploy.sh / backup.sh（pg_dump 世代管理）
4. EC2 構築手順書（AWS アカウント〜初回デプロイ。実機検証しながら書く）
5. バックアップの S3 退避 + IAM ロール
6. （将来の選択肢）RDS 移行、Actions からの自動デプロイ

## ステップ

### Step 1: standalone 出力とヘルスチェックエンドポイントの追加
- [x] **完了**
- 対象ファイル: `next.config.ts`, `src/app/api/health/route.ts`
- テスト戦略: テスト不要（設定変更 + ロジックを持たない固定応答。Step 5 の compose healthcheck 実機検証でカバー）
- 作業内容:
  - `next.config.ts` に `output: "standalone"` を追加
  - `/api/health` ルートを追加（200 + 軽量 JSON を返すのみ。DB 接続チェックは含めない）
- コミットメッセージ: `chore: next build を standalone 出力に切り替え、/api/health を追加`

### Step 2: Dockerfile と .dockerignore の作成
- [x] **完了**
- 対象ファイル: `Dockerfile`, `.dockerignore`
- テスト戦略: テスト不要（設定ファイル。`docker build` の成功とイメージサイズ確認で検証）
- 作業内容:
  - マルチステージ構成: deps（pnpm install）→ build（prisma generate + next build）→ runner（standalone 成果物のみ、非 root ユーザー）
  - migrate ステージ: Prisma CLI + `prisma/schema.prisma` + `prisma/migrations/` を含む one-shot 用イメージ
  - ベースは `node:24.18.1-slim`（`.nvmrc` と一致させる）
  - ビルド時に DB 接続しないことを確認（CI ビルドの前提。ビルド時秘密情報も焼き込まない）
- コミットメッセージ: `chore: プロダクション用 Dockerfile を追加（standalone + migrate ステージ）`

### Step 3: compose.prod.yaml と .env.production.example の作成
- [x] **完了**
- 対象ファイル: `compose.prod.yaml`, `.env.production.example`
- テスト戦略: テスト不要（設定ファイル。Step 5 で実機検証）
- 作業内容:
  - サービス: `db`（ポート非公開・pgdata ボリューム・healthcheck）/ `migrate`（one-shot、db healthy 後に実行）/ `app`（migrate 完了後に起動、`/api/health` の healthcheck、ポート非公開）
  - `restart: unless-stopped` を常駐サービスに設定
  - イメージ参照は GHCR の名前をデフォルトにしつつ、ローカル検証では build で代替できる形にする
  - `.env.production.example` に必要な環境変数のキー名を列挙（DATABASE_URL、better-auth 関連など。値は書かない）
  - プロジェクト名は dev 用 compose（`estimate-management-system`）と衝突しない名前にする
- コミットメッセージ: `chore: プロダクション用 compose.prod.yaml と .env.production.example を追加`

### Step 4: Nginx 設定と nginx サービスの追加
- [x] **完了**
- 対象ファイル: `docker/nginx/`（設定ファイル一式）, `compose.prod.yaml`
- テスト戦略: テスト不要（設定ファイル。Step 5 で実機検証）
- 作業内容:
  - Nginx リバースプロキシ設定（app へのプロキシ、セキュリティヘッダー）
  - HTTP（80）でローカル検証可能な構成にし、HTTPS/certbot はドメイン取得後に有効化できる雛形（コメントアウト or 分離ファイル）として同梱
  - compose に `nginx` サービスを追加（80/443 のみ publish）
- コミットメッセージ: `chore: Nginx リバースプロキシ設定と nginx サービスを追加`

### Step 5: ローカル一式起動検証と起動手順のドキュメント化
- [x] **完了**
- 対象ファイル: `CLAUDE.md` または `README.md`（起動手順追記）, 検証で発覚した修正
- テスト戦略: テスト不要（実機検証そのもの + ドキュメント）
- 作業内容:
  - ローカルで `docker build` → `compose.prod.yaml` 一式起動 → migrate 成功 → Nginx（HTTP）経由でログイン画面表示まで確認
  - dev 用 compose（5432 公開）と同時起動した場合の挙動を確認（ポート衝突しないこと）
  - プロダクション構成のローカル検証手順を文書化
- コミットメッセージ: `docs: プロダクション Docker 構成のローカル検証手順を追記`
