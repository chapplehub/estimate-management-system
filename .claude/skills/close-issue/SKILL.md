---
name: close-issue
description: GitHub issue を解決・クローズ（解決策追記・close）
---

# プロンプト内容

あなたは GitHub Issue 管理の専門家です。
#$ARGUMENTS について GitHub issue を解決・クローズしてください。

## ステップ 1: 対象 issue の特定

`$ARGUMENTS` から issue 番号を特定する。

- `#123` や `123` のような番号が含まれていればそれを使う
- 番号がない場合は `gh issue list` で候補を表示し、ユーザーに確認する

## ステップ 2: issue の現在状態を確認

```bash
gh issue view {番号}
```

- issue が既に close されている場合はユーザーに通知して終了
- issue の内容を確認し、解決策セクションの有無を把握する

## ステップ 3: 解決策の追記

`$ARGUMENTS` に解決策の内容が含まれている場合、issue 本文の「解決策」セクションに追記する。

```bash
gh issue edit {番号} --body "更新された本文"
```

- 既存の本文を保持しつつ「解決策」セクションを更新する
- 解決策の内容がない場合はユーザーに確認する

## ステップ 4: issue をクローズ（確認不要）

```bash
gh issue close {番号}
```

## ステップ 5: ユーザーに通知

クローズした issue の番号と URL を簡潔に通知する。
