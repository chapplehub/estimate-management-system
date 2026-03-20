---
name: auto-implement
description: Issue→実装→PR全自動化。Issue URL/番号/説明文を渡すだけで全工程を自動実行する。
user-invocable: true
---

# プロンプト内容

あなたは全自動実装エージェントです。
`$ARGUMENTS` を入力として、Issue 作成（必要時）→ Worktree 作成 → 実装計画 → 実装 → テスト → PR 作成まで全工程を自動実行してください。

**重要な前提条件:**
- このスキルは **メインリポジトリから実行する必要がある**（EnterWorktree は worktree 内では使用不可）
- ユーザーへの確認は行わない（全工程を自動実行する）

---

## Phase 1: Input & Setup

### 1.1 入力解析

`$ARGUMENTS` を解析し、以下の3モードを判定する:

| モード | 判定条件 | 処理 |
|--------|----------|------|
| URL | `https://github.com/.../issues/123` 形式 | URL から番号を抽出 |
| 番号 | `#123` or `123`（数字のみ） | そのまま使用 |
| 説明文 | 上記以外 | 1.2 で Issue を作成 |

### 1.2 Issue 作成（説明文モードのみ）

Agent ツールを使用してサブエージェントに Issue 作成を委譲する:

- **description:** `"Create GitHub issue"`
- **prompt:**

```
まず `.claude/skills/create-issue/SKILL.md` を Read で読み、その手順に従って GitHub Issue を作成してください。

作成する内容: {$ARGUMENTS}

重要:
- SKILL.md の手順（タイプ判定・ラベルチェック・テンプレート選択）に従うこと
- ユーザーへの確認は不要（そのまま作成する）
- 作成後、Issue 番号（数字のみ）だけを返すこと（他の説明は不要）
```

Agent の返却値から Issue 番号を取得して処理を継続する。

### 1.3 Issue 情報取得 & ブランチタイプ判定

```bash
gh issue view {number} --json title,body,labels
```

ラベルからブランチタイプを決定する:

| ラベル | ブランチタイプ |
|--------|---------------|
| `Type: enhancement` | `feat` |
| `Type: bug` | `fix` |
| `Type: refactor` | `refactor` |
| `Type: documentation` | `docs` |
| その他 / ラベルなし | `feat`（デフォルト） |

### 1.4 複雑度チェック

Issue 内容を分析し、以下に **いずれか** 該当する場合は **中断を推奨** する:

- DB スキーマ変更・マイグレーションが必要（Prisma schema の変更）
- 3つ以上のサブドメインにまたがる変更
- 明示的に「大規模」「段階的」「フェーズ」等のキーワードがある

**中断時の出力:**
```
⚠️ このIssueは自動実装に適さない可能性があります。
理由: {該当する理由}

手動実装の手順:
  1. wta {type}/issue-{number}
  2. 実装
  3. /create-pr #{number}
```
中断時はここで処理を終了する。

### 1.5 Worktree 作成 & 環境セットアップ

以下の順序で実行する:

**① EnterWorktree でワークツリーを作成**

EnterWorktree を実行する。Claude Code が `.claude/worktrees/` に worktree を作成する。

**② リモートの最新 develop を起点にブランチ作成**

```bash
git fetch origin develop
git checkout -B {type}/issue-{number} origin/develop
```

例: `feat/issue-126`

> `git reset --hard` は deny リストでブロックされるため使用しない。
> `checkout -B` でリセットとブランチリネームを1手順で実現する。

**③ 依存関係インストール & Prisma クライアント生成**

```bash
pnpm install && pnpm db:generate
```

**④ settings.local.json の設定**

`.claude/settings.local.json` に以下を書き込む:

```json
{
  "plansDirectory": "docs/claude-plans/issue-{number}"
}
```

**⑤ 計画ディレクトリの作成**

```bash
mkdir -p docs/claude-plans/issue-{number}
```

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

Agent ツールを使用してサブエージェントに PR 作成を委譲する:

- **description:** `"Create pull request"`
- **prompt:**

```
まず `.claude/skills/create-pr/SKILL.md` を Read で読み、その手順に従って PR を作成してください。

対象 Issue: #{number}
{lint/test が通らなかった場合は以下を追記: ドラフト PR として作成すること（--draft フラグを使用）}

重要:
- SKILL.md の手順（コンテキスト収集・タイトル生成・description生成）に従うこと
- ユーザーへの確認は不要（そのまま作成する）
- 作成後、PR の URL のみを返すこと（他の説明は不要）
```

Agent の返却値から PR URL を取得して最終報告に使用する。

### 4.2 最終報告

以下のフォーマットで簡潔に報告する:

```
✅ 自動実装が完了しました

📋 Issue: #{number} {title}
🔗 PR: {PR URL}
📝 変更: {変更ファイル数} files changed
🌿 Branch: {type}/issue-{number}

💡 このセッションは worktree 内に留まっています。
   修正が必要な場合はそのまま指示してください（修正 → commit → push で PR に反映されます）。
   worktree の後片付け: wtr {type}/issue-{number}
```

---

## エラーハンドリング

| レベル | シナリオ | 対応 |
|--------|----------|------|
| 軽微 | lint 失敗 | 自動修正 → 再コミット |
| 中程度 | test 失敗 | 最大3回修正試行 → 失敗ならドラフト PR |
| 重大 | 実装不能（設計判断が必要等） | 進捗をコミット → ドラフト PR → 問題点を PR コメントに記載 |
| 致命的 | Worktree 作成失敗等 | エラーメッセージを表示して終了 |
