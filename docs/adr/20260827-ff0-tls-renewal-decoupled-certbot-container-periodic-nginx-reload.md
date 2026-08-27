# ADR-20260827-ff0: 証明書更新は certbot コンテナと nginx の定期 reload による疎結合で行い、deploy-hook と docker socket を用いない

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-08-27 |
| 最終更新日 | 2026-08-27 |

## コンテキスト

Issue #772 / PR #773 で nginx を HTTPS 構成へ切り替えた際、証明書の発行・更新は**ホスト側の certbot**（Ubuntu 24.04 の apt 版 2.9.0 + `certbot.timer`）に任せ、nginx コンテナは `/etc/letsencrypt` を読み取り専用 bind mount で参照する分離構成を取った。更新後の反映は renewal conf の `renew_hook` から `docker exec estimate-management-system-prod-nginx-1 nginx -s reload` を打つことで行っていた。

動作は検証済みだが、Issue #779 で次の 3 点が課題として挙がった。

- 証明書更新の仕組みがホスト依存で、`compose.prod.yaml` だけでは環境を再現できない
- apt 版 certbot は Ubuntu 24.04 の feature freeze で 2.9.0 に固定され、Renovate の管理対象外
- `renew_hook` が Compose の自動生成コンテナ名を直接参照しており、プロジェクト名やサービス名の変更で静かに失敗する

ここで「証明書の更新と nginx への反映をどう結合するか」を決める必要がある。この判断はホスト側 certbot の撤去・renewal conf の書き換え・運用手順書（`docs/ops/tls-certificates.md`）に染み込むため、実装に先立って確定させる。

前提となる事実（本 ADR 起票時に実測・確認したもの）:

- Docker + nginx + certbot の組み合わせで最も引用されている雛形は [wmnnd/nginx-certbot](https://github.com/wmnnd/nginx-certbot)（Medium 記事 "nginx and Let's Encrypt with Docker in less than 5 minutes"、2018 年）で、certbot は `renew` を 12h ループ、nginx は `-s reload` を 6h ループで回し、両者は証明書ファイルの共有だけで繋がる。
- `certbot/certbot:v5.7.0` の無印タグは amd64 / arm64 / arm32v6 のマルチアーキテクチャマニフェストであり、ADR-20260818-7pn の Graviton 前提でアーキテクチャ別タグは不要。`ENTRYPOINT` は `certbot` そのもので、`/etc/letsencrypt` と `/var/lib/letsencrypt` に `VOLUME` が宣言されている。
- Renovate は `docker-compose` マネージャで `compose.prod.yaml` を既に検出しており（Dependency Dashboard #639 に `nginx 1.28.0-alpine` の更新が並んでいる）、certbot イメージを足せば追加設定なしで管理下に入る。
- `nginx:1.28.0-alpine` の `/docker-entrypoint.sh` は `$1` が `nginx` のときだけ `/docker-entrypoint.d/` の初期化スクリプトを実行する。`command` を `/bin/sh -c ...` に差し替えるとこれらは走らないが、4 本（IPv6 listen 付与・local resolver 変数・templates の envsubst・worker autotune）はいずれも現構成では no-op であることを個別に確認した。
- Let's Encrypt は 2025 年 6 月に期限切れ通知メールを廃止した。更新失敗に受動的に気づく手段はもう無い。
- certbot は期限の 30 日前から更新を試みる。更新から反映までの遅延は、この 30 日のマージンに対して評価する。

## 検討した選択肢

### A. certbot コンテナ + nginx の定期 reload による疎結合（採用）

wmnnd/nginx-certbot に準拠する。certbot コンテナは `entrypoint` を `certbot renew` → 12h sleep のループに差し替え、nginx コンテナは `command` に 6h ごとの `nginx -s reload` ループを足す。両者は `/etc/letsencrypt` のファイル共有だけで繋がり、互いのコンテナ名・存在を知らない。`renew_hook` / `--deploy-hook` は持たない。

- 利点: compose ファイルだけで更新機構が完結する。certbot のバージョンが Renovate 管理下に入る。コンテナ名への依存が消える。certbot コンテナに与える権限は証明書ディレクトリの書き込みだけで済む。
- 欠点: 更新から反映まで最大 6h の遅延がある。nginx の `command` 上書きで公式イメージの `/docker-entrypoint.d/` が走らなくなる。

### B. certbot コンテナから docker socket 経由で nginx を reload（不採用）

`--deploy-hook` を残し、certbot コンテナに `/var/run/docker.sock` をマウントして `docker exec <nginx> nginx -s reload` を打つ。

- 利点: 更新が即時反映される。
- 欠点: docker socket のマウントは実質的にホスト root 権限の付与であり、インターネットに向いた ACME クライアントに与える権限として釣り合わない。加えて「コンテナ名を直接参照する脆さ」という Issue #779 の問題意識をそのまま持ち込む（compose の `container_name` で固定しても、名前への依存自体は残る）。

### C. certbot コンテナは one-shot、起動はホストの systemd timer / cron（不採用）

`docker compose run --rm certbot renew` をホストが定期実行する。certbot のバージョン管理はコンテナ化で解決する。

- 利点: certbot のバージョン管理は Renovate に乗る。常駐コンテナが増えない。
- 欠点: 更新の起動がホストの timer に残り、「compose だけで再現できない」という第一の課題を解決しない。reload の経路も別途要る（B と同じ問題に戻る）。

## 決定

証明書更新は `compose.prod.yaml` 内の certbot コンテナ（`renew` 12h ループ）と nginx コンテナの定期 reload（6h ループ）による疎結合で行う（選択肢 A）。`renew_hook` / `--deploy-hook` と docker socket のマウントは用いない。ホスト側の certbot（apt 版 + `certbot.timer`）は撤去する。

## 根拠

- **課題の 3 点をすべて解決するのは A だけ。** C はホスト依存が残り、B はコンテナ名依存が残る。
- **権限の釣り合い。** B が要求する docker socket は「証明書を更新する」という責務に対して過大で、ACME クライアントの脆弱性がそのままホスト掌握に繋がる経路を作る。A の certbot コンテナが持つのは `/etc/letsencrypt` と webroot の書き込み権限だけで、責務と権限が一致する。
- **反映遅延は失効リスクに影響しない。** certbot は期限 30 日前から更新を始めるため、6h の反映遅延は 30 日のマージンに対して誤差であり、即時反映（B の唯一の利点）に実益が無い。
- **周期は原典どおり 6h に揃える。** Issue 起票時は 36h が提案されたが、reload は設定再読込と worker の graceful 入替だけで接続を切らず、周期を伸ばして得るものが無い。独自値は「なぜその値か」の説明責任を恒常的に生むため、原典の値を採る。
- **nginx の `command` 上書きは現構成で無害であることを確認したうえで受け入れる。** entrypoint の作法に乗せるために専用 Dockerfile を作る案（`/docker-entrypoint.d/` にループ起動スクリプトを置く）は、nginx 用イメージの build / GHCR push / `release-image.yml` の拡張を要し、起きていない問題に恒常コストを払うことになる。

## 影響

- **更新から反映まで最大 6h 遅れる。** 「certbot のログでは更新済みなのにブラウザが古い証明書を出す」は、6h 以内なら正常動作である。
- **nginx の `command` 上書きにより `/docker-entrypoint.d/` は走らない。** templates（envsubst）・IPv6 listen の自動付与・worker autotune を使い始める場合は、この方式を見直す必要がある。`compose.prod.yaml` のコメントにこの制約を明記する。
- **初回発行は手動手順とする。** `renew` ループは既存の証明書が無い環境では何もしない。`app-ssl.conf` が証明書パスを直書きしているため、証明書が無いと nginx が起動せず webroot チャレンジにも応答できない鶏卵問題があり、原典の `init-letsencrypt.sh` 相当は同梱しない（EC2 一台の公開デモ環境に対して過剰で、テストの無いシェルスクリプトを保守対象に加えることになる）。手順は `docs/ops/tls-certificates.md` に置く。
- **更新失敗の検知は能動確認（`docker logs certbot`）のみになる。** 疎結合の代償として、certbot 側の失敗は nginx 側には失効の瞬間まで現れない。Let's Encrypt の通知メールも廃止済みのため、証明書期限の外形監視は別イシューで扱う。
- **`/etc/letsencrypt` はホスト bind mount のまま**とし、既存の証明書・アカウント・renewal conf を移動せずに引き継ぐ。移行時は renewal conf から `renew_hook` 行を削除し、ホスト側 certbot はコンテナ起動より**先に**停止・撤去する（残したまま起動すると、コンテナ内に docker CLI が無いためフックだけが失敗する）。
- **短命証明書（Let's Encrypt の 6 日有効期間プロファイル等）に切り替える場合は本 ADR の前提が崩れる。** 6h の反映遅延と 12h の更新周期は 90 日証明書の 30 日マージンを前提にしており、短命証明書では周期の再設計が要る。
- `CONTEXT.md` には何も追加しない。certbot / reload はデプロイ環境の語彙であり、見積業務の用語集に属さない。
