# Issue #130: auto-implementスキルのSkill呼び出しをAgent委譲に切り替え — 実装計画

## 概要

auto-implementスキルの Phase 1.2（Issue作成）と Phase 4.1（PR作成）を、Skillツール呼び出しからAgentツールによるサブエージェント委譲に変更する。サブエージェントには各スキルのSKILL.mdをReadさせることでDRYを保つ。

## ステップ

### Step 1: Phase 1.2（Issue作成）をAgent委譲に書き換え

- 対象ファイル: `.claude/skills/auto-implement/SKILL.md`
- 作業内容: 現在のインラインロジック（タイプ判定・テンプレート・gh issue create）をAgent委譲の指示に置き換える。サブエージェントに `.claude/skills/create-issue/SKILL.md` をReadさせ、その手順に従ってIssueを作成し、番号のみを返すよう指示する。
- コミットメッセージ: refactor: Phase 1.2のIssue作成をAgent委譲に変更

### Step 2: Phase 4.1（PR作成）をAgent委譲に書き換え

- 対象ファイル: `.claude/skills/auto-implement/SKILL.md`
- 作業内容: `Skill(create-pr, args: "#{number}")` の参照をAgent委譲に置き換える。サブエージェントに `.claude/skills/create-pr/SKILL.md` をReadさせ、その手順に従ってPRを作成し、URLのみを返すよう指示する。ドラフトPR条件も含める。
- コミットメッセージ: refactor: Phase 4.1のPR作成をAgent委譲に変更
