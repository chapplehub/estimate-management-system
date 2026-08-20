# 日報 2026年04月06日

## 📝 作業ログ

### 15:40 - ハーネスエンジニアリング学習

ハーネスエンジニアリングについて学習

### 15:41 - Claudeアーキテクチャ学習

claudeアーキテクチャについて学習

### 15:41 - Issue #194 完了

[#194 テスト並列実行時の部署マスタupsertレースコンディションの修正](https://github.com/chapplehub/estimate-management-system/issues/194) 完了

### 17:12 - Issue #188 完了

[#188 全テーブルのIDカラムをPostgreSQLネイティブUUID型（@db.Uuid）に移行](https://github.com/chapplehub/estimate-management-system/issues/188) 完了

### 17:40 - Issue #178 完了

[#178 tanstack table利用によるeslintエラーの調査・修正](https://github.com/chapplehub/estimate-management-system/issues/178) 完了

---

## 🎯 今日の目標

- [x] Issue #194 テスト並列実行時のレースコンディション修正
- [x] Issue #188 全テーブルIDカラムのUUID型移行
- [x] Issue #178 tanstack table ESLintエラー修正
- [x] ハーネスエンジニアリング・Claudeアーキテクチャの学習

## 📊 進捗状況

| カテゴリ | 内容 | 状態 |
|---------|------|------|
| バグ修正 | #194 テスト並列実行時の部署マスタupsertレースコンディション修正 | ✅ 完了 |
| リファクタリング | #188 全テーブルIDカラムをPostgreSQLネイティブUUID型に移行 | ✅ 完了 |
| リファクタリング | #178 DataTableのReact Compiler非互換lint warning解消 | ✅ 完了 |
| 学習 | ハーネスエンジニアリング・Claudeアーキテクチャ | ✅ 完了 |

**本日のコミット**: 4件（PR #195, #196, #178 含む）

## 💡 学びと気づき

- テスト並列実行時のupsertレースコンディションは、PostgreSQLのON CONFLICT句でも発生しうる。排他制御やリトライ戦略の重要性を再認識
- IDカラムのUUID型移行では、Prismaの `@db.Uuid` アノテーションによりDB側でネイティブUUID型を活用できる。文字列型からの移行でストレージ効率・インデックス性能の改善が期待できる
- React CompilerとTanStack Tableの組み合わせでESLint警告が出る場合がある。ライブラリの内部実装とコンパイラの最適化の相性に注意が必要

## 🚀 明日への申し送り

- #189 UUIDv7 ID Value Objectの導入（本日の#188 UUID型移行の次ステップ）
- #197 従業員一覧への部署機能追加（フィーチャー系）
- #190 従業員CRUD系E2Eテストのflaky対策（#194と関連するテスト安定化）
- #198 テスト作成スキルへのフレーキーテスト注意プロンプト追加
