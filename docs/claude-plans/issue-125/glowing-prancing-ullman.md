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

## テスト実行で発見された問題と修正

### 問題 1: 説明文モードで Issue 作成後に停止する

**症状:** `Skill(create-issue)` に委譲した後、create-issue スキルが完了報告して処理が終わる。Phase 1.3 以降に進まない。

**原因:** `Skill()` は子プロセスではなく、呼び出し先のプロンプトが現在のコンテキストにロードされる。create-issue が完了報告すると LLM がタスク完了と判断する。

**修正:** Phase 1.2 の Issue 作成を **インライン化** する。`Skill(create-issue)` を使わず、`gh issue create` を直接実行する。create-issue スキルのロジック（タイプ判定・ラベル付与・テンプレート選択）を auto-implement 内に簡略化して組み込む。

### 問題 2: `git reset --hard` が deny リストでブロックされる

**症状:** Phase 1.5 ② の `git reset --hard origin/develop` が `settings.json` の deny（`Bash(git reset*)`）でブロックされ、LLM が rebase → merge → reset と迷走する。

**原因:** SKILL.md が `git reset --hard` を指示しているが、プロジェクトの deny リストで禁止されている。

**修正:** ②③ を統合し、`git fetch origin develop` + `git checkout -B {type}/issue-{number} origin/develop` に置き換える。deny に引っかからず、リセットとブランチリネームを1手順で実現。ローカル develop の状態に依存しない。

---

## 修正ステップ（Step 2, 3 は完了済み）

### Step 4: SKILL.md の Phase 1.2 を修正 — Issue 作成のインライン化

**対象:** `.claude/skills/auto-implement/SKILL.md` Phase 1.2

**変更内容:**

`Skill(create-issue, args: $ARGUMENTS)` を削除し、以下のインライン処理に置き換える:

1. `$ARGUMENTS` からタイプを判定（create-issue スキルのステップ1と同じロジック）
2. タイプに応じたラベルを決定
3. `gh issue create --title "{prefix}: {title}" --label "Type: {type}" --body "{body}"` で直接作成
4. 作成された Issue の番号を出力から取得

テンプレートは create-issue のものを簡略化して使用（auto-implement では精緻なフォーマットは不要）。

### Step 5: SKILL.md の Phase 1.5 ②③ を修正 — `git checkout -B` への置き換え

**対象:** `.claude/skills/auto-implement/SKILL.md` Phase 1.5

**変更内容:**

現在の ②③:
```
② git fetch origin develop && git reset --hard origin/develop
③ git branch -m {type}/issue-{number}
```

修正後の ②（③と統合）:
```
② git fetch origin develop
   git checkout -B {type}/issue-{number} origin/develop
```

---

## 検証方法

- [ ] `/auto-implement "テスト用の説明文"` で説明文モード検証（Issue 作成後に停止せず続行すること）
- [ ] `/auto-implement {number}` で番号モード検証
- [ ] Worktree 内でブランチ名が `{type}/issue-{number}` 形式であること
- [ ] `git reset --hard` が使われていないこと（deny でブロックされないこと）

---

## 重要ファイル

| ファイル | 用途 |
|---------|------|
| `.claude/skills/auto-implement/SKILL.md` | Step 4, 5 で修正 |
| `.claude/skills/create-issue/SKILL.md` | インライン化の参照元（タイプ判定・テンプレート） |
