# プロダクション構成のローカル検証

プロダクション用の Docker 構成を、EC2 へデプロイする前にローカルで一式検証する手順（Issue #758）。

構成ファイル:

- `Dockerfile` — `runner`（Next.js standalone）/ `migrate`（Prisma マイグレーション）の 2 ステージ
- `compose.prod.yaml` — db / migrate / seed / app / nginx
- `docker/nginx/` — リバースプロキシ設定

デプロイ先は本番ではなく**公開デモ環境**と定義している（[ADR-20260821-4f1](../adr/20260821-4f1-deploy-target-is-public-demo-reuse-dev-seed.md)）。実業務データを扱わず、ダミーデータ込みで動きを見せる場所であるため、初期データ投入には開発 seed（`prisma/seed-dev.ts`）をそのまま流用する。

## サービス構成

| サービス | 役割 | 起動タイミング |
| --- | --- | --- |
| `db` | PostgreSQL 16 | 常駐（`restart: unless-stopped`） |
| `migrate` | `prisma migrate deploy` | one-shot。db が healthy になってから走り、正常終了後に app が起動する |
| `seed` | 初期データ投入 | **`up -d` では走らない**（`profiles: ["seed"]`）。[demo-seed.md](demo-seed.md) 参照 |
| `app` | Next.js（standalone） | migrate が正常終了してから起動 |
| `nginx` | リバースプロキシ | 公開ポートは 80 / 443 のみ |

`seed` は専用イメージを持たず `migrate` イメージに相乗りしている（`command` を `tsx prisma/seed-dev.ts` に上書き）。

## 手順

### 1. env 準備

```bash
cp .env.production.example .env.production
```

`.env.production` は git 管理外。キー名は example を参照して値を埋める。
ローカル検証時は `APP_IMAGE` / `MIGRATE_IMAGE` にローカルビルドのタグを指定する。

### 2. イメージビルド

```bash
docker build --target runner -t ems-app:local .
docker build --target migrate -t ems-migrate:local .
```

### 3. 一式起動

db → migrate（one-shot）→ app → nginx の順に自動起動する。

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --wait
```

### 4. 動作確認

Nginx 経由でアクセスする。

- <http://localhost/api/health> が 200
- <http://localhost/signin> がログイン画面

この時点では DB が空。ログインするには [初期データ投入](demo-seed.md) が必要。

### 5. 片付け

```bash
docker compose -f compose.prod.yaml --env-file .env.production down -v
```

## 注意点

- **`--env-file` を必ず明示する**。省略すると dev 用の `.env` が読まれる
- dev 用 compose とはプロジェクト名・ボリュームが分離されており、同時起動できる（ポート衝突なし）
- **この構成はそのままではローカルで起動しない**。nginx が `/etc/letsencrypt/live/chapple-esm.duckdns.org/`
  の証明書を読むため、ホストに証明書がない環境では起動に失敗する。ローカルで検証する場合は
  `docker/nginx/conf.d/app-ssl.conf` を一時的に退避し、`app.conf` の `location /` を
  301 リダイレクトから `proxy_pass http://$upstream_app:3000;` に戻す（コミットはしない）
- 証明書はホスト側 certbot（webroot 方式）が発行し、nginx は read-only bind mount で参照する。
  更新は `certbot.timer` が自動実行し、deploy-hook でコンテナ nginx を reload する
- イメージは arm64 単一アーキテクチャでビルドする（[ADR-20260818-7pn](../adr/20260818-7pn-production-images-arm64-single-arch-bind-ec2-to-graviton.md)）
