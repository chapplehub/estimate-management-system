# ssh-agent と ssh-add の仕組み (WSL2 環境中心)

作成日: 2026-04-17

## 概要

SSH 鍵認証でパスフレーズを毎回入力しないためのキャッシュ機構 `ssh-agent` と、そこに鍵を登録する `ssh-add` コマンドの仕組みを整理。WSL2 + VSCode 環境で「VSCode を全部閉じると agent が空になる」現象の原因を特定し、自作スクリプトによる対処と追加の警告機能までを学んだ。

## 詳細

### ssh-agent とは

SSH 鍵認証でパスフレーズを毎回入力しないよう、**秘密鍵をメモリ上で保持する常駐プロセス**。`ssh` / `git push` などが SSH 認証時に agent に問い合わせ、登録済みなら認証をパスできる。

### ssh-add の役割

ssh-agent に鍵を登録/削除するクライアントコマンド。

```bash
ssh-add ~/.ssh/id_ed25519   # 登録 (パスフレーズ入力1回)
ssh-add -l                  # 登録済み鍵の一覧
ssh-add -d ~/.ssh/id_ed25519  # 登録解除
ssh-add -D                  # すべて解除
ssh-add -t 8h ~/.ssh/id_ed25519  # 8時間で自動削除
```

### 通信の仕組み

`ssh` と `ssh-agent` は Unix ドメインソケット経由で通信し、そのソケットパスは環境変数 `SSH_AUTH_SOCK` に格納されている。

```
[ssh / git] ─問い合わせ─▶ [ssh-agent] (メモリに鍵を保持)
              ↑
      SSH_AUTH_SOCK 環境変数でソケットパスを知る
```

### ssh-add -l の終了コード (重要)

Unix の伝統に従い、状態を終了コードで表現する設計:

| 終了コード | 意味 |
|---|---|
| `0` | 鍵が1つ以上登録されている |
| `1` | agent は動いているが鍵がない (`The agent has no identities.`) |
| `2` | agent に接続できない (`SSH_AUTH_SOCK` が無効など) |

この 3 値設計により、「鍵だけ入れ直せばいい」のか「agent ごと起動し直しが必要」なのかを呼び出し側で判別できる。

### WSL2 + VSCode での「agent が消える」問題

**観測**: すべての VSCode を閉じて再起動すると `ssh-add -l` が空になる。

**真因**: VSCode が agent を殺しているのではなく、**WSL2 VM ごとシャットダウンしている**。

```
1. 最後の VSCode が閉じる
2. vscode-server (WSL内) が終了
3. WSL2 にユーザープロセスがなくなる
4. vmIdleTimeout (デフォルト ~60秒) が発動
5. WSL2 VM ごとシャットダウン
6. VM 内の全プロセス = ssh-agent も道連れ
```

`ps -ef | grep ssh-agent` で PPID が `1` (init) であれば agent 自体は独立したデーモン。それでも VM が落ちれば一緒に死ぬ。

### 自作「keychain 相当」スクリプト (.bash_profile)

```bash
if [ -z "$SSH_AUTH_SOCK" ]; then
   RUNNING_AGENT="`ps -ax | grep 'ssh-agent -s' | grep -v grep | wc -l | tr -d '[:space:]'`"
   if [ "$RUNNING_AGENT" = "0" ]; then
        ssh-agent -s &> $HOME/.ssh/ssh-agent
   fi
   eval `cat $HOME/.ssh/ssh-agent`
fi
```

**動作原理**:
1. `SSH_AUTH_SOCK` が未設定な新規シェルでのみ処理
2. agent が起動していなければ起動し、出力 (`SSH_AUTH_SOCK=...` の export 文) をファイルに保存
3. そのファイルを `eval` で読み込み、現在のシェルに環境変数を設定

**本質**: `keychain` パッケージと同じ思想の手書き版。agent 接続情報をファイルに永続化し、新シェルから再接続する仕組み。

**ポイント**:
- `ssh-agent -s` は自動でデーモン化 (PPID=1 になる)
- `&>` は bash の stdout + stderr リダイレクト記法
- VSCode とは独立プロセスだが、**WSL2 VM の寿命に縛られる**

### パスフレーズを平文で保存しない自動化手段

完全自動化 (パスフレーズ保存) は論外として、代替案:

| 方式 | 秘密の保管場所 | WSL 相性 |
|---|---|---|
| **keychain** ツール / 自作スクリプト | 保管せず、agent を再利用 | ◯ 現在の方式 |
| **Windows Credential Manager** (wsl-ssh-pageant / npiperelay) | OS暗号化ストレージ | ◎ VSCode 閉じても生きる |
| **1Password SSH Agent** | パスワードマネージャ + 生体認証 | ◎ |
| **ハードウェアキー** (YubiKey, `ed25519-sk`) | 物理デバイス内 | ◯ |
| **ssh-add -t** | メモリのみ、時間制限付き | △ |

「VSCode 全閉じでも再入力したくない」を満たすには、**WSL2 の外に agent を置く** (Windows 側に移す) 必要がある。または `.wslconfig` で `vmIdleTimeout=-1` 設定で VM を常駐させる。

### 鍵が空のときに警告を出す Snippet

`.bash_profile` の既存 agent ブロック後ろに追加:

```bash
# Warn if ssh-agent has no keys loaded
if ! ssh-add -l &>/dev/null; then
    printf '\033[33mwarning: no ssh keys\033[0m\n'
fi
```

- `if ! cmd` で「終了コード非ゼロ」= 鍵なし or 接続不能で発火
- `\033[33m` = 黄色開始、`\033[0m` = スタイルリセット (忘れると以降も黄色になる)
- 既存の agent 起動ブロックが動作を保証しているので、実質「鍵なし (exit 1)」のみが発火条件

## 重要な学び

1. **ssh-agent は Unix ドメインソケット + 環境変数という古典的な IPC パターン**
2. **`ssh-add -l` の exit code 3 値** (0/1/2) は Unix 哲学の好例
3. **WSL2 の「VM」概念** — VM idle shutdown が見えないプロセス死の原因になる
4. **keychain 的アプローチ** = 秘密を保存せず agent を使い回す、ことでセキュリティを劣化させずに UX 改善
5. **「完全自動化」と「安全な半自動化」は別物** — 平文保存 vs OS 暗号化ストレージ / ハードウェアキーの区別が重要

## 参考

- `~/.bash_profile` — 自作 agent 管理スクリプトの設置場所
- `~/.ssh/ssh-agent` — agent の接続情報永続化ファイル
- `%USERPROFILE%\.wslconfig` — WSL2 の VM 寿命制御 (`vmIdleTimeout`)
- `man ssh-agent` / `man ssh-add`
