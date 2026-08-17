# Issue #758 / PR #759 — 自動レビュー修正計画 ラウンド 1

`/code-review medium`（対象 `develop...HEAD`）の 9 件を judge が再評価し、採用された 4 件を修正する。
指摘 ID は PR #759 のトップレベルコメント（生レビュー R1-1〜R1-9 / judge 評価）と対応する。

修正順は **①correctness → ③cleanup**。①で触った箇所に③が被る事故を避けるため。

---

## R1-1 ｜ ① correctness ｜ severity(参考): Medium

- **file:line**: `docker/nginx/conf.d/app.conf:23`、`docker/nginx/conf.d/app-ssl.conf.example:26`
- **問題**: `proxy_pass http://app:3000;` はリテラルホスト名かつ `resolver` 未指定のため、nginx が設定ロード時に一度だけ `app` を名前解決し、その IP をプロセス寿命の間キャッシュする。`docker compose up -d` では app のみ再作成され nginx は再作成されない（judge が実機確認）ため、app の IP が変わると nginx は死んだ IP を叩き続け、自己回復せず 502 を返し続ける。
  - 通常の `up -d` では IPAM が解放済みアドレスを再利用して IP が据え置かれるケースが多く常に再現するわけではないが、コンテナ churn（デプロイ失敗後の再試行、手動 `docker rm`、他コンテナの割り込み）で IP がずれた瞬間に自己回復不能な全断になる。
- **修正方針**: 両ファイルの `location /` で Docker 内蔵 DNS を明示し、変数経由の `proxy_pass` に変える。

  ```nginx
  resolver 127.0.0.11 valid=10s;
  set $upstream_app app;
  proxy_pass http://$upstream_app:3000;
  ```

  変数を経由すると名前解決がリクエスト時に遅延され、`valid=10s` で再解決されるようになる。変数版 `proxy_pass` は URI 部を持てない制約があるが、元が `http://app:3000`（パスなし）なので転送の挙動は等価。
- **影響範囲**: `docker/nginx/conf.d/app.conf`、`docker/nginx/conf.d/app-ssl.conf.example` の 2 ファイル。アプリコード・DB に影響なし。
- **想定テスト**: 自動テスト対象外（nginx 設定）。`docker compose -f compose.prod.yaml --env-file .env.production config` で構文を確認し、可能なら nginx 起動 + `http://localhost/api/health` の 200 を確認する。

---

## R1-2 ｜ ① correctness ｜ severity(参考): Medium

- **file:line**: `compose.prod.yaml:34`（db の healthcheck）
- **問題**: `pg_isready` に `-h` が無く Unix ソケット経由で判定している。postgres の entrypoint は initdb と初期化スクリプトを `listen_addresses=''` の一時サーバで走らせるため、TCP 5432 が閉じたままソケットだけが応答する時間帯が存在する。judge の実機計測で空ボリューム起動時に **ソケット ready 1.33s / TCP ready 1.82s**（約 0.5 秒＝初期化全体の約 28%）の偽陽性ウィンドウを確認。`start_period` も無いため、EBS の遅い EC2 で初期化が伸びると初回チェックがこのウィンドウに着地しうる。
  - 着地すると db が即 healthy → migrate が `db:5432` に ECONNREFUSED → `restart: "no"` なので再試行されず異常終了 → app の `service_completed_successfully` が満たされず nginx も起動せず、`up -d --wait` が失敗する。
- **修正方針**: healthcheck を TCP 経由に変え、`start_period` を追加する。

  ```yaml
  test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  start_period: 30s
  ```

  初期化中は TCP が拒否されるため unhealthy のままリトライされ、本起動後は `listen_addresses='*'` なので必ず通る（副作用なし）。
- **影響範囲**: `compose.prod.yaml` の db サービスのみ。dev 用 `compose.yaml:33` も同型だが、この PR のスコープ外（judge 判定に従い触らない）。
- **想定テスト**: 自動テスト対象外。`docker compose -f compose.prod.yaml --env-file .env.production config` で構文確認。

---

## R1-3 ｜ ③ cleanup ｜ severity(参考): Medium

- **file:line**: `Dockerfile:34-42`（build ステージ）
- **問題**: build ステージが `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` を渡していない。`.github/workflows/ci.yml:92-96` は「`betterAuth()` がモジュールスコープで実行され、secret 不在時の挙動（警告か throw か）が better-auth のバージョン依存であり、better-auth 自体が Renovate の更新対象」という理由でダミー値を明示的に固定している。Dockerfile がこの決定と無言で食い違っているため、better-auth が warn→throw に変わる更新が入ると CI は緑のままイメージビルドだけが壊れる（依存 PR ではなくリリース時に発覚する）。
- **③ 採用根拠**: 現行 better-auth 1.6.25 では throw しないため**現状のビルド結果は変わらない**（＝挙動不変。だから①ではなく③）。値は CI から写すだけで設計判断が不要。Dockerfile 1 ファイルに閉じており局所的。
- **修正方針**: `DATABASE_URL` と同様、`RUN` 内のインライン env としてのみ渡す（`ENV` に残さない。runner には compose 経由で実 env が入る）。値は CI と揃えて `BETTER_AUTH_SECRET=build-time-placeholder` / `BETTER_AUTH_URL=http://localhost:3000`。理由は CI を参照する短いコメントで示す。
- **影響範囲**: `Dockerfile` の build ステージのみ。イメージの `ENV` には残さないため runner の実行時環境に変化なし。
- **想定テスト**: `docker build --target runner -t ems-app:local .` が成功すること。

---

## R1-4 ｜ ③ cleanup ｜ severity(参考): Low

- **file:line**: `Dockerfile:42`（build ステージのダミー `DATABASE_URL`）
- **問題**: ホストが `build-placeholder` というベアラベルで、CI が意図的に使う RFC 2606 の `.invalid`（`db-unreachable.invalid`）ではない。CI コメントは「偶然の到達不能ではなく宣言された到達不能にする」という選定理由を明記している。search domain やワイルドカード DNS を持つビルダーでは `build-placeholder` が解決されうるため、即時 NXDOMAIN が TCP 接続ハングに変わり、静的レンダリング再発時に fail-fast しなくなる。
- **③ 採用根拠**: `deviations.md` が記録しているのは「ダミー `DATABASE_URL` を渡すこと」であってホスト名の選定理由までは規定していないため、計画準拠での却下にならない。R1-3 と同一箇所の 1 トークン変更で、挙動不変・設計判断不要・局所的。
- **修正方針**: `postgresql://build:build@db-unreachable.invalid:5432/build_check` に揃える（R1-3 と同一コミットで処理する）。
- **影響範囲**: `Dockerfile` の build ステージのみ。
- **想定テスト**: R1-3 と同じ（`docker build --target runner` の成功）。

---

## 修正しない指摘（④・参考）

judge 判定の詳細は PR #759 の judge 評価コメントを参照。

| ID | 分類 | 理由の要約 |
|---|---|---|
| R1-5 | ④ スコープ外 | デプロイ手順／deploy.sh は計画で後続イシュー扱い。`pull_policy: always` はローカル検証手順（`APP_IMAGE=ems-app:local`）を壊すため提案どおりの修正は計画に反する |
| R1-6 | ④ スコープ外 | EC2 再起動時の挙動は「EC2 構築手順書」に切り出し済み。実害は数秒の一時的失敗で自己回復し、根本対処は設計判断を伴う |
| R1-7 | ④ 計画準拠 | `docs/system-design-doc.md` §11.3 が当該ヘッダー値をそのまま列挙しており、nginx 設定はそれを忠実に実装している。方針変更は設計書改訂＋CSP 設計を伴う |
| R1-8 | ④ 誤検知 | Next 16.2.12 は `output: 'standalone'` で warn を出すのみでそのまま起動する。throw するのは `output: 'export'` のみ |
| R1-9 | ④ 誤検知 | 計画の「EC2 は pull のみ」はビルド経路の決定。compose ファイル・`.env.production` はそもそもホストに必要で、nginx conf の bind mount は追加要件を生まない |

### 別イシュー起票の申し送り

- 設計書 §11.3 のセキュリティヘッダー方針を現行推奨（`X-XSS-Protection: 0` + CSP 導入）に改訂（R1-7）
- deploy スクリプトで `docker compose pull` を必須化する／prod で `build:` フォールバックを封じる（R1-5 の補足。`image:` と `build:` 併記のためイメージ不在時に EC2 上ビルドへフォールバックしうる）
- EC2 再起動時の起動順序（systemd unit 等）（R1-6）
