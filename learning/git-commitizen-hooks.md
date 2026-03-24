# Git Commitizen と Husky フックの仕組み

作成日: 2026-02-19

## 概要

commitizen が `git commit` 時に自動起動する仕組みと、関連するコマンドの詳細を学んだ。

## 詳細

### Git のコミット関連フック（実行順）

| 順番 | フック | タイミング |
|---|---|---|
| 1 | `pre-commit` | コミット処理の最初。lint や test の実行に使う |
| 2 | `prepare-commit-msg` | コミットメッセージのエディタが開く前。メッセージのテンプレート加工や commitizen の対話UIの差し込みに使う |
| 3 | `commit-msg` | コミットメッセージが確定した後。メッセージのバリデーション（commitlint等）に使う |
| 4 | `post-commit` | コミット完了後。通知などに使う |

### `exec < /dev/tty && git cz --hook || true` の分解

- **`exec < /dev/tty`**: Git フックはデフォルトで標準入力がターミナルに繋がっていない。`exec` でシェル自身の標準入力を `/dev/tty`（現在のターミナルデバイス）に差し替え、commitizen の対話UIがキーボード入力を受け取れるようにする
- **`&&`**: 左側が成功した場合のみ右側を実行
- **`git cz --hook`**: commitizen をフックモードで起動。`--hook` により「自分で `git commit` を呼ぶ」のではなく「コミットメッセージファイルに書き込むだけ」で終える
- **`|| true`**: 失敗しても終了コード 0 を返す。Ctrl+C でキャンセルしてもコミット自体がエラーにならない

### `git cz` は Git カスタムサブコマンド

`cz` は Git のビルトインコマンドではない。Git は `git <name>` と実行されると PATH 上の `git-<name>` 実行ファイルを探して実行する仕組みがある。commitizen をインストールすると `node_modules/.bin/git-cz` が作られ、これが `git cz` として呼び出される。

### `pnpm cm` と `git commit` の違い

| コマンド | 動作 |
|---|---|
| `git commit` | husky の `prepare-commit-msg` フック経由で commitizen 起動 |
| `pnpm cm` | 直接 commitizen を起動（`cz` コマンド） |

`prepare-commit-msg` フックを使っている場合、`pnpm cm` は基本的に不要。

## 参考

- `.husky/prepare-commit-msg`
- `.husky/commit-msg`
- `.husky/pre-commit`
- `package.json` の `config.commitizen` セクション
- https://github.com/commitizen/cz-cli
