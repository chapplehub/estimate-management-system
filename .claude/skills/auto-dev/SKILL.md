---
name: auto-dev
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

`Skill(create-issue, args: "{$ARGUMENTS の内容}")` で Issue 作成を委譲する。

- create-issue は `context: fork` により自動的にサブエージェントとして実行される
- 返却値から Issue 番号を抽出して処理を継続する

### 1.3 Issue 情報取得 & ブランチタイプ判定

```bash
gh issue view {number} --json title,body,labels
```

`.claude/references/commit-types.md` のマッピングテーブルを参照し、ラベル（`label` 列）からブランチタイプ（`branch` 列）を決定する。
`branch` が `—` のタイプ、またはラベルなしの場合は `feat`（デフォルト）を使用する。

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

**② ベースブランチ修正 & ファイルコピー（自動）**

EnterWorktree の `PostToolUse` hook により、以下が自動実行される（手動実行不要）:
- `worktree-fix-base-branch.sh`: origin/main → origin/develop へのリセット
- `worktree-copy-includes.sh`: `.worktreeinclude` に記載されたファイルのコピー

> **なぜ hook か**: `git reset --hard` は sandbox の Mandatory Deny Paths（`.claude/` 等）への書き込みがブロックされるため、sandbox 外で実行される hook で処理する。

**③ 作業ブランチ作成**

```bash
git checkout -B {type}/issue-{number}
```

例: `feat/issue-126`

**④ 依存関係インストール & Prisma クライアント生成**

```bash
pnpm install && pnpm db:generate
```

**⑤ settings.local.json の plansDirectory を更新**

②でコピー済みの `.claude/settings.local.json` の `plansDirectory` のみを更新する:

```bash
if [ -f .claude/settings.local.json ]; then
    jq --arg dir "docs/claude-plans/issue-{number}" '.plansDirectory = $dir' \
      .claude/settings.local.json > .claude/settings.local.json.tmp \
      && mv .claude/settings.local.json.tmp .claude/settings.local.json
else
    mkdir -p .claude
    echo '{"plansDirectory": "docs/claude-plans/issue-{number}"}' > .claude/settings.local.json
fi
```

**⑥ 計画ディレクトリの作成**

```bash
mkdir -p docs/claude-plans/issue-{number}
```

---

## Phase 2: Planning

### 2.1 コードベース調査

- Issue の実装タスク・受け入れ条件を分析する
- 関連するコードを調査する（既存パターン・類似実装の把握）
- CLAUDE.md の DDD レイヤリングルールを確認する

### 2.2 計画ファイル名の決定

Issue タイトルから計画ファイル名を決定する。CLAUDE.md の Plan file naming ルールに従うこと:

- フォーマット: `docs/claude-plans/issue-{number}/{kebab-case-description}.md`
- Issue タイトルの内容を英語の kebab-case で要約する（例: `implement-customer-list.md`, `add-column-constraints.md`）
- `plan.md` のような汎用名は使わない

### 2.3 実装計画の作成 & 保存

- 計画ファイルを `docs/claude-plans/issue-{number}/{plan-file-name}.md` に保存する
- `docs/claude-plans/PLAN_TEMPLATE.md` のフォーマットに従うこと（概要・設計判断・ステップの各セクションを含む）
- 各ステップは **「1コミット単位」** で設計する（CLAUDE.md 規約: "Commit at each meaningful change"）
- 計画をユーザーに表示する（確認は求めない — 自動承認）

計画ファイルを作成したら、実装開始前にコミットする:

```bash
git add docs/claude-plans/issue-{number}/{plan-file-name}.md
git commit -m "docs: Issue #{number} の実装計画を作成"
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
