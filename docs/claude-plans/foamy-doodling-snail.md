# Issue #130: auto-implement スキルをオーケストレーター型に変更

## Context

auto-implement スキルは Issue 作成 → 実装 → PR 作成を全自動化するオーケストレーターだが、サブタスク（create-issue, create-pr）の呼び出しに「Agent + Read SKILL.md」というハックを使っている。これを Claude Code の正式機能で置き換える。

**採用する2つのパターン:**

| パターン | 用途 | 例 |
|---------|------|-----|
| `context: fork` | スキルの内容 = タスクそのもの | create-issue, create-pr |
| Subagent + `skills` field | スキルの内容 = 知識・ガイドライン | ddd-architecture, testing-backend |

`context: fork` は常に fork で動作する（ユーザー直接呼び出し時も fork）。create-issue / create-pr は自己完結型タスクなので問題ない。

## ステップ

### Step 1: create-issue に `context: fork` を追加し非対話化

- 対象ファイル: `.claude/skills/create-issue/SKILL.md`
- 作業内容:
  - フロントマターに `context: fork` を追加
  - ステップ 2: 「ラベルが存在しない場合はユーザーに確認する」→「ラベルなしで作成する（確認不要）」に変更
  - ステップ 6: 返却値として Issue 番号と URL を返す旨を明記
- コミットメッセージ: `refactor: create-issueスキルにcontext: forkを追加し非対話化`

### Step 2: create-pr に `context: fork` を追加し非対話化

- 対象ファイル: `.claude/skills/create-pr/SKILL.md`
- 作業内容:
  - フロントマターに `context: fork` を追加
  - ステップ 1: 「ユーザーに確認する」→「エラーとして処理を終了し、理由を返す」に変更
  - ステップ 5: `$ARGUMENTS` に `--draft` が含まれている場合は `gh pr create --draft` を使用する旨を追加
- コミットメッセージ: `refactor: create-prスキルにcontext: forkを追加し非対話化`

### Step 3: auto-implement Phase 1.2 を Skill 呼び出しに変更

- 対象ファイル: `.claude/skills/auto-implement/SKILL.md`
- 作業内容: Agent + Read ハックを Skill ツール呼び出しに置き換え
  ```
  Skill(create-issue, args: "{$ARGUMENTS の内容}")
  → context: fork により自動的にサブエージェントとして実行
  → 返却値から Issue 番号を抽出して処理を継続
  ```
- コミットメッセージ: `refactor: auto-implement Phase 1.2をSkill呼び出しに変更`

### Step 4: auto-implement Phase 4.1 を Skill 呼び出しに変更

- 対象ファイル: `.claude/skills/auto-implement/SKILL.md`
- 作業内容: Agent + Read ハックを Skill ツール呼び出しに置き換え
  ```
  Skill(create-pr, args: "#{number}")
  → lint/test 失敗時は args に --draft を追加
  → 返却値から PR URL を取得して最終報告に使用
  ```
- コミットメッセージ: `refactor: auto-implement Phase 4.1をSkill呼び出しに変更`

### Step 5（将来・別Issue）: implementer サブエージェントの作成

- 対象ファイル: `.claude/agents/implementer.md`（新規作成）
- 作業内容: `skills: [ddd-architecture, testing-backend]` を持つサブエージェント定義を作成し、auto-implement Phase 2+3 を委譲
- このステップは本 PR のスコープ外。別 Issue として管理する。

## 検証方法

1. `/create-issue テスト用Issue` → fork コンテキストで Issue が作成され、番号と URL が返ること
2. `/create-pr #xxx` → fork コンテキストで PR が作成され、URL が返ること
3. `/auto-implement 説明文` → Phase 1.2 で Skill(create-issue) が fork 実行され、番号取得後に処理が継続すること
4. `/auto-implement #xxx` → Phase 4.1 で Skill(create-pr) が fork 実行され、PR URL を含む最終報告が出ること
