# 日報 2025年12月24日

## 📝 作業ログ

### 14:20 - テスト理解

Kent C. Dodds のブログを読んでテストについて理解する

### 14:21 - テストの種類とボリューム

テストの種類とボリュームについて https://kentcdodds.com/blog/write-tests

### 14:22 - 統合テストの重要性

https://kentcdodds.com/blog/write-tests

> It doesn't matter if your component `<A />` renders component `<B />` with props c and d if component `<B />` actually breaks if prop e is not supplied. So while having some unit tests to verify these pieces work in isolation isn't a bad thing, it doesn't do you any good if you don't also verify that they work together properly. And you'll find that by testing that they work together properly, you often don't need to bother testing them in isolation.

これは確かにそう思う

### 14:25 - testing-libraryの理念

Kent C. Dodds と testing-library の理念を理解

- 「The more your tests resemble the way your software is used, the more confidence they can give you.」
- 「There are two distinct and important reasons to avoid testing implementation details.」

### 14:28 - MSW調査

msw について調査 https://mswjs.io/

### 14:30 - Service Worker調査

Service Worker について調査 https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API

### 17:16 - nippo-add修正

nippo-addの実装修正　現在時刻を取得して追記するように修正

### 17:20 - Web Worker整理

Service WorkerはWebWorkerの中の一つだった。前使おうとしたのはWebWorkerの中の一つのDedicated Worker

### 18:02 - MSWの適用範囲

mswはネットワーク専用のモック、非HTTP通信の場合はvi.mockを使う必要がある

---

## 🎯 今日の目標

- [x] テストに関する理解を深める（Kent C. Dodds のブログ読了）
- [x] MSW（Mock Service Worker）の調査
- [x] nippo-add コマンドの時刻バグ修正

## 📊 進捗状況

**完了:**
- Kent C. Dodds のブログ記事を読み、テストの理念を理解
- testing-library の設計思想を把握
- MSW の仕組み（Service Worker ベース）を理解
- Web Worker の種類（Dedicated Worker / Service Worker）を整理
- nippo-add コマンドの時刻取得バグを修正

## 💡 学びと気づき

### テストに関する重要な学び

1. **統合テストの重要性**
   - 個別のユニットテストより、コンポーネントが連携して動作することを確認する方が価値がある
   - 統合テストで動作確認できれば、個別テストは不要なケースも多い

2. **testing-library の理念**
   - 「ユーザーの使い方に近いテストほど信頼性が高い」
   - 実装詳細のテストは避けるべき（リファクタリング耐性が低い）

3. **MSW の適用範囲**
   - MSW は HTTP 通信のモック専用
   - 非 HTTP 通信（DB 直接アクセスなど）は `vi.mock` を使う必要がある

4. **Web Worker の分類**
   - Service Worker: ネットワークリクエストのプロキシ（MSW が利用）
   - Dedicated Worker: 重い計算処理のオフロード用

## 🚀 明日への申し送り

- 学んだテスト理念を実際のコードに適用する
- MSW を使った統合テストの実装を検討
