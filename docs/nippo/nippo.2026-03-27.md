# 日報 2026年03月27日

## 📝 作業ログ

### 10:49 - CI改善（commit系git hooks）

ci改善(commit系のgit hooks周り)

### 11:45 - リダイレクトの理解

リダイレクトについて理解

- `[コマンド]  [リダイレクト演算子]  [ファイル]` の順番で書く必要がある
- ２つ目はエラー：
  - `ls -l > filelist.txt` ← 正しい
  - `filelist.txt < ls -l` ← エラー
- `[command1] | [command2]` — command1の標準出力をcommand2の標準入力につなげる
- `[command] > [file]` — commandの標準出力をfileに変える

### 12:50 - シェルのエラー処理設定

シェルのエラー処理の設定の理解

- `set -e` → コマンドが失敗(終了コード0以外)したら、スクリプトを即座に終了する
- `set +e` → その制限を解除する(失敗しても続行する)

```bash
set -e
[ -t 0 ]    # false(終了コード1) → ここでスクリプト終了！
echo "ここに到達しない"

set +e
[ -t 0 ]    # false(終了コード1) → 続行する
echo "ここに到達する"
```

### 18:04 - prepare-commit-msg適用対象変更

ci: prepare-commit-msgの適用範囲・適用対象を変更
「worktree内でprepare-commit-msgを実行しない」から「AIには実行しない」に変更

### 18:04 - prepare-commit-msg修正

ci: prepare-commit-msgをユーザのコミット時のみ発動するように修正

- `[ -t 1 ]` で標準出力先がターミナルになっているか確認
- `exec < /dev/tty` はstdinをターミナルデバイスに切り替え

### 18:05 - pre-commitホワイトリスト化

ci: pre-commitの対象をホワイトリスト方式にしてsrc,prisma,ルートの設定ファイルのみを設定

### 18:05 - commitizen設定修正

ci: commitizenの設定修正　コミット時のsubjectに大文字始まりを許可

### 18:06 - E2Eテスト起動条件変更

ci: PR時のe2eテスト起動条件のpathsをホワイトリストに変更(playwright.yml)

---

## 🎯 今日の目標

- [x] CI改善（commit系git hooks周りの見直し）
- [x] シェルスクリプトの基礎知識習得（リダイレクト、エラー処理）

## 📊 進捗状況

本日は **CI/CD改善** を中心に取り組み、計10コミットを作成。

**完了した作業:**
- prepare-commit-msgの適用対象をworktree基準からAI判定基準に変更
- prepare-commit-msgをユーザのコミット時のみ発動するよう修正（`[ -t 1 ]`活用）
- pre-commitの対象をホワイトリスト方式に変更（src, prisma, ルート設定ファイル）
- commitizenの設定修正（subjectの大文字始まり許可、小文字強制変換の無効化）
- PR時のE2Eテスト起動条件のpathsをホワイトリストに変更
- GitHub OAuthスコープ・workflowスコープに関するドキュメント作成
- Linuxコマンド・ファイルシステムに関するドキュメント作成

## 💡 学びと気づき

- **リダイレクト**: `[コマンド] [演算子] [ファイル]`の語順が必須。パイプ(`|`)はコマンド間の標準出力→標準入力接続
- **シェルのエラー処理**: `set -e`で失敗時即終了、`set +e`で解除。git hooksでは`set +e`を活用してターミナル判定などの失敗を許容する
- **ターミナル判定**: `[ -t 1 ]`で標準出力先がターミナルかを確認でき、AI実行とユーザ実行を区別できる
- **`exec < /dev/tty`**: stdinをターミナルデバイスに切り替えることで、git hook内でもユーザ入力を受け付けられる

## 🚀 明日への申し送り

- CI改善の動作確認（各hookが意図通りに動作するか実際のワークフローで検証）
- 必要に応じてGitHub Actionsのワークフロー設定の追加調整
