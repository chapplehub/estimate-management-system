---
name: create-pr
description: GitHub PRを作成する。Use when PRの作成、プルリクエストの作成を依頼されたとき。実装振り返りレポート付きで作成する。
user-invokable: true
---

# プロンプト内容

あなたは GitHub PR 作成の専門家です。
#$ARGUMENTS について振り返りレポート付きの PR を作成してください。

## ステップ 1: 対象 issue の特定

`$ARGUMENTS` から issue 番号を特定する。

- `#123` や `123` のような番号が含まれていればそれを使う
- 番号がない場合はブランチ名（`feat/issue-87` など）から issue 番号を抽出する
- どちらでも特定できない場合はユーザーに確認する

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

### 逸脱記録

メモリファイル `implementation-deviations.md` を読み取る。

- ファイルが存在しない、または空の場合は「計画通りに完了」として扱う

## ステップ 3: PR タイトル生成

優先順位:

1. `$ARGUMENTS` に明示的なタイトルがあればそれを使用
2. ブランチ接頭辞 + issue タイトルから生成する

ブランチ接頭辞マッピング:

| ブランチ接頭辞 | タイトル接頭辞 |
|---------------|---------------|
| `feat/` | `feat:` |
| `fix/` | `fix:` |
| `docs/` | `docs:` |
| `refactor/` | `refactor:` |

例: ブランチ `feat/issue-87` + issue タイトル「振り返りレポート付きPR作成スキル」→ `feat: 振り返りレポート付きPR作成スキル`

## ステップ 4: PR description 生成

以下のテンプレートに沿って PR description を生成する。

```markdown
## Summary

(コミット履歴と issue 内容から1-3行の概要を記述)

Closes #{issue_number}

## Implementation Notes

(implementation-deviations.md の内容を整理して記述)

- 計画からの逸脱点
- 試行錯誤した点
- 不確実性の高い箇所

※逸脱記録がない場合は以下を記述:
「計画通りに実装が完了しました。特筆すべき逸脱はありません。」

## Test Plan

(テスト関連のコミットや変更ファイルからテスト方針をまとめる)

- [ ] テスト項目

---

Generated with [Claude Code](https://claude.ai/code)
```

- Summary はコミット履歴と issue 内容を元に簡潔にまとめる
- Implementation Notes は逸脱記録を開発者が読みやすい形に整理する
- Test Plan はテスト関連の変更から自動生成し、不足があれば追記する

## ステップ 5: Push & PR 作成（確認不要）

```bash
git push -u origin {current_branch}
```

```bash
gh pr create --base develop --title "{title}" --body "{body}"
```

- base は必ず `develop`（CLAUDE.md の規約）

## ステップ 6: クリーンアップ & 通知

- 作成した PR の番号と URL を簡潔に通知する
