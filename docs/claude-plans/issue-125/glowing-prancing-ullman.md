# Issue #125: /auto-implement スキル作成 — 実装計画

## Context

軽微な実装の全自動化スキル `/auto-implement` を作成する。Issue URL・番号・説明文を渡すだけで、Issue作成（必要時）→ Worktree作成 → 実装計画 → 実装 → テスト → PR作成まで全工程を自動実行する。

元の Issue #125 の11ステップ計画をレビューし、以下の改善を反映した最終計画:
- 11ステップ → **4フェーズ構成**に再編（LLM の追跡性向上）
- **複雑度ゲート**を追加（自動実装に適さない Issue の早期検出）
- **環境セットアップ**を明記（`wta` シェル関数の [1/6]〜[5/6] に相当する処理）
- **`settings.local.json` 更新**を明記（plansDirectory の設定）
- **エラーハンドリング**を4段階で定義
- **PR作成後も worktree に留まる**（修正指示にそのまま対応可能）
- **メインリポジトリからの実行制約**を明記

### 制約事項

- **メインリポジトリから実行必須**: EnterWorktree は「既に worktree 内にいると使えない」制約がある。`/auto-implement` は必ずメインリポジトリから実行する必要がある。
- **Worktree 作成場所**: EnterWorktree は `.claude/worktrees/` に作成する（`wta` の `worktrees/` とは異なる）。ただし `wtr {branch}` はブランチ名ベースで探索するため、削除は問題なく動作する。

---

## 成果物（残作業）

Step 1 の SKILL.md 作成は完了済み。以下の2点を追加対応する:

1. **`.claude/settings.json`** — 未コミット plan ファイル検出リマインドフックを追加
2. **`.claude/skills/auto-implement/SKILL.md`** — Phase 2 に計画ファイルのコミット指示を追加

---

## 完了済み: SKILL.md の設計

### フロントマター

```yaml
---
name: auto-implement
description: Issue→実装→PR全自動化。Issue URL/番号/説明文を渡すだけで全工程を自動実行する。
user-invocable: true
---
```

### Phase 1: Input & Setup

**1.1 入力解析** — `$ARGUMENTS` を解析し3モードを判定:
- URL（`https://github.com/.../issues/123`）→ 番号抽出
- 番号（`#123` or `123`）→ そのまま使用
- 説明文（上記以外）→ 1.2 で Issue 作成

**1.2 Issue 作成（説明文モードのみ）**
- `Skill(create-issue, args: $ARGUMENTS)` で委譲
- 作成された Issue 番号を `gh issue list --limit 1 --json number` 等で取得

**1.3 Issue 情報取得 & ブランチタイプ判定**
- `gh issue view {number} --json title,body,labels` で取得
- ラベル → ブランチタイプ対応:
  - `Type: enhancement` → `feat`
  - `Type: bug` → `fix`
  - `Type: refactor` → `refactor`
  - `Type: documentation` → `docs`
  - その他 / ラベルなし → `feat`（デフォルト）

**1.4 複雑度チェック**
- Issue 内容を分析し、以下に該当する場合は **中断を推奨**:
  - DB スキーマ変更・マイグレーションが必要
  - 3つ以上のサブドメインにまたがる変更
  - 明示的に「大規模」「段階的」等のキーワードがある
- 中断時: Issue の情報と手動実装の手順（`wta` コマンド等）を出力して終了

**1.5 Worktree 作成 & 環境セットアップ**

以下の順序で実行（`wta` シェル関数の処理を再現）:

```
① EnterWorktree
   → Claude Code が worktree を作成（現在のHEADベース、自動生成ブランチ名）

② git fetch origin develop && git reset --hard origin/develop
   → リモートの最新 develop を起点にリセット

③ git branch -m {type}/issue-{number}
   → ブランチリネーム（例: feat/issue-126）

④ pnpm install && pnpm db:generate
   → 依存関係インストール & Prisma クライアント生成

⑤ .claude/settings.local.json に書き込み:
   { "plansDirectory": "docs/claude-plans/issue-{number}" }
   → /create-pr スキルと pre-commit フックが計画ファイルを参照できるようにする

⑥ docs/claude-plans/issue-{number}/ ディレクトリを作成
   → 計画ファイルの保存先を確保
```

**注意:** plan モードは使用しない。計画ファイルは Phase 2 でスキル自身が直接作成・保存する。保存先は plansDirectory と同じなので、`/create-pr` スキルが正しく読み取れる。

### Phase 2: Planning

**2.1 コードベース調査**
- Issue の実装タスク・受け入れ条件を分析
- 関連するコードを調査（既存パターン・類似実装の把握）
- DDD レイヤリングルール（CLAUDE.md）を確認

**2.2 実装計画の作成 & 保存**
- `docs/claude-plans/issue-{number}/` に計画ファイル（`.md`）を保存
- 各ステップは「1コミット単位」で設計（CLAUDE.md 規約: "Commit at each plan step"）
- 計画をユーザーに表示（自動承認 — 確認は求めない）

### Phase 3: Implementation

**3.1 ステップごとの実装**
- 計画の各ステップを順に実装
- 各ステップ完了時に `git add` → `git commit`
- DDD レイヤリングルールを遵守（Domain 層に外部依存を入れない等）
- 計画からの逸脱があれば `docs/claude-plans/issue-{number}/deviations.md` に記録

**3.2 検証**
- `pnpm lint` 実行 → 失敗時は修正してコミット
- `pnpm test` 実行 → 失敗時は修正してコミット
- 3回以上の修正ループに入った場合はエラーとして Phase 4 に進む（ドラフト PR）

### Phase 4: Delivery

**4.1 PR 作成**
- `Skill(create-pr, args: "#{number}")` で委譲
- lint/test が通らなかった場合: PR を `--draft` で作成するよう指示

**4.2 最終報告**
- Issue URL、PR URL、変更概要、変更ファイル数を簡潔に報告
- **ExitWorktree は呼ばない** — PR作成後もセッションは worktree 内に留まる
- ユーザーはそのまま修正指示を出せる（修正 → commit → push で PR に反映）
- worktree の後片付けは `wtr {type}/issue-{number}` で手動削除（通常の開発フローと同じ）

### エラーハンドリング

| レベル | シナリオ | 対応 |
|--------|----------|------|
| 軽微 | lint 失敗 | 自動修正 → 再コミット |
| 中程度 | test 失敗 | 最大3回修正試行 → 失敗ならドラフト PR |
| 重大 | 実装不能（設計判断が必要等） | 進捗をコミット → ドラフト PR → 問題点を PR コメントに記載 |
| 致命的 | Worktree 作成失敗等 | エラーメッセージを表示して終了 |

---

## 実装ステップ

### Step 1: `.claude/skills/auto-implement/SKILL.md` を作成 ✅ 完了

### Step 2: `.claude/settings.json` に未コミット plan ファイル検出フックを追加

既存の「逸脱記録リマインド」フック（L119-127）と同じ構造で、新しい PreToolUse(Bash) フックを追加する。

**トリガー:** `git commit` コマンド実行時
**動作:**
1. `.claude/settings.local.json` から `plansDirectory` を取得
2. `git status --porcelain {plansDirectory}` で未コミットファイルを検出
3. 未コミットファイルがあればリマインドメッセージを表示（`exit 0` — ブロックしない）

**出力メッセージ:**
```
📋 注意: {plansDirectory} に未コミットのファイルがあります。計画ファイルも一緒にコミットしてください。
```

**配置場所:** `settings.json` の `PreToolUse` 配列の末尾（既存の逸脱記録フックの直後）

### Step 3: `.claude/skills/auto-implement/SKILL.md` の Phase 2 に計画ファイルコミット指示を追加

Phase 2.2 の末尾に以下を追加:

```
計画ファイルを作成したら、実装開始前にコミットする:
git add docs/claude-plans/issue-{number}/plan.md
git commit -m "docs: Issue #{number} の実装計画を作成"
```

---

## 検証方法

- [ ] `/auto-implement https://github.com/chapplehub/estimate-management-system/issues/{test-issue}` で URL モード検証
- [ ] `/auto-implement {number}` で番号モード検証
- [ ] `/auto-implement "テスト用の説明文"` で説明文モード検証
- [ ] Worktree 内で `settings.local.json` に正しい plansDirectory が設定されることを確認
- [ ] 計画ファイルが `docs/claude-plans/issue-{number}/` に保存されることを確認
- [ ] 作成された PR に実装計画と逸脱記録が含まれることを確認
- [ ] ブランチ名が `{type}/issue-{number}` 形式であることを確認
- [ ] エラー時にドラフト PR が作成されることを確認

---

## 重要ファイル

| ファイル | 用途 |
|---------|------|
| `.claude/skills/auto-implement/SKILL.md` | ✅ 作成済み → Step 3 で修正 |
| `.claude/settings.json` | Step 2 でフック追加（L119-127 の逸脱記録フックの直後） |
| `.claude/skills/create-issue/SKILL.md` | 委譲先（参考: skill-to-skill パターン） |
| `.claude/skills/create-pr/SKILL.md` | 委譲先（参考: plansDirectory 読み取り処理） |
| `.claude/settings.local.json` | plansDirectory 設定（worktree 内で更新される） |
