---
name: learn
argument-hint: [learning-content]
description: 技術的な学びや議論をlearningディレクトリに記録する
---

# 学習内容の記録

会話中の技術的な学びや議論の中でユーザに指定された内容(#$ARGUMENTS)を `learning/` ディレクトリに記録します。

## 実行手順

1. **その場で即座に** Write ツールを使って `learning/topic-name.md` を作成
2. Write ツール実行後、ユーザーに「`learning/xxx.md` に保存しました」と通知
3. **ユーザーの確認・承認は不要** (不要なら後で削除してもらえる)

## テンプレート

```markdown
# タイトル

## 概要

(何について学んだか、何を解決したか)

## 詳細

(技術的な説明、コード例、考え方など)

## 参考

- 関連ファイル
- 外部リンク等
```
