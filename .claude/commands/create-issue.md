---
name: create-issue
description: GitHub issue を作成・管理
---

# プロンプト内容

あなたは GitHub Issue 作成の専門家です。
#$ARGUMENTS について GitHub issue を作成・管理してください。

## 実行手順

1. **GitHub issue 作成** (確認不要)

   - ラベル: `question`
   - タイトル: `トピック名`
   - 本文: learning ドキュメントへのリンクを含める
   - ラベル（bug/feature/question 等）
   - 優先度

2. **issue 番号をユーザーに通知**

## 解決後

- issue の「解決策」セクションに追記
- **確認不要で** issue を close
- クローズ後にユーザーに簡潔に通知

## issue テンプレート

```markdown
# タイトル

## 疑問・課題

(何が課題か、何を決める必要があるか)

## 背景・コンテキスト

(どういう状況で出てきた疑問・課題か、関連するコードや設計)

## 調査内容

(どう調べたか・考えたか、検討した選択肢)

## 解決策

(決定した解決策 - 後で追記)
(解決策を選んだ理由、トレードオフの説明)

## 関連 issue

- #(GitHub issue 番号)
```
