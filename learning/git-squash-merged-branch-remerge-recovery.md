# スカッシュマージ済みブランチの再マージから始まる git 事故と復旧

作成日: 2026-07-25

## 概要

`git push` が弾かれたときの復旧手順を誤り、状態を段階的に悪化させた事故の記録。

push 失敗時点では `git pull --rebase` 一発（コンフリクトゼロ）で解決できていた。しかし
「リモートの変更を取り込む」つもりで**スカッシュマージ済みの feature ブランチを再マージ**したため、
重複コミット 9 個が `develop` に流入。その後の `pull --rebase` が全件衝突し、
さらに `revert` で直そうとして 1 手余分に悪化させた。

最終的な復旧は `git rebase --abort` + `git reset --hard origin/develop` で、**失ったものはゼロ**。
ローカル `develop` の内容は最初から `origin/develop` と完全に一致していた。

根本原因（スカッシュマージによる divergence）は [git-worktree-squash-merge-divergence.md](git-worktree-squash-merge-divergence.md)
と同じだが、そちらは「develop に元コミットが残る」パターン。本ノートは「**マージ済みブランチを再度マージしてしまう**」パターン。

## 詳細

### 事故の経過（reflog）

下から上へ読む。`HEAD@{10}` の push 失敗が起点。

```
c64ad416 (HEAD -> develop, origin/develop, origin/HEAD) HEAD@{0}: commit: agent: claude doctor 実行
faf36034 HEAD@{1}: reset: moving to origin/develop                    ← ★復旧（案A）
fcad46fa HEAD@{2}: checkout: moving from develop to develop
fcad46fa HEAD@{3}: rebase (abort): returning to refs/heads/develop    ← ★復旧（案A）
c4bc380f HEAD@{4}: rebase (continue): revert: コンフリクト解消         ← ✗ マーカーごとコミット
4100d9f2 HEAD@{5}: commit: docs: issue-635 の実装計画を追加
e9d81f69 HEAD@{6}: pull --rebase (pick): agent: claude doctor実行
faf36034 HEAD@{7}: pull --rebase (start): checkout faf360342b82dc4d42521c53aa7fe044d1c13a36
fcad46fa HEAD@{8}: revert: revert: リモートが変更されているのにプッシュしようとしたのでリベート  ← ✗ 無意味
ee2deac6 HEAD@{9}: commit (merge): refactor: git merge refactor/issue-635  ← ✗✗ 致命傷
aea450f3 HEAD@{10}: commit: agent: claude doctor実行                   ← ここで push 失敗
e2fb249c HEAD@{11}: commit: docs: # Server Action の実体は next-action ヘッダ付き POST fetch — ...
```

### 起点（HEAD@{10}）: 実は 30 秒で解決できた

push 失敗時点の three-way の材料：

| | コミット | 触ったファイル |
|---|---|---|
| 分岐点 | `e2fb249c` | — |
| ローカル側 | `aea450f3` | **`CLAUDE.md` のみ**（11行削除） |
| リモート側 | `faf36034` (PR #636) | 14ファイル（`src/**`, `docs/adr/**`, `docs/claude-plans/issue-635/**`）— `CLAUDE.md` を含まない |

**重なるファイルが 1 つもない。** この時点で `git pull --rebase` を打てばコンフリクトゼロで完了していた。
（素の merge でも通る。マージコミットが 1 つ増えるだけの違い）

### `git pull` が「できなかった」の正体

`pull.rebase` 未設定のため、分岐状態で無指定の `git pull` を打つとこうなる（Git 2.27+）：

```
fatal: Need to specify how to reconcile divergent branches.
hint:   git config pull.rebase false  # merge
hint:   git config pull.rebase true   # rebase
```

**これは失敗ではなく「merge と rebase のどちらにするか決めろ」という確認。**
`fatal:` で始まるため不可能に見えるが、`git pull --rebase` と打ち直せばその場で終わっていた。

### HEAD@{9}: 致命傷 — マージ先の取り違え

「リモートの変更を取り込もう」という意図に対して、実行されたのはこれ：

```bash
git merge refactor/issue-635      # ← origin/develop ではなくローカル feature ブランチ
```

`refactor/issue-635` は既に PR #636 として**スカッシュマージ済み**（`faf36034`。親が 1 つ = squash の証拠）。
そこへスカッシュ前の粒コミット 9 個を `develop` に流し込んだ結果、
**同じ変更が 2 つの異なる形（squash 済み 1 個 / 粒 9 個）で存在する**状態になった。

この後の `pull --rebase` は 11 コミットを replay しようとし、うち 9 個が upstream の
squash 済み内容と正面衝突する。コンフリクト爆発の正体はこれ。

> rebase は「未取り込みのコミット」を機械的に replay するだけで、内容の重複を判定しない。
> スカッシュマージで元コミットとの同一性が失われているため、git には「既に入っている」と気づく手がかりがない。

### HEAD@{8}: revert では直らなかった理由

`revert` を「コミットを打ち消してやり直すコマンド」と認識していたが、これは誤り。

- **revert が直せるもの**: ファイルの中身（内容）
- **revert が絶対に直せないもの**: コミットの並び、分岐状態、重複コミットの存在（履歴の形）

今回壊れていたのは**履歴の形**。実際 `fcad46fa` の revert は `CLAUDE.md` の 11 行を戻しただけで、
**重複コミット 9 個は 1 つも消えていない**。むしろ replay 対象が 10 → 11 個に増え、状況を悪化させた。

正しい整理：

> revert は「共有済み履歴の *内容* を取り消す」道具。
> 「自分の履歴の *形* をやり直す」道具ではない。

「先に進むことしかできない」という revert の制約は、push 済みコミットのバグ取り消し
（他人が既に pull している）では**唯一の安全な手段**という利点に転じる。制約自体が悪いのではなく、用途の取り違えだった。

なお `fcad46fa` のメッセージは「リベートするために元に戻す」だったが、
**rebase の前に手動で変更を戻す必要はない**。rebase は開始時に作業ツリーを自動退避し、完了後に載せ直す。

### HEAD@{4}: コンフリクトマーカーをそのままコミット

`revert: コンフリクト解消` というコミットに、マーカーが残ったまま入っていた：

```markdown
<<<<<<< HEAD
- [x] **完了**
=======
- [ ] **完了**
>>>>>>> b27808fa (docs: issue-635 の実装計画を追加)
```

rebase を完走させても壊れたコミットが履歴に残るため、続行は選べない状態になっていた。

### 診断: `git cherry` は嘘をつく、`git diff` は嘘をつかない

復旧方針を決めた決定打はこれ：

```bash
$ git diff --stat origin/develop develop
（出力なし＝ツリー差分ゼロ）
```

**ローカル `develop` の中身は `origin/develop` と完全一致していた**（`aea450f3` の CLAUDE.md 削除は
`fcad46fa` の revert で相殺され、差し引きゼロ）。つまり rebase を完走しても得るものはゼロ。

一方 `git cherry -v origin/develop develop` は全 11 コミットを `+`（未適用）と判定していた。
スカッシュマージでパッチ ID が変わるため、**パッチ単位で比較する道具はこの状況で必ず誤判定する**。

| 道具 | 比較単位 | squash 後の信頼性 |
|---|---|---|
| `git cherry` / `git rebase` / `git branch -d` | パッチ ID | **信用できない**（全件「未適用」と誤判定） |
| `git diff --stat origin/develop develop` | ツリー（最終状態） | **信用できる** |

### 復旧手順（案A）

```bash
git branch backup/develop-20260725 develop   # 保険（ポインタ 1 個。コストゼロ）
git rebase --abort                            # 進行中の rebase を中止
git checkout develop
git reset --hard origin/develop               # upstream に揃える
```

ツリー差分ゼロだったため、失ったのは「重複した履歴の記録」だけ。

## 教訓

1. **push が弾かれたら、次の一手は `git pull --rebase` 固定**。今回はこれで即解決していた
2. **「リモートの変更を取り込む」と「ブランチをマージする」は別物**。前者は `pull` / `origin/develop`、後者は feature ブランチ名。ここが入れ替わったのが致命傷
3. **PR がマージ済みの feature ブランチは、二度と develop にマージしない**。スカッシュマージだと重複が必ず衝突として跳ね返る
4. **`git pull` の `fatal: Need to specify...` は拒否ではなく確認**
5. **revert は「内容」の取り消し。「履歴の形」は直せない**。形を直したいなら `reset` / `rebase`（未 push 時）か `reset --hard origin/xxx`（upstream に合わせる）
6. **rebase の前に手動で変更を戻さない**。rebase が自動で退避する
7. **squash merge 済みかどうかの判定に `git cherry` を使わない**。`git diff --stat origin/develop develop` で最終状態を比較する

### 道具の選択表

| やりたいこと | 正しい道具 |
|---|---|
| 未 push・履歴ごと消したい | `git reset --hard` |
| 未 push・履歴を整えたい | `git rebase -i` |
| **push 済み・内容を取り消したい** | **`git revert`**（revert の本来の出番） |
| push 済み・履歴の形を直したい | 原則やらない（force push が要る） |
| **upstream に合わせて作り直したい** | **`git reset --hard origin/xxx`**（今回の正解） |

### 再発防止

```bash
git config --global pull.rebase true
```

教訓 4 が消え、教訓 1 が自動的に実行される。

## 参考

- 同じ根本原因の別パターン: [git-worktree-squash-merge-divergence.md](git-worktree-squash-merge-divergence.md)
- 関連: [git-branch-deletion-and-pr-merge.md](git-branch-deletion-and-pr-merge.md)
- 対象 Issue: #635 / PR #636
- Git のバージョン: 2.43.0
