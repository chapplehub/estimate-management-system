# commit type と GitHub label の命名ずれは正常

作成日: 2026-04-02

## 概要

Conventional Commits の `feat`/`fix` と GitHub Issues の `enhancement`/`bug` は同じ概念を指すが名前が異なる。これはエコシステムの違いによるもので、統一すべきではない。

## 詳細

### 由来の違い

| | commit type | GitHub label |
|--|------------|--------------|
| 由来 | Conventional Commits（Angular commit規約が起源） | GitHub Issues のデフォルトラベル |
| 目的 | changelog自動生成、semver判定 | Issue のトリアージ・分類 |
| 慣習 | `feat` / `fix` | `enhancement` / `bug` |

### なぜ統一しないのか

- GitHub label を `feat` に変える → GitHub の慣習から外れ、外部コントリビュータが混乱
- commit type を `enhancement` に変える → Conventional Commits 仕様から外れ、commitlint や changelog 生成ツールが壊れる
- 多くの OSS プロジェクトがこのずれを許容している

### 正しい対処法

対応関係を**マッピングテーブル（リファレンスファイル）**で明示する。

### DDD の観点

GitHub Issues と Git Commits は別の**境界づけられたコンテキスト**であり、各コンテキスト内で自然な名前（ユビキタス言語）が異なるのは正常。マッピングテーブルは両コンテキスト間の**変換マップ（Anti-Corruption Layer）**として機能する。

## 参考

- https://www.conventionalcommits.org/
- https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels
