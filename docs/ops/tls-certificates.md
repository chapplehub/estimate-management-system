# TLS 証明書の運用

公開デモ環境（`chapple-esm.duckdns.org`）の Let's Encrypt 証明書に関する運用手順（Issue #779）。
構成の判断理由は [ADR-20260827-ff0](../adr/20260827-ff0-tls-renewal-decoupled-certbot-container-periodic-nginx-reload.md) を参照。

以降のコマンドは、EC2 上のリポジトリ直下（`compose.prod.yaml` と `.env.production` がある場所）で実行する前提。

## 1. 構成の概要

証明書の更新と反映は `compose.prod.yaml` の 2 サービスで完結し、ホスト側に certbot は存在しない。

| サービス | 役割 | 周期 |
| --- | --- | --- |
| `certbot` | `certbot renew` を実行し、更新された証明書を `/etc/letsencrypt` に書く | 12h |
| `nginx` | `nginx -s reload` で `/etc/letsencrypt` の証明書を読み直す | 6h |

両者は **`/etc/letsencrypt` のファイル共有だけで繋がる**。certbot は nginx を reload せず、nginx は certbot を待たない（`renew_hook` / `--deploy-hook` / docker socket は用いない）。

この疎結合の帰結として、**更新された証明書が nginx に反映されるまで最大 6 時間の遅れがある**。certbot は失効の 30 日前から更新を始めるため、この遅れは問題にならない。`certbot` のログに更新成功が出た直後に `openssl s_client` 等で見ても古い証明書が返るのは正常動作であり、障害ではない。

- 証明書の実体はホストの `/etc/letsencrypt`（bind mount）。`certbot` は読み書き、`nginx` は読み取り専用
- ACME チャレンジ（HTTP-01）の webroot はホストの `/var/www/certbot`。`nginx` の `app.conf` が `/.well-known/acme-challenge/` をここから配信する
- `/var/lib/letsencrypt`（certbot の作業領域）は named volume `certbot-work`。中身に引き継ぐ価値は無く、消しても支障はない

## 2. ホスト certbot からの移行（一回限り）

Issue #772 / #773 で構築したホスト側 certbot（apt 版 + `certbot.timer` + `renew_hook`）からの移行手順。
一度きりの作業だが、何を行ったかの証跡として残す。

> [!IMPORTANT]
> **順序が結果に効く。** `renew_hook` を残したままコンテナを起動すると、コンテナの初回 `renew` がフックの
> `docker exec ... nginx -s reload` を実行しようとし、コンテナ内に docker CLI が無いためフックだけが失敗する。
> 証明書の更新自体は成功するがログに ERROR が残り、切り分けを混乱させる。

```bash
# 1. ホスト側の自動更新を止める（二重更新の防止）
sudo systemctl disable --now certbot.timer
systemctl is-enabled certbot.timer   # disabled と出ること

# 2. renewal conf から renew_hook 行を削除する
sudo sed -i '/^renew_hook/d' /etc/letsencrypt/renewal/chapple-esm.duckdns.org.conf

# 3. webroot 方式のまま、パスがコンテナのマウント先と一致していることを確認する
grep -E '^(authenticator|webroot_path)' /etc/letsencrypt/renewal/chapple-esm.duckdns.org.conf
#   authenticator = webroot
#   webroot_path = /var/www/certbot,

# 4. ホスト側 certbot を削除する
#    purge ではなく remove。/etc/letsencrypt（証明書・アカウント・renewal conf）は残す
sudo apt remove certbot

# 5. コンテナを起動する（certbot サービスが追加された commit に checkout 済みであること）。
#    up -d を直接打たず、HEAD 由来のイメージタグで適用する（docs/ops/deploy.md 4.1）
scripts/deploy-apply.sh

# 6. 初回 renew の結果を確認する
docker compose -f compose.prod.yaml --env-file .env.production logs certbot
```

手順 6 で期待するログは次のいずれか。

- 期限まで 30 日以上ある場合: `Certificate not yet due for renewal` … `No renewals were attempted.`
- 30 日を切っていた場合: `Congratulations, all renewals succeeded`

`renew_hook` に関する ERROR が出た場合は手順 2 が漏れている。conf を修正すれば次回（12h 後）から正常化する。

## 3. 新規環境での初回発行（手動）

`certbot` サービスは `renew` しか行わないため、証明書が一枚も無い環境（EC2 の作り直し等）では**初回発行を手動で行う**。
スクリプト化はしない。デモ環境一台に対し、テストの無いシェルスクリプトを保守対象に加える方が高くつくため。
毎リリース走るデプロイは逆にスクリプト化し、CI の shellcheck で静的検査している。判断が分かれる理由は [deploy.md](deploy.md) 6.2 を参照。

前提: DNS が EC2 に向いており、80 番ポートがインターネットから到達可能であること。

```bash
# 1. app-ssl.conf を一時退避する（証明書が無いと nginx が起動できないため）
#    ※ 退避の手筋は prod-docker-local.md「注意点」と共通
mv docker/nginx/conf.d/app-ssl.conf /tmp/app-ssl.conf.bak

# 2. nginx を 80 番のみで起動する（app.conf の ACME location が応答する）
#    up -d nginx は依存先（db → migrate → app）も起動するため、イメージタグを HEAD から
#    導出してから打つ（docs/ops/deploy.md 6 章）
eval "$(scripts/deploy-env.sh)"
docker compose -f compose.prod.yaml --env-file .env.production up -d nginx

# 3. 証明書を発行する
#    --entrypoint certbot が必須。compose.prod.yaml で entrypoint を renew ループに
#    上書きしているため、これが無いと certonly 以下の引数が無視されてループが始まる
docker compose -f compose.prod.yaml --env-file .env.production run --rm \
  --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d chapple-esm.duckdns.org \
  --email <メールアドレス> --agree-tos --no-eff-email

# 4. app-ssl.conf を戻し、nginx に読み込ませる（6h の定期 reload を待たない）
mv /tmp/app-ssl.conf.bak docker/nginx/conf.d/app-ssl.conf
docker compose -f compose.prod.yaml --env-file .env.production exec nginx nginx -s reload

# 5. 残りのサービスを起動する（up -d を直接打たない。docs/ops/deploy.md 4.1）
scripts/deploy-apply.sh
```

発行後は `/etc/letsencrypt/renewal/chapple-esm.duckdns.org.conf` が自動生成され、以降の更新は `certbot` サービスが引き継ぐ。
`--email` に指定したアドレスは Let's Encrypt のアカウント連絡先になるが、**期限切れ通知には使われない**（後述）。

## 4. 更新失敗の確認

> [!WARNING]
> **Let's Encrypt は 2025 年 6 月に期限切れ通知メールを廃止した。** 更新が失敗し続けても、失効するまで
> 外から何も知らせてくれない。現状、更新失敗に気づく手段はログの能動確認だけである。
> 証明書期限の外形監視は [#780](https://github.com/chapplehub/estimate-management-system/issues/780) で別途設計する。

```bash
# certbot のログ（renew は 12h ごと。直近の実行結果を見る）
docker compose -f compose.prod.yaml --env-file .env.production logs --since 24h certbot

# 実際に配信されている証明書の期限（nginx の reload 済みかどうかはこちらで分かる）
echo | openssl s_client -connect chapple-esm.duckdns.org:443 -servername chapple-esm.duckdns.org 2>/dev/null \
  | openssl x509 -noout -dates
```

ログの読み方:

| 出力 | 意味 |
| --- | --- |
| `No renewals were attempted.` | 期限まで 30 日以上あり、更新対象が無い。**正常** |
| `Congratulations, all renewals succeeded` | 更新成功。最大 6h 後に nginx が反映する |
| `Failed to renew certificate` / `All renewals failed` | 更新失敗。12h 後に再試行される。原因は直前の行（ACME への到達性、webroot の書き込み・配信、レート制限など）を見る |

`docker compose ... logs` は `-f compose.prod.yaml` でプロジェクトを特定するため、コンテナ名（`estimate-management-system-prod-certbot-1`）に依存しない。
`docker logs <コンテナ名>` でも同じものが読めるが、プロジェクト名の変更で壊れる書き方なので手順書には使わない。

## 5. 手動で即時更新したいとき

期限が迫っている、あるいは更新失敗の原因を直したあとすぐに再試行したい場合。`renew` の周期（12h）を待つ必要は無い。

```bash
docker compose -f compose.prod.yaml --env-file .env.production run --rm --entrypoint certbot certbot renew
docker compose -f compose.prod.yaml --env-file .env.production exec nginx nginx -s reload
```

`--force-renewal` は付けない。Let's Encrypt のレート制限（同一証明書は週 5 回まで）を消費するため、期限内の証明書を無理に更新する理由が無い。
