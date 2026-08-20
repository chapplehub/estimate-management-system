# Issue #208: 商品一覧画面の実装 — 実装計画

## 概要

商品マスタの一覧画面（プレゼンテーション層）を実装する。バックエンド（#204）で Domain / Application / Infrastructure 層は実装済みであり、`SearchProductsQuery` / `ProductDTO` / `ProductSearchCriteria` がすでに利用可能。

既存の一覧ページ（departments, employees, roles）と同じパターンで、Server Component + SearchForm + DataTable の構成で実装する。

## 設計判断

なし（既存パターン踏襲）

- クエリ呼び出し: `searchProductsQueryFactory()` — 既存ファクトリパターン
- ページネーション: クライアントサイド（DataTable / TanStack Table） — 既存パターン
- 検索: URL パラメータベース（SearchForm） — 既存パターン
- ソート: 商品コード昇順（デフォルト固定） — Issue 指定

## ステップ

### Step 1: 商品一覧カラム定義の作成

- 対象ファイル:
  - `src/app/(features)/products/_components/columns.tsx`（新規）
- 作業内容:
  - `ProductRow` 型を定義（id, code, name, category, unit, isActive）
  - カラム定義（`ColumnDef<ProductRow>[]`）を作成
    - 商品コード: リンク（`/products/${code}`）
    - 商品名: テキスト
    - 商品区分: Badge（INDIVIDUAL → 個別商品, CONSUMABLE → 消耗品, SET → セット商品）
    - 単位: テキスト
    - 状態: Badge（有効/無効）
  - 商品区分のラベルマッピングをファイル内に定義
- コミットメッセージ: `feat: 商品一覧のカラム定義を作成`

### Step 2: 商品一覧ページの作成

- 対象ファイル:
  - `src/app/(features)/products/page.tsx`（新規）
- 作業内容:
  - Server Component で `searchProductsQueryFactory()` を使用してデータ取得
  - 検索フォームのフィールド定義（商品コード[部分一致], 商品名[部分一致], 商品区分[select], 有効フラグ[select]）
  - URL パラメータから検索条件を構築（`getStringParam`, `validateIsActive`）
  - `ProductDTO[]` → `ProductRow[]` への変換
  - SearchForm + DataTable の描画
  - 管理者のみ「新規登録」ボタン表示（`isAdmin(session)`）
  - 既存パターン参照: `src/app/(features)/departments/page.tsx`
- コミットメッセージ: `feat: 商品一覧ページを作成`

### Step 3: ダッシュボードに商品管理リンクを追加

- 対象ファイル:
  - `src/app/(features)/dashboard/page.tsx`（既存）
- 作業内容:
  - `navigationItems` 配列に商品管理のエントリを追加
    - `{ href: "/products", title: "商品管理", description: "商品の一覧表示、登録、編集、削除を行います。" }`
- コミットメッセージ: `feat: ダッシュボードに商品管理リンクを追加`

### Step 4: E2E テストデータの追加

- 対象ファイル:
  - `prisma/seed-e2e.ts`（既存）
- 作業内容:
  - 商品テストデータ（INDIVIDUAL, CONSUMABLE, SET の各区分）を追加
  - 有効/無効の商品を含める（検索フィルターテスト用）
  - main 関数内で商品作成処理を追加
- コミットメッセージ: `test: E2Eテスト用の商品シードデータを追加`

### Step 5: E2E テストの作成

- 対象ファイル:
  - `src/app/(features)/products/products-list.e2e.ts`（新規）
- 作業内容:
  - 既存パターン参照: `src/app/(features)/departments/departments-list.e2e.ts`
  - テストケース:
    - 一覧が表示され、管理者には「新規登録」ボタンが見える
    - 商品コードで検索（部分一致）できる
    - 商品名で検索（部分一致）できる
    - 商品区分で検索できる
    - 状態で検索できる
    - クリアボタンで検索条件がリセットされる
  - 一般ユーザーテスト:
    - 一般ユーザーには「新規登録」ボタンが見えない
- コミットメッセージ: `test: 商品一覧画面のE2Eテストを作成`

### Step 6: ビルド・lint・テスト確認

- 対象ファイル: なし（検証のみ）
- 作業内容:
  - `pnpm build` でエラーがないこと
  - `pnpm lint` でエラーがないこと
  - `pnpm test` で全テストがパスすること
- コミットメッセージ: （lint修正があれば）`fix: lint修正`

## 検証方法

1. `pnpm build` — ビルドエラーなし
2. `pnpm lint` — lint エラーなし
3. `pnpm test` — 全テストパス
4. `pnpm e2e:seed && pnpm e2e` — E2E テストパス
5. `pnpm dev` で `/products` にアクセスし、検索・ページネーション・ソートが動作すること

## 参照ファイル

| 用途 | ファイルパス |
|------|------------|
| 既存一覧パターン | `src/app/(features)/departments/page.tsx` |
| カラム定義パターン | `src/app/(features)/departments/_components/columns.tsx` |
| E2Eテストパターン | `src/app/(features)/departments/departments-list.e2e.ts` |
| SearchForm | `src/app/_components/shared/SearchForm.tsx` |
| DataTable | `src/app/_components/shared/DataTable.tsx` |
| クエリファクトリ | `src/server/subdomains/product/application/factories/productQueryFactory.ts` |
| 検索クエリ | `src/server/subdomains/product/application/queries/SearchProductsQuery.ts` |
| 検索条件型 | `src/server/subdomains/product/application/queries/dto/ProductSearchCriteria.ts` |
| DTO | `src/server/subdomains/product/application/queries/dto/ProductDTO.ts` |
| 商品区分VO | `src/server/subdomains/product/domain/values/ProductCategory.ts` |
| ダッシュボード | `src/app/(features)/dashboard/page.tsx` |
| E2Eシード | `prisma/seed-e2e.ts` |
