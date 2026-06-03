---
name: create-pr
description: GitHub PRを作成する。Use when PRの作成、プルリクエストの作成を依頼されたとき。実装振り返りレポート付きで作成する。
user-invocable: true
context: fork
---

# プロンプト内容

あなたは GitHub PR 作成の専門家です。
#$ARGUMENTS について振り返りレポート付きの PR を作成してください。

## ステップ 1: 対象 issue の特定

`$ARGUMENTS` から issue 番号を特定する。

- `#123` や `123` のような番号が含まれていればそれを使う
- 番号がない場合はブランチ名（`feat/issue-87` など）から issue 番号を抽出する
- どちらでも特定できない場合はエラーとして処理を終了し、理由を返す

```bash
gh issue view {番号}
```

- issue のタイトル・本文を取得して後続ステップで使用する

## ステップ 2: 実装コンテキストの収集

以下の情報を収集する。

### コミット履歴

```bash
git log --oneline develop..HEAD
```

### 変更ファイル一覧

```bash
git diff develop..HEAD --stat
```

### 実装計画・逸脱記録

現在のブランチ名から issue 番号を導出する: `git branch --show-current | grep -oE 'issue-[0-9]+'`。
計画ディレクトリは `docs/claude-plans/{issue-N}/`（例: `docs/claude-plans/issue-293/`）とする。

1. そのディレクトリが存在し `.md` ファイルがある場合:
   - `deviations.md` 以外の `.md` ファイルを全て **planファイル** として読み取る
   - `deviations.md` があれば **逸脱記録** として読み取る
2. ディレクトリが無い or 空 → 計画なしとして扱う

## ステップ 2.5: 設計判断の ADR 起票チェック

ステップ 2 で読み取った plan ファイルに `## 設計判断` セクションがある場合：

1. セクションの内容が「なし」であればスキップ
2. 設計判断が列挙されている場合、`docs/adr/INDEX.md` を読み取り、各設計判断に対応する ADR が存在するか確認する
3. ADR が存在しない設計判断がある場合、**絶対に**ユーザーに以下を提示して確認する：
   - 「以下の設計判断に対応する ADR が見つかりません：」
   - 未起票の設計判断の一覧
   - 「ADR を起票しますか？ それともこのまま PR を作成しますか？」
4. ユーザーが起票を希望した場合は ADR 作成を行ってから PR 作成に戻る
5. ユーザーがスキップを選んだ場合はそのまま次のステップに進む

※ plan ファイルが存在しない、または設計判断セクションがない場合はスキップ

## ステップ 3: PR タイトル生成

優先順位:

1. `$ARGUMENTS` に明示的なタイトルがあればそれを使用
2. `.claude/references/commit-types.md` のマッピングテーブルを参照し、ブランチ接頭辞（`branch` 列）からタイトル接頭辞（`prefix` 列）を決定する

例: ブランチ `feat/issue-87` + issue タイトル「振り返りレポート付きPR作成スキル」→ `feat: 振り返りレポート付きPR作成スキル`

## ステップ 4: PR description 生成

以下のテンプレートに沿って PR description を生成する。
条件に応じてセクションの出力を制御すること。

```markdown
## Summary

(コミット履歴と issue 内容から1-3行の概要を記述)

Closes #{issue_number}

## 実装計画

<details>
<summary>plan mode で作成した実装計画（クリックで展開）</summary>

（計画ディレクトリ内の plan ファイルの内容）
（複数ファイルがある場合はファイル名を見出しにして掲載）

</details>

※計画ファイルが存在しない場合はこのセクション自体を省略

## 計画からの逸脱

（計画ディレクトリ内の deviations.md の内容を整理して記述）

※逸脱記録がなく計画がある場合:
「計画通りに実装が完了しました。特筆すべき逸脱はありません。」

※計画も逸脱記録もない場合:
「実装計画なしで実装を行いました。」

## Test Plan

(テスト関連のコミットや変更ファイルからテスト方針をまとめる)

- [ ] テスト項目

---

Generated with [Claude Code](https://claude.ai/code)
```

- Summary はコミット履歴と issue 内容を元に簡潔にまとめる
- 実装計画は `<details>` で折りたたんでレビュアーが必要に応じて展開できるようにする
- 計画からの逸脱は逸脱記録を開発者が読みやすい形に整理する
- Test Plan はテスト関連の変更から自動生成し、不足があれば追記する

## ステップ 5: Push & PR 作成（確認不要）

```bash
git push -u origin {current_branch}
```

```bash
gh pr create --base develop --title "{title}" --body "{body}"
```

- base は必ず `develop`（CLAUDE.md の規約）
- `$ARGUMENTS` に `--draft` が含まれている場合は `gh pr create --draft` フラグを使用する

## ステップ 6: 結果を返す

- 作成した PR の番号と URL を簡潔に返す
