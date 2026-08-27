# Issue #779: certbot をコンテナ化し、証明書更新を Docker Compose に完結させる — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。

## 概要

現在の本番（公開デモ）環境は、certbot がホスト側（apt 版 2.9.0 + `certbot.timer`）、nginx がコンテナ側という分離構成で、renewal conf の `renew_hook` が自動生成コンテナ名 `estimate-management-system-prod-nginx-1` を直接参照して reload している。

これを `compose.prod.yaml` 内で完結する構成へ移行する。方式は [wmnnd/nginx-certbot](https://github.com/wmnnd/nginx-certbot) 準拠の疎結合（ADR-20260827-ff0）:

- certbot コンテナ: `certbot renew` → 12h sleep のループ
- nginx コンテナ: 6h ごとの `nginx -s reload` ループを `command` に追加
- 両者は `/etc/letsencrypt` のファイル共有だけで繋がり、`renew_hook` / `--deploy-hook` / docker socket は用いない

変更対象は `compose.prod.yaml`・`docker/nginx/conf.d/app-ssl.conf` のヘッダコメント・運用ドキュメント・ADR のみ。アプリケーションコード・スキーマ・テスト・CI ワークフローへの影響は無い。

## 前提の裏取り

計画時点で以下を実測・確認した（詳細は ADR-20260827-ff0「コンテキスト」節）。

- `certbot/certbot:v5.7.0` の無印タグは amd64 / arm64 / arm32v6 のマルチアーチマニフェスト（Docker Hub API で確認）。ADR-20260818-7pn の Graviton 前提でもアーキ別タグは不要
- 同イメージは `ENTRYPOINT ["certbot"]`、`VOLUME /etc/letsencrypt /var/lib/letsencrypt` を宣言（`docker image inspect` で確認）。ループを書くには `command` ではなく **`entrypoint` を上書き**する必要があり、`/var/lib/letsencrypt` を明示マウントしないと匿名ボリュームが増殖する
- `nginx:1.28.0-alpine` の `/docker-entrypoint.sh` は `$1 = nginx` のときだけ `/docker-entrypoint.d/` を実行する。`command` を `/bin/sh -c` に差し替えると 4 本のスクリプトが走らなくなるが、現構成ではすべて no-op（`default.conf` 不在・templates 不使用・autotune 未設定・resolver 直書き）
- 原典どおりの `command` でも busybox ash の末尾 exec 最適化により PID 1 は nginx になり、`docker stop` は約 0.4 秒で graceful 終了（実測）。実装では実装依存を消すため `exec` を明示する
- Renovate は `docker-compose` マネージャで `compose.prod.yaml` を検出済み（Dashboard #639）。certbot イメージを足せば追加設定なしで管理下に入る
- Let's Encrypt は 2025 年 6 月に期限切れ通知メールを廃止済み。更新失敗に受動的に気づく手段は無い

## 設計判断

いずれも `/grill-with-docs` セッションで合意済み。

### 1. 更新→反映の結合方式
- A. 定期 reload による疎結合（wmnnd/nginx-certbot 準拠）
- B. certbot から docker socket 経由で nginx を reload（deploy-hook 維持）
- C. certbot は one-shot、起動はホストの systemd timer
- **決定: A** — B は socket マウントが実質 root 権限でありコンテナ名依存も残る。C はホスト依存が残る。反映遅延は certbot の 30 日マージンで吸収される。→ **ADR-20260827-ff0**

### 2. nginx の reload 周期
- Issue 提案の 36h / 原典の 6h
- **決定: 6h** — reload は接続を切らず周期を伸ばして得るものが無い。独自値は説明責任を恒常的に生むため原典の値を採る

### 3. nginx の `command` 上書き
- A. `command` を上書きし entrypoint.d スキップをコメントで明記
- B. 専用 Dockerfile で `/docker-entrypoint.d/` にループ起動スクリプトを置く
- C. reload ループを別コンテナに出し `pid: "service:nginx"` で SIGHUP
- **決定: A** — 4 本すべて現構成で no-op を確認済み。B は nginx 用イメージの build / GHCR push が新たに要り、起きていない問題に恒常コストを払う。末尾は `exec nginx -g "daemon off;"` と明示する

### 4. 永続化先
- `/etc/letsencrypt`: ホスト bind mount 維持（certbot 側 rw） / named volume へ移す
- `/var/lib/letsencrypt`: named volume / 匿名ボリューム放置 / ホスト bind mount
- **決定: `/etc/letsencrypt` は bind mount 維持、`/var/lib/letsencrypt` は named volume（`certbot-work`）** — 前者は既存資産を移動せず引き継げ nginx と対称。後者は匿名ボリューム増殖の防止のみが目的

### 5. 初回発行（新規環境）の扱い
- A. スコープ外 / B. 手動手順としてドキュメント化 / C. 原典の `init-letsencrypt.sh` 相当を同梱
- **決定: B** — A では「compose 完結」の看板に対し既存 EC2 にしか適用できず復旧経路も無い。C はデモ環境一台に対し過剰で、テストの無いシェルスクリプトを保守対象に加える。`app-ssl.conf` 一時退避の手筋は `prod-docker-local.md` に既存

### 6. 運用手順の置き場所
- A. `docs/ops/tls-certificates.md` 新設 / B. README / C. `prod-docker-local.md` に追記
- **決定: A** — README には本番運用の記述が無く、`docs/ops/` に前例（`demo-seed.md`）がある。CLAUDE.md のポインタ運用に沿う。README は触らない

### 7. 更新失敗の検知
- A. `docker logs certbot` の記載のみ / B. 外形監視をスコープに含める / C. certbot に healthcheck
- **決定: A + 外形監視は別イシュー起票** — C は sleep ループの生死しか見えず偽装になる。B はコンテナ化と独立した設計（ツール選定・通知先・死活監視との統合）であり分割する

### 8. ホスト側移行の順序
- **決定: timer 停止 → `renew_hook` 削除 → `apt remove` → コンテナ起動** — 逆順だと `renew_hook` が残ったままコンテナの初回 `renew` が走り、コンテナ内に docker CLI が無いためフックだけが失敗する

### 9. `depends_on` とローカル検証
- **決定: `certbot` → `nginx` を `service_started` で宣言。ローカルでも certbot はそのまま起動（profiles に入れない）** — 前者は既存 `nginx` → `app` と同じ「起動ログが依存順に並ぶ」理由。後者は EC2 側の `up -d` に恒常的な `--profile` を増やさないため

### 10. ADR / CONTEXT.md
- **決定: ADR は判断 1 のみ起票（済）。`CONTEXT.md` は更新しない** — certbot / reload はデプロイ環境の語彙であり見積業務の用語集に属さない

## ステップ

### Step 1: ADR-20260827-ff0 をコミットする
- [ ] **完了**
- 対象ファイル:
  - `docs/adr/20260827-ff0-tls-renewal-decoupled-certbot-container-periodic-nginx-reload.md`（作成済み・未コミット）
  - `docs/adr/INDEX.md`（「開発基盤（依存管理・CI）」表に 1 行追記済み・未コミット）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - grill セッションで作成済みのファイルをそのままコミットする。内容の再検討はしない
- コミットメッセージ: `docs: ADR-20260827-ff0 証明書更新を certbot コンテナと定期 reload の疎結合で行う判断を記録する`

### Step 2: `compose.prod.yaml` に certbot サービスを追加し、nginx を定期 reload に切り替える
- [ ] **完了**
- 対象ファイル:
  - `compose.prod.yaml`
  - `docker/nginx/conf.d/app-ssl.conf`（ヘッダコメントのみ）
- テスト戦略: テスト不要（compose の宣言的設定。`docker compose config` と起動実測で検証する）
- 作業内容:
  - `certbot` サービスを追加する:
    - `image: certbot/certbot:v5.7.0`（Renovate の docker-compose マネージャが自動検出する。コメントに「無印タグはマルチアーチ、アーキ別タグ不要」を記す）
    - `entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"`（`ENTRYPOINT` が `certbot` のため `command` ではなく `entrypoint` を上書きする旨をコメントに記す）
    - `restart: unless-stopped`
    - `volumes`: `/etc/letsencrypt:/etc/letsencrypt`（rw。renewal conf の `webroot_path` と一致させるため webroot も同パス）、`/var/www/certbot:/var/www/certbot`（rw）、`certbot-work:/var/lib/letsencrypt`（匿名ボリューム防止）
    - `depends_on: nginx: condition: service_started`（理由コメント: 初回 `renew` の webroot 応答と起動ログの並び順のため。失敗しても 12h 後に再試行される）
  - `nginx` サービスを変更する:
    - `command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & exec nginx -g \"daemon off;\"'"`
    - コメントに次を記す: 周期 6h は原典どおり／`command` 上書きにより `/docker-entrypoint.d/` は走らない（templates・IPv6 自動付与・worker autotune を使う場合は方式を見直す）／`exec` は PID 1 を nginx に固定し `STOPSIGNAL SIGQUIT` を直接届けるため
    - `volumes` は現状維持（`/etc/letsencrypt` と `/var/www/certbot` は ro のまま）
  - トップレベル `volumes:` に `certbot-work:` を追加する
  - `app-ssl.conf` ヘッダの「証明書はホスト側の certbot が発行し…deploy-hook でコンテナ nginx を reload する」を、certbot コンテナと定期 reload の構成説明 + `docs/ops/tls-certificates.md` へのポインタに差し替える
  - `docker compose -f compose.prod.yaml --env-file .env.production config` で構文と解決結果を確認する
- コミットメッセージ: `ci: certbot をコンテナ化し nginx を 6h ごとの定期 reload に切り替える`（ボディに ADR-20260827-ff0 参照と、周期・exec・named volume の判断理由を記す）

### Step 3: 運用手順を `docs/ops/tls-certificates.md` に集約し、既存ドキュメントをポインタ化する
- [ ] **完了**
- 対象ファイル:
  - `docs/ops/tls-certificates.md`（新規）
  - `docs/ops/prod-docker-local.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `tls-certificates.md` に次の節を置く:
    1. **構成の概要** — certbot コンテナ（12h renew）と nginx（6h reload）の疎結合、反映まで最大 6h 遅れるのは正常動作である旨、ADR-20260827-ff0 へのリンク
    2. **ホスト certbot からの移行（一回限り・証跡として残す）** — 判断 8 の順序で記す。`systemctl disable --now certbot.timer` → `/etc/letsencrypt/renewal/chapple-esm.duckdns.org.conf` から `renew_hook` 行を削除 → 同 conf の `authenticator = webroot` / `webroot_path = /var/www/certbot` を確認 → `apt remove certbot`（`purge` ではないので `/etc/letsencrypt` は残る） → `docker compose ... up -d` → `docker logs certbot` で初回 `renew` の結果を確認
    3. **新規環境での初回発行（手動）** — `app-ssl.conf` を一時退避して nginx を 80 番のみで起動 → `docker compose -f compose.prod.yaml --env-file .env.production run --rm certbot certonly --webroot -w /var/www/certbot -d chapple-esm.duckdns.org --email <addr> --agree-tos --no-eff-email` → `app-ssl.conf` を戻して `docker compose ... exec nginx nginx -s reload`。スクリプト化しない理由（判断 5）を一文添える
    4. **更新失敗の確認** — `docker logs certbot`（`renew` は 12h ごと。「No renewals were attempted」は正常）。Let's Encrypt の期限切れ通知メールは 2025 年 6 月に廃止済みで、能動確認が唯一の手段である旨。外形監視は別イシュー（Step 4 で起票した番号を記す）
  - `prod-docker-local.md` を更新する:
    - サービス構成表に `certbot` 行を追加（「ローカルでは `renew` が何もせず sleep に入るだけ」）
    - 注意点の「証明書はホスト側 certbot（webroot 方式）が発行し…deploy-hook でコンテナ nginx を reload する」を削除し、`tls-certificates.md` へのポインタに差し替える
    - 「そのままではローカルで起動しない」の項は維持（`app-ssl.conf` 退避の手筋は初回発行手順と共通なので、`tls-certificates.md` 側から逆参照する）
- コミットメッセージ: `docs: TLS 証明書の運用手順を docs/ops/tls-certificates.md に集約する`

### Step 4: 証明書期限の外形監視イシューを起票する
- [ ] **完了**
- 対象ファイル: なし（GitHub Issue のみ）
- テスト戦略: テスト不要（イシュー起票）
- 作業内容:
  - `/create-issue` で `ci:` タイプのイシューを起票する。要点: 疎結合化により certbot 側の失敗は失効まで nginx 側に現れない／Let's Encrypt の通知メールは廃止済み／証明書期限の外形監視（Uptime Kuma / UptimeRobot / healthchecks.io 等）を死活監視と合わせて設計する／#777（バックアップ）と同列の運用イシュー
  - 起票した番号を Step 3 の `tls-certificates.md` に反映する（Step 3 のコミットに含めるため、実施順は Step 4 → Step 3 でもよい）
- コミットメッセージ: なし（Step 3 に吸収）

### Step 5: ローカルでの起動実測
- [ ] **完了**
- 対象ファイル: なし
- テスト戦略: テスト不要（検証のみ、コミット対象なし）
- 作業内容:
  - `prod-docker-local.md` の手順（`app-ssl.conf` 退避）で `up -d --wait` し、次を確認する:
    - `docker compose ps` で certbot が running、`docker logs certbot` に `No renewals were attempted` 相当が出て sleep に入る
    - `docker exec <nginx> cat /proc/1/comm` が `nginx`
    - `docker compose stop nginx` が数秒以内に終わる（graceful）
    - `docker volume ls` に `estimate-management-system-prod_certbot-work` があり、匿名ボリュームが増えていない
  - `down -v` で片付ける
- コミットメッセージ: なし

## PR マージ後のユーザー作業（EC2 上）

計画の対象外だが、Step 3 の手順書どおりに実施する。順序が結果に効く（判断 8）。

- [ ] `systemctl disable --now certbot.timer`
- [ ] renewal conf から `renew_hook` 行を削除、`webroot_path = /var/www/certbot` を確認
- [ ] `apt remove certbot`
- [ ] `docker compose -f compose.prod.yaml --env-file .env.production pull && up -d`
- [ ] `docker logs certbot` で初回 `renew` の結果を確認

## 影響範囲

| 対象 | 影響 |
|------|------|
| `compose.prod.yaml` | certbot サービス追加、nginx `command` 追加、named volume 追加 |
| `docker/nginx/conf.d/app-ssl.conf` | ヘッダコメントのみ（設定本体は不変） |
| `docs/ops/` | `tls-certificates.md` 新設、`prod-docker-local.md` 更新 |
| `docs/adr/` | ADR-20260827-ff0 追加、INDEX 追記 |
| Renovate | `certbot/certbot` が docker-compose マネージャの管理下に入る（設定変更なし。non-major は既存ルールで automerge） |
| アプリケーションコード / Prisma / 単体テスト / E2E / CI ワークフロー | なし |
| README / CONTEXT.md | なし |
