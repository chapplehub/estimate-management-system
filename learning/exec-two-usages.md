# execコマンドの2つの使い方

作成日: 2026-03-27

## 概要

bashの `exec` には「コマンド付き（プロセス置換）」と「コマンドなし（リダイレクト操作）」の2つの全く異なる機能がある。

## 詳細

### 1. コマンド付き exec — プロセス置換

forkせず、現在のシェルプロセスを指定コマンドで完全に置き換える。exec以降の行は実行されない。

```bash
#!/bin/bash
export DATABASE_URL="postgres://..."
exec node server.js
# ここには到達しない
```

**主な用途:**

- **Dockerのentrypoint**: PID 1をアプリに渡し、SIGTERMを直接受け取れるようにする（graceful shutdown）
- **ラッパースクリプト**: 環境変数セット後に本体を起動。プロセスが1つで済む
- **シェル切り替え**: `exec zsh` でbashをzshに置き換え

**使いどころの判断基準:** 「このスクリプトの役目は終わったから、あとは別のコマンドに引き継ぐ」場面。

### 2. コマンドなし exec — リダイレクト操作

プロセス置換は起きず、現在のシェル自身のファイルディスクリプタを操作する。

```bash
# 通常のリダイレクト: catコマンドだけに適用（一時的）
cat < /dev/tty

# exec付きリダイレクト: シェル自体のstdinを変更（永続的、スクリプト終了まで）
exec < /dev/tty
```

**通常のリダイレクトとの違い:**
- `exec` なし → 単一コマンドに対する一時的なリダイレクト
- `exec` あり → シェルプロセスそのもののファイルディスクリプタを書き換え、以降のすべてのコマンドに影響

**実例: Git hookのprepare-commit-msg**

```bash
if [ -t 1 ]; then
  exec < /dev/tty        # stdinをターミナルに繋ぎ直す
  npx cz --hook || true  # Commitizenが対話的にキーボード入力を受け取れる
fi
```

Git hookはパイプ経由で実行されるためstdinがターミナルに繋がっていない。`exec < /dev/tty` でstdinをターミナルに再接続することで、Commitizenの対話的プロンプトがキーボード入力を受け取れるようになる。

## 参考

- 関連ファイル: `.husky/prepare-commit-msg`
