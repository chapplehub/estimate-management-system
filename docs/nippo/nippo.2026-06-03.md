# 日報 2026 年 06 月 03 日

## 📝 作業ログ

### 14:46 - 初回記録

https://github.com/chapplehub/estimate-management-system/issues/286 完了

refactor(estimate): EstimateItem の itemName / unit / memo をプリミティブから値オブジェクト化する

---

### 15:11 - 計画ディレクトリ特定をブランチ名導出に変更

計画ディレクトリの特定を settings.local.json から現在のブランチ名導出に変更した

---

### 16:21 - statusline.js のコンテクスト基準値修正

claudecode の statusline.js 修正（コンテクスト使用量が 200k 基準になっていた）

---

## 🎯 今日の目標

- [x] Issue #286: EstimateItem の itemName / unit / memo を値オブジェクト化する
- [x] 開発ツール周りの整備（計画ディレクトリ特定方式の改善、statusline 修正）

## 📊 進捗状況

### ✅ 達成

- **Issue #286 完了（PR #297 マージ済み）**: `EstimateItem` がプリミティブ（`string` / `string | null`）で受けていた `itemName` / `unit` / `customerMemo` / `internalMemo` を値オブジェクト（`ItemName` / `Unit` / `Memo`）に置換。あわせて `Memo` の `null` を排除。エンティティ内の `assertItemName` / `assertUnit` / `assertMemo` によるバリデーションを VO 側へ移譲。
- **計画ディレクトリ特定方式の改善（d143e45）**: 計画ディレクトリの特定を `settings.local.json` の固定設定から、現在のブランチ名導出に変更。設定とブランチ状態の二重管理を解消。
- **statusline.js 修正**: コンテクスト使用量の基準値が 200k に固定されていた問題を修正。

### 🔄 進行中・未着手

- 着手順序 #5（見積集約の永続化）は前段（#289 リポジトリ I/F）・後段（#292 PrismaEstimateRepository / EstimateMapper）が 6/2 までに完了済み。次フェーズの確認待ち。

## 💡 学びと気づき

- **VO 化判断の見直し**: Issue #284 時点では「VarChar 長制限のみの業務制約」「VO 化コスト（クラス 3 つ + テスト）に見合わない」としてプリミティブ受けを選択していた（`issue-284/deviations.md §5`）。今回それを覆して VO 化。スナップショット属性であっても、`null` 排除方針（[[schema-null-elimination-preference]]）と整合させるには VO で制約を一元化するほうが筋が良い、という判断の更新。`Memo` を `customerMemo` / `internalMemo` で共用する設計で VO クラス増加コストを抑えている。
- **設定よりも状態からの導出**: 計画ディレクトリのパスを設定ファイルに固定するとブランチ切替時に不整合が起きうる。ブランチ名（`feat/issue-{number}` 規則）から導出することで Single Source of Truth 化。
- **statusline の基準値はモデル依存**: コンテクスト使用率の分母を 200k 固定にすると、より大きいウィンドウのモデルで使用率が過大表示される。実モデルのウィンドウに合わせる必要がある。

## 🚀 明日への申し送り

- 着手順序 #5（見積集約の永続化）の次フェーズ着手可否を確認する。
- VO 化で他エンティティにも同様のプリミティブ受けが残っていないか棚卸しを検討（横展開）。
