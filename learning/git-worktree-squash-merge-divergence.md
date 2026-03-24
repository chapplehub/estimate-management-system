# git worktree + スカッシュマージによるブランチ分岐問題

作成日: 2026-02-20

## 概要

developブランチでコミットした後に `git worktree` で新ブランチを作成し、そのブランチをスカッシュマージすると、ローカルdevelopと `origin/develop` が分岐（diverge）して `git pull` できなくなる。

## 詳細

### 発生条件

1. ローカルの `develop` ブランチで直接コミットを作成
2. `git worktree add` でそのHEADからfeatureブランチを作成
3. featureブランチをPRでスカッシュマージして `origin/develop` に統合

### 何が起きるか

`git worktree add` は現在のHEADから新ブランチを分岐させるが、**元のブランチのコミットは移動しない**。そのため以下の状態になる：

```
操作前:
  develop(local): A - B - C - D - E - F  （C〜Fが作業コミット）

git worktree add 後:
  develop(local):   A - B - C - D - E - F  ← コミットはここに残る
  feat/issue-XX:    A - B - C - D - E - F  ← 同じ地点から分岐

スカッシュマージ後:
  origin/develop:   A - B - S             ← C〜Fを1つにまとめた新コミット
  develop(local):   A - B - C - D - E - F ← 元のコミットが残ったまま
```

スカッシュマージは元のコミットとは**異なるハッシュ**の新コミットを作るため、Gitは同じ変更だと認識できず「divergent branches」エラーになる。

### エラーメッセージ

```
hint: You have divergent branches and need to specify how to reconcile them.
fatal: Need to specify how to reconcile divergent branches.
```

### 対処法

ローカルの元コミットはスカッシュマージに含まれているため、破棄してよい：

```bash
git stash --include-untracked   # 未コミットの変更を退避
git reset --hard origin/develop # ローカルをリモートに合わせる
git stash pop                   # 退避した変更を戻す
```

**注意:** `git pull` や `git pull --rebase` では変更が二重になるため使わないこと。

### 正しいワークフロー

- ローカルの `develop` では直接コミットしない
- `develop` からfeatureブランチを切り、**featureブランチ上で**コミットする
- `develop` を「きれいな状態」に保っておけば、スカッシュマージ後も `git pull` で fast-forward できる

## 参考

- `git worktree add` のドキュメント: https://git-scm.com/docs/git-worktree
