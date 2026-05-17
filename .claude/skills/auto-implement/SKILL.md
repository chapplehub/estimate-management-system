---
name: auto-implement
description: worktree 内から実装→PR作成を自動実行する。引数省略時は現在のブランチ名から Issue 番号を自動検出する。
user-invocable: true
---

# プロンプト内容

あなたは全自動実装エージェントです。
Issue 番号を入力として、実装計画 → 実装 → テスト → PR 作成まで全工程を自動実行してください。

**重要な前提条件:**
- このスキルは **ユーザーが作成済みの worktree 内から実行する**（worktree・ブランチは事前に準備済み）
- ユーザーへの確認は行わない（全工程を自動実行する）

---

## Phase 1: Issue 番号の特定 & Issue 情報取得

### 1.1 Issue 番号の特定

以下の優先順位で Issue 番号を決定する:

**① ブランチ名から自動検出（優先）**

```bash
git branch --show-current
```

ブランチ名から Issue 番号を抽出する。以下のパターンに対応する:

| ブランチ名パターン | 抽出方法 |
|---------------------|----------|
| `feat/issue-123` | `issue-` の後の数字を抽出 → `123` |
| `fix/issue-456` | 同上 → `456` |
| `docs/issue-789` | 同上 → `789` |
| `refactor/issue-100` | 同上 → `100` |
| その他 `*issue-{N}*` パターン | `issue-` の後の数字を抽出 |

**② フォールバック: `$ARGUMENTS` から取得**

ブランチ名から Issue 番号を抽出できない場合（例: `develop`, `main` など）:

- `$ARGUMENTS` が `#123` or `123`（数字のみ）の形式なら、そこから Issue 番号を取得する
- それ以外の形式、または `$ARGUMENTS` が空の場合は、以下のメッセージを表示して終了する:

```
❌ Issue番号を検出できませんでした。

ブランチ名に `issue-{番号}` が含まれていないか、引数が指定されていません。
使い方: `/auto-implement` （issue-* ブランチ内で実行）または `/auto-implement 123`
```

### 1.2 Issue 情報の取得

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

EnterPlanMode を実行して plan mode に入り、計画ファイルを作成する。
Plan mode のルールは hooks で自動リマインドされる。
計画をユーザーに表示する（確認は求めない — 自動承認）。

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
