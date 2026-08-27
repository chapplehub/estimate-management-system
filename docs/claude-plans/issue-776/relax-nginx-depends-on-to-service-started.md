# Issue #776: nginx の depends_on を service_healthy から service_started に緩和する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。

## 概要

`compose.prod.yaml` の nginx サービスが `app: condition: service_healthy` に依存している。
この依存を `service_started` に緩和し、app の障害が nginx（TLS 終端・ACME 応答・301 リダイレクト）に
波及しないようにする。

変更は `compose.prod.yaml` の 1 行（condition）と、判断理由を残すコメントのみ。
アプリケーションコード・スキーマ・テストへの影響は無い。

## 前提の裏取り

計画時点で以下を実コードで確認した。

- `docker/nginx/conf.d/app-ssl.conf` の `location /` は
  `resolver 127.0.0.11 valid=10s` + `set $upstream_app app` + `proxy_pass http://$upstream_app:3000`
  という**変数経由 proxy_pass**（Issue #772 で導入済み）。名前解決はリクエスト時に遅延されるため、
  nginx の**起動**に app の存在も DNS 解決も不要
- したがって現在の `service_healthy` が実際に担保しているのは
  「初回 `up -d` 時、app が healthy になるまで 443 を開かない」ことだけである

## 設計判断

### 1. 依存を完全に外すか、`service_started` に緩めるか

- A. `depends_on` ごと削除する
- B. `condition: service_started` に緩める
- **決定: B** — 技術的必然性という観点では A で足りる。ただし `depends_on` は compose の
  起動ログ・`docker compose ps` の並び順を依存グラフ順に整える効果があり、
  db → migrate → app → nginx という読み順が保たれる実益がある。
  `service_started` はコンテナの起動のみを待ち healthcheck を見ないため、
  「app が healthy にならない障害で nginx が起動不能になる」という本 Issue の問題は解消される

### 2. 初回起動時に 502 を返す窓が生まれることの受容

app のコンテナ起動直後〜アプリ ready までの短時間、クライアントは接続拒否ではなく 502 を受け取る。
これを**望ましい退行**として受容する。理由:

- TLS 終端が生きるため、証明書エラーではなく HTTP レベルのエラーとして観測できる
- ACME チャレンジ（`/var/www/certbot` webroot）に応答できる。証明書更新が app の健全性に
  巻き込まれない
- アクセスログに証跡が残る。接続拒否は nginx 側に何も残さない

## 実装ステップ

- [x] **Step 1**: `compose.prod.yaml` の nginx `depends_on` を `service_started` に変更し、
      なぜ healthy を待たないのかを説明するコメントを付す
      - テスト戦略: **テスト不要** — compose の宣言的設定であり、単体テストの対象にならない
- [x] **Step 2**: `docker compose -f compose.prod.yaml config` で構文と解決結果を検証する
      - テスト戦略: **テスト不要**（検証のみ、コミット対象なし）

## 影響範囲

| 対象 | 影響 |
|------|------|
| `compose.prod.yaml` | nginx の `depends_on.app.condition` |
| アプリケーションコード | なし |
| Prisma スキーマ / マイグレーション | なし |
| 単体テスト / E2E | なし |
| CI ワークフロー | なし（`.github/workflows` は compose.prod.yaml の condition を参照していない） |
