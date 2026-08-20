# VSCode起動でPostgreSQLの5432が開く仕組み（VSCode→WSL→systemd→PostgreSQL）

作成日: 2026-07-03

## 概要

VSCodeを起動すると必ずローカルの5432ポート（PostgreSQL）が開いている理由を調査した。
結論として **VSCodeが直接ポートを開けているのではなく**、以下の連鎖で自動起動していることが判明した。

```
① VSCode(Remote-WSL)を開く
     │ WSLディストロが停止中なら、ここで起動される
     ▼
② WSL2 が起動 → /etc/wsl.conf の [boot] systemd=true
     │ により systemd が PID 1(/sbin/init) として立ち上がる
     ▼
③ systemd が enabled なサービスを自動起動
     │ postgresql.service (enabled)
     │    └─ postgresql@16-main.service (enabled-runtime)
     ▼
④ pg_ctlcluster 16-main start が postgres バイナリを起動 (親=systemd)
     ▼
⑤ postgres が postgresql.conf を読む → port = 5432
     ▼
   127.0.0.1:5432 が LISTEN 状態になる
```

ポイントは「VSCodeを開くたびに新しく起動」ではなく、**WSLセッションの寿命 = postgresの寿命** という点。
VSCod/ターミナルを全て閉じるとWSLは一定時間後に自動シャットダウンし、postgresも道連れに落ちる。
次にVSCodeを開くとWSLが再起動し②〜⑤が再実行され、5432が復活する。だから「VSCodeを開くたびに開く」ように見える。

## 詳細

### 調査で確認した事実

| 確認項目 | 結果 |
|---|---|
| Docker か？ | **違う**。`docker ps` は空。ネイティブの PostgreSQL 16 |
| プロセスの親 | postgres(PID 279)の親は **PID 1 = systemd** |
| WSL設定 | `/etc/wsl.conf` に `[boot] systemd=true` |
| 自動起動設定 | `postgresql@16-main.service` が **enabled** |
| listen設定 | `postgresql.conf` に `port = 5432`、bind は `127.0.0.1`（ローカルのみ） |
| 起動時刻 | `active (running) since ... 1 day 18h ago`（毎回ではなくWSL起動時に1回） |

### 使ったコマンド

```bash
# コンテナではなくネイティブプロセスであることの確認
docker ps
ss -tlnp | grep 5432
ps aux | grep -i postgres

# 親プロセスを辿る（PID 1 = systemd に行き着く）
ps -o pid,ppid,lstart,cmd -p 279

# WSLでsystemdが有効か
cat /etc/wsl.conf          # systemd=true
ps -p 1 -o comm=           # systemd

# 実際にpostgresバイナリを起動しているユニット
systemctl status postgresql@16-main.service
systemctl is-enabled postgresql@16-main.service   # enabled-runtime
```

### systemd の役割（この件で担っていること）

- **PID 1 / init**: カーネル起動後に最初に起こされる唯一のプロセス。全プロセスの祖先。
- **サービスの自動起動**: `enabled` 登録されたサービス（cron/docker/ssh/postgresql等）をOS起動時に立ち上げる。今回の「5432を開ける主体」はこれ。
- **依存解決・順序保証・並列起動**: `multi-user.target` などのゴールに向けて依存関係を解決してまとめて起動する。
- `postgresql.service` は中身が `/bin/true` の「まとめ役」unit（`active (exited)`）で、実プロセスを持つのは
  `postgresql@16-main.service`。`@` は**テンプレートunit**で 1定義から複数クラスタ（16-main 等）を生成できる。

### 補足: 自動起動を止めたい場合

普段は `pnpm dev` / `pnpm db:migrate` / E2Eテストが全てローカルPostgreSQLに依存するため、
開発中は起動しっぱなしが実務上ラク。`127.0.0.1` バインドなので外部到達不可でセキュリティ上の問題もない。

```bash
# 今すぐ止める（WSLが生きている間）
sudo systemctl stop postgresql@16-main

# WSL起動時の自動起動を無効化（使う時だけ手動 start）
sudo systemctl disable postgresql@16-main postgresql

# 使う時だけ起動
sudo systemctl start postgresql@16-main
```

`start`(今すぐ) と `enable`(次回起動時の自動起動) は別物である点に注意。

## 参考

- `/etc/wsl.conf` — WSLの systemd 有効化設定
- `/etc/postgresql/16/main/postgresql.conf` — port/listen_addresses
- `/usr/lib/systemd/system/postgresql@.service` — テンプレートunit定義
- 関連コマンド: `systemctl status/start/stop/enable/disable`, `journalctl -u <unit>`
