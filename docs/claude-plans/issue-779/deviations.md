# Issue #779: 計画からの逸脱記録

## Step 5: ローカル起動実測の方法

### 元の計画内容

`prod-docker-local.md` の手順（`app-ssl.conf` を一時退避し `app.conf` を proxy_pass に戻す）で
スタック全体を `up -d --wait` し、certbot / nginx の挙動を確認する。最後に `down -v` で片付ける。

### 実際の実装内容

- `up -d --no-deps nginx certbot` で **nginx と certbot の 2 サービスのみ**起動した
- 証明書は自己署名（`openssl req -x509`）を scratchpad 配下の `live/chapple-esm.duckdns.org/` に生成し、
  scratchpad に置いた compose override ファイルで `/etc/letsencrypt` と `/var/www/certbot` の bind mount 元を
  scratchpad に差し替えた。リポジトリ内のファイル（`app-ssl.conf` / `app.conf`）には触れていない
- 確認項目（certbot が `No renewals were attempted.` の後 sleep に入る／nginx の PID 1 が `nginx`／
  `nginx -s reload` が master に届く／graceful stop が 1 秒未満／named volume `certbot-work` が作られ
  匿名ボリュームが増えない／TLS 終端と 80→443 の 301）はすべて計画どおり実測した
- `down -v` で片付けた（`pgdata` は本検証で作られたものであることを作成時刻で確認してから削除）

### 逸脱の理由

- 検証対象は nginx と certbot の起動挙動だけで、app / db / migrate は今回の変更に無関係
- app イメージは arm64 単一アーキ（ADR-20260818-7pn）で、amd64 の開発機では GHCR のイメージがそのまま動かず、
  ローカルビルドには Next.js のフルビルドが必要になる。検証の価値に対してコストが釣り合わない
- 開発機にはホストの `/etc/letsencrypt` と `/var/www/certbot` が存在せず、compose をそのまま起動すると
  docker が両ディレクトリを root 所有で作ってしまう。scratchpad への差し替えでこの副作用を避けた

## Step 3: `tls-certificates.md` に計画外の節を追加

### 元の計画内容

「構成の概要」「ホスト certbot からの移行」「新規環境での初回発行」「更新失敗の確認」の 4 節。

### 実際の実装内容

上記 4 節に加え「5. 手動で即時更新したいとき」を追加した。また初回発行手順に
`docker compose run --rm --entrypoint certbot certbot certonly ...` と **`--entrypoint certbot` が必須**である旨を明記した。

### 逸脱の理由

`compose.prod.yaml` で certbot サービスの `entrypoint` を renew ループに上書きしたため、
`docker compose run certbot <サブコマンド>` は引数がループの `$0 $1 ...` に吸われて無視され、
サブコマンドではなくループが始まる。この落とし穴は初回発行だけでなく手動 renew でも同じであり、
手順書に正しい呼び出し方を一箇所にまとめておく必要があった。
