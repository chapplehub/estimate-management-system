# Claude Code モバイル連携（remote-control）途絶：ステイルロックによる自動復帰阻害

作成日: 2026-07-02

## 概要

Claude Code のモバイルアプリ連携（セッションのスマホ表示）が数日前から途絶した障害の調査と復旧の記録。

原因は「デーモンプロセスの死」そのものではなく、**死んだ PID を指したまま居座るステイルなロック/名簿ファイルが、後続セッションの自動復帰を長期間ブロックしていた**こと。復旧は `claude daemon stop --any`（名簿の刈り取り）→ `/remote-control`（現セッションの再登録）の二手で完了した。

## 詳細

### モバイル連携の仕組み

モバイル/Web（claude.ai/code）連携は、クラウドが直接 PC を見るのではなく、**ローカル常駐プロセス「daemon（supervisor）」が中継役**を務める設計。

- デーモンは**オンデマンド起動**：常時は動かず、`/remote-control` 等でセッションを共有した瞬間に立ち上がる。
- 状態は `~/.claude/daemon.lock` / `daemon.status.json` / `daemon/roster.json` に永続化。
- セッション⇔デーモン、デーモン⇔クラウドの中継に **`/tmp/cc-daemon-<uid>/...` 配下の Unix ドメインソケット**を使う。

### 障害の時系列（二段構え）

| 日付 | 事象 | 影響 |
|------|------|------|
| 6/13 | PC 再起動で daemon supervisor プロセスが死亡 | `roster.json`/`daemon.lock` がステイル化（死んだ PID を指したまま凍結）。`/tmp` のソケットはまだ残存 |
| 6/22 | `/tmp` が散らかっていたので手動掃除、`/tmp/cc-daemon-*/` のソケットも巻き込んで削除 | 残っていた中継ソケットが消え、**モバイル表示が完全途絶（体感した日）** |
| 〜19日間 | どの新規セッションを起動してもデーモンが復活せず | ステイルロックが「まだ動いている」と主張し、後続の on-demand 起動を抑止 |

※ この日付は PR #423（`.claude/settings.json` のフックパス修正、2026-06-22 マージ）作業と並行した手動お掃除。PR の diff 自体は `/tmp` を触っていない。

### なぜ自動復帰しなかったか（本質）

デーモンは on-demand 起動だが、`daemon.lock` に「既存デーモンが動いている」記録があると後続の `claude` は起動を控える（ログに `an on-demand daemon never displaces a running one` が多数）。

今回はその記録が**死んだ PID を指すステイルロック**になっていたため、19 日間どのセッションを起動してもデーモンが立ち上がらなかった。

CLI 自身も矛盾を検知して警告を出していた：
```
warning: supervisor not running but 1 worker in roster —
         run `claude daemon stop --any` to reap them
```

### 診断の証拠（切り分けの目印）

`claude daemon status` の出力が決定的：

```
not running                      ← デーモン本体が動いていない
control.sock: unreachable ENOENT ← 中継ソケット消滅
bg workers: 1 in roster.json     ← 死んだワーカーが名簿に居座り（本来 0 のはず）
roster.json: updated 1649949s ago ← ≒19日前で凍結（逆算で 6/13）
warning: supervisor not running but 1 worker in roster
```

補助確認：
- `ps -p <lockのpid>` → 存在しない（ロックが死体を指す）
- `ls /tmp/cc-daemon-1000/` → ディレクトリごと消滅（手動掃除の裏付け）

### 復旧手順

```bash
claude daemon stop --any    # ステイルな名簿/ロックを刈り取り（"no daemon running" でも roster は空に書き直される）
claude daemon status        # bg workers: 0 / 例の警告が消えたことを確認
```
→ その後、セッション内で **`/remote-control`** を実行して現セッションをデーモンに再登録。
→ デーモンがオンデマンド起動し `/tmp/cc-daemon-*/` も再生成、スマホにセッションが表示されて復旧確認。

### 教訓

- **障害本体はプロセス死ではなく「死んだ状態を生きているフリで居座らせるステイルロック/名簿」。** 状態ファイルを整合させるだけで直ることが多い。
- **動作中デーモンのソケットがある `/tmp/cc-daemon-*` は掃除で不用意に消さない。** `/tmp` は再起動や手動掃除で消える前提の領域で、IPC ソケットを置く設計との相性に注意。
- ソケット削除自体は恒久破壊ではない（デーモンが起動時に作り直す）。復帰の障害物はあくまでステイルロックの方。
- 役割分担で理解する：`daemon stop --any` ＝“配線の復旧”、`/remote-control` ＝“このセッションを配線に繋ぐ”。
- 切り分け目印：`claude daemon status` の `bg workers` 件数と `supervisor not running but N worker` 警告。

## 参考

- `~/.claude/daemon.lock` / `daemon.status.json` / `daemon/roster.json`
- `~/.claude/daemon.log`（supervisor / bg のライフサイクルログ）
- `/tmp/cc-daemon-<uid>/`（rendezvous / pty / control ソケット）
- コマンド: `claude daemon status` / `claude daemon stop --any` / スラッシュ `/remote-control`
- PR #423（時系列の並行事象。連携障害とは無関係な settings.json 修正）
