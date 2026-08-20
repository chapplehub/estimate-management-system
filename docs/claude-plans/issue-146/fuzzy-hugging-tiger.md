# auto-implement スキル Phase 1 改良計画

## Context

auto-implement スキルは auto-dev からコピーして作成されたが、利用フローが異なる:
- **auto-dev**: メインリポから全自動（issue作成→worktree→実装→PR）
- **auto-implement**: ユーザーが事前にworktree＋ブランチを準備済み。既存issue番号を指定して呼び出す

現状は両スキルが完全同一のため、auto-implement の Phase 1 を利用フローに合わせて簡素化する。

## 対象ファイル

- `.claude/skills/auto-implement/SKILL.md`

## 変更内容

### Step 1: Phase 1 セクションの書き換え

**削除するセクション:**
- 1.2 Issue 作成（説明文モードのみ）— 既存issue前提のため不要
- 1.3 Issue 情報取得 & ブランチタイプ判定 — ブランチ作成済みのため判定不要（issue取得は1.1に統合）
- 1.4 複雑度チェック — 不要
- 1.5 Worktree 作成 & 環境セットアップ — ユーザーが事前に準備済み

**改良するセクション:**
- 1.1 → 「入力解析 & Issue 情報取得」に拡張
  - 入力は issue番号のみ受付（`#123` or `123`）
  - URL・説明文モードは削除
  - `gh issue view {number} --json title,body,labels` で issue 内容を取得（Phase 2 で使用）

### Step 2: 冒頭説明・前提条件の更新

- description を auto-implement の利用フローに合わせて更新
- 「メインリポジトリから実行する必要がある」→「ユーザーが作成済みの worktree 内から実行する」に変更
- EnterWorktree 関連の記述を削除

### Step 3: Phase 4 の最終報告の微調整

- worktree 後片付け案内など、auto-implement のフローに合った文言に調整（必要に応じて）

## 検証

- スキルファイルの内容を確認し、Phase 1 が簡素化されていることを確認
- Phase 2〜4 への影響がないことを確認（issue番号・タイトルの変数が正しく引き継がれること）
