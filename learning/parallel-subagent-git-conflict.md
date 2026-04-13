# 並列subagent実行時のgit操作競合問題と対策

作成日: 2026-04-13

## 概要

Claude Code で複数の subagent を並列実行し、それぞれが同一 worktree 内で git commit を行うと、staging area（index）の競合が発生する。あるagentが書いたファイルが別agentのcommitに巻き込まれ、コミット履歴が崩れる問題を経験した。

## 詳細

### 発生した問題

Issue #236 の実装で Step 1, 2, 4 を3つの subagent で並列実行した際、以下が起きた:

```
時刻 T1: Step 4 agent が actions.ts, selectionColumns.tsx をディスクに書き込む
時刻 T2: Step 2 agent が ModalSearchForm.tsx をディスクに書き込む
時刻 T3: Step 2 agent が git add + git commit を実行
         → Step 4 が書いたファイルも untracked 状態でディスクに存在
         → Step 2 の commit に Step 4 のファイルも巻き込まれた
時刻 T4: Step 4 agent が commit しようとするが "already committed" と判断
```

結果: Step 2 の commit に3ファイル混入、Step 4 の commit が欠落。
修正: git reset --soft で2つの commit を巻き戻し、ファイルごとに個別に再 commit した。

### 根本原因

git の staging area（`.git/index`）はワーキングツリーごとに1つしかない。複数の subagent が同じワーキングツリーで `git add` → `git commit` を並列実行すると、他の agent が書いたファイルを意図せず stage してしまう。

### 対策

#### 対策A: commit は orchestrator（親）が行う（推奨）

計画ファイルに以下のルールを明記する:

```markdown
### 並列実行時の注意
- subagent はファイルの作成・編集のみ行い、git commit は行わない
- commit は親プロセスが各 Step のファイルを個別に stage → commit する
```

メリット: シンプル、追加設定不要
デメリット: subagent 内でテスト→commit のサイクルが回せない

#### 対策B: worktree isolation を使う

Agent ツールには `isolation: "worktree"` オプションがあり、各 subagent が独立した git worktree で作業できる。

```
Agent({
  isolation: "worktree",
  prompt: "..."
})
```

メリット: 完全に独立した環境で作業可能
デメリット: マージ作業が必要、オーバーヘッドがある

### 計画ファイルへの教訓

並列 subagent を計画する場合、「何を実装するか」だけでなく「git 操作の責任分担」も明記すべき。計画テンプレートの並列実行セクションに以下を追加するとよい:

- 各 subagent の成果物（作成・変更するファイル一覧）
- commit の実行者（subagent / orchestrator）
- 競合が起きうるファイルの有無

## 参考

- 実際に発生した Issue: #236（汎用選択モーダルによる周辺商品追加機能の実装）
- 計画ファイル: `docs/claude-plans/issue-236/plan.md`
- 逸脱記録: `docs/claude-plans/issue-236/deviations.md`
