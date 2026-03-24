---
name: auto-implement
description: 既存Issue番号を指定して実装→PR作成を自動実行する。ユーザーが作成済みの worktree 内から実行する。
user-invocable: true
---

# プロンプト内容

あなたは全自動実装エージェントです。
`$ARGUMENTS`（Issue 番号）を入力として、実装計画 → 実装 → テスト → PR 作成まで全工程を自動実行してください。

**重要な前提条件:**
- このスキルは **ユーザーが作成済みの worktree 内から実行する**（worktree・ブランチは事前に準備済み）
- ユーザーへの確認は行わない（全工程を自動実行する）

---

## Phase 1: 入力解析 & Issue 情報取得

### 1.1 入力解析 & Issue 情報取得

`$ARGUMENTS` から Issue 番号を取得し、Issue 情報を取得する。

**入力フォーマット:**

| 入力例 | 処理 |
|--------|------|
| `#123` or `123`（数字のみ） | そのまま Issue 番号として使用 |
| 上記以外 | エラー: 「Issue 番号を指定してください（例: `/auto-implement 123`）」と表示して終了 |

**Issue 情報の取得:**

```bash
gh issue view {number} --json title,body,labels
```

- 取得した `title` と `body` は Phase 2（計画作成）で使用する
- Issue が存在しない場合はエラーメッセージを表示して終了する

---

## Phase 2: Planning

### 2.1 コードベース調査

- Issue の実装タスク・受け入れ条件を分析する
- 関連するコードを調査する（既存パターン・類似実装の把握）
- CLAUDE.md の DDD レイヤリングルールを確認する

### 2.2 実装計画の作成 & 保存

- 計画ファイルを `docs/claude-plans/issue-{number}/plan.md` に保存する
- 各ステップは **「1コミット単位」** で設計する（CLAUDE.md 規約: "Commit at each plan step"）
- 計画をユーザーに表示する（確認は求めない — 自動承認）

計画ファイルを作成したら、実装開始前にコミットする:

```bash
git add docs/claude-plans/issue-{number}/plan.md
git commit -m "docs: Issue #{number} の実装計画を作成"
```

計画ファイルのフォーマット:

```markdown
# Issue #{number}: {title} — 実装計画

## 概要
{Issue の要約}

## ステップ

### Step 1: {ステップタイトル}
- 対象ファイル: {ファイルパス}
- 作業内容: {具体的な作業}
- コミットメッセージ: {prefix}: {内容}

### Step 2: ...
```

---

## Phase 3: Implementation

### 3.1 ステップごとの実装

計画の各ステップを順に実装する。各ステップ完了時に:

```bash
git add {変更ファイル}
git commit -m "{コミットメッセージ}"
```

**遵守事項:**
- DDD レイヤリングルール（Domain 層に外部依存を入れない等）
- CLAUDE.md に記載されたすべての規約
- 計画からの逸脱があれば `docs/claude-plans/issue-{number}/deviations.md` に記録する

逸脱記録のフォーマット:

```markdown
# 計画からの逸脱記録

## 逸脱 1: {タイトル}
- **計画**: {元の計画内容}
- **実際**: {実際の実装内容}
- **理由**: {逸脱の理由}
```

### 3.2 検証

**lint チェック:**

```bash
pnpm lint
```

- 失敗時: 自動修正 → 再コミット

**テスト実行:**

```bash
pnpm test
```

- 失敗時: 修正 → 再コミット
- **3回以上の修正ループに入った場合**: エラーとして Phase 4 に進む（ドラフト PR として作成）

---

## Phase 4: Delivery

### 4.1 PR 作成

`Skill(create-pr, args: "#{number}")` で PR 作成を委譲する。

- create-pr は `context: fork` により自動的にサブエージェントとして実行される
- lint/test が通らなかった場合: `Skill(create-pr, args: "--draft #{number}")` でドラフト PR を作成する
- 返却値から PR URL を取得して最終報告に使用する

### 4.2 最終報告

以下のフォーマットで簡潔に報告する:

```
✅ 自動実装が完了しました

📋 Issue: #{number} {title}
🔗 PR: {PR URL}
📝 変更: {変更ファイル数} files changed
🌿 Branch: {現在のブランチ名}

💡 修正が必要な場合はそのまま指示してください（修正 → commit → push で PR に反映されます）。
```

---

## エラーハンドリング

| レベル | シナリオ | 対応 |
|--------|----------|------|
| 軽微 | lint 失敗 | 自動修正 → 再コミット |
| 中程度 | test 失敗 | 最大3回修正試行 → 失敗ならドラフト PR |
| 重大 | 実装不能（設計判断が必要等） | 進捗をコミット → ドラフト PR → 問題点を PR コメントに記載 |
| 致命的 | Issue 取得失敗等 | エラーメッセージを表示して終了 |
