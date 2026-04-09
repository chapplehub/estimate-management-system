# Issue #217: test: E2Eテスト移行 employees-detail.e2e.ts - E2Eテスト専用DB対応 — 実装計画

## 概要

`employees-detail.e2e.ts` をE2Eテスト専用DB（seed-e2e.ts）に対応させる。主な変更点:
1. EMP000050（シード範囲外）→ EMP000010（シード内の従業員）に変更
2. `createTestEmployee`（UI経由）→ `e2e-helpers/prisma.ts` を使ったDB直接操作に置き換え
3. 削除テストのクリーンアップ（afterEach）を追加

## 設計判断

### 更新テストの対象従業員の選択
- EMP000010（中村直樹、営業部、一般従業員）を選択
- 理由: 役割付き従業員（EMP000001〜005）を更新するとFK制約やテスト間干渉のリスクがある。一般従業員が安全
- 注意: 更新テストで名前を変更するため、テスト後にシード値に戻す afterEach を追加してテスト間の独立性を確保

### 削除テスト用従業員の作成方法
- `e2e-helpers/prisma.ts` でDB直接作成（Employee + User + Account）
- Employee単体ではなく User/Account も作成する理由: 従業員詳細画面のアクセスにはログイン認証が必要で、画面表示には User リレーションの存在が前提
- `generateId` を使ってUUIDv7を生成（既存シードと同じパターン）

## ステップ

### Step 1: 更新テストをシード内従業員に変更 & 復元処理追加
- 対象ファイル: `src/app/(features)/employees/employees-detail.e2e.ts`
- 作業内容:
  - EMP000050 → EMP000010 に変更
  - `createTestEmployee` 関数を削除
  - 更新テストの afterEach で名前をシード値「中村 直樹」に復元
  - prisma ヘルパーを import
- コミットメッセージ: test: 更新テストをE2Eシード内の従業員(EMP000010)に変更

### Step 2: 削除テストをPrismaヘルパーに移行 & クリーンアップ追加
- 対象ファイル: `src/app/(features)/employees/employees-detail.e2e.ts`
- 作業内容:
  - beforeEach で Prisma を使って削除テスト用従業員を直接作成（Employee + User + Account）
  - afterEach で作成したテストデータをクリーンアップ（FK制約順にAccount → User → Employee）
  - テスト定数を整理
- コミットメッセージ: test: 削除テストをPrismaヘルパーに移行しクリーンアップ追加

### Step 3: lint & テスト検証
- 対象ファイル: `src/app/(features)/employees/employees-detail.e2e.ts`
- 作業内容:
  - `pnpm lint` で問題がないことを確認
  - 全体の整合性を最終確認
- コミットメッセージ: (必要に応じてlint修正をコミット)
