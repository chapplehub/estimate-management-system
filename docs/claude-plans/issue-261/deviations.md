# Issue #261 実装の逸脱記録

## 1. スコープ外ファイル `customers-list.e2e.ts` の修正

### 元の計画 / Issue 文言

> ## 対象
> - `src/app/(features)/customers/customers-crud.e2e.ts`
> - `prisma/seed-e2e.ts`

Issue の対象は crud e2e と seed の 2 ファイルのみ。`customers-list.e2e.ts` は
対象外。

### 実際の実装

`customers-list.e2e.ts` の 2 テストの件数アサーションを堅牢化:

- `都道府県で検索できる`: `expect(count).toBe(2)` → `expect(count).toBeGreaterThan(0)`
- `状態「有効」で検索できる`: `expect(count).toBe(4)` → `expect(count).toBeGreaterThan(0)`

いずれも「全表示行が絞り込み条件に一致する」不変条件のループ検証は維持。

### 逸脱の理由

§13 に従い独自シード `C901`（prefecture=東京都・isActive=true）を共通シード
プールに追加した結果、`customers-list.e2e.ts` の **シード件数に結合した
exact-count アサーション**が必然的に破綻した:

- 都道府県=東京都: 既存 C001/C002 の 2 件 → C901 追加で 3 件（`toBe(2)` 失敗）
- 状態=有効: 既存 4 件 → C901 追加で 5 件（`toBe(4)` 失敗）

`C901` の属性調整では回避不能（active なら有効件数、inactive なら無効件数の
どちらかが必ずズレる）。Issue の完了条件「`pnpm e2e` がグリーン」を満たすには
当該アサーションの堅牢化が必須。

検索テストが本来検証すべき不変条件は「絞り込み結果の全行が条件に一致する」
ことであり、総件数はシード基数への偶発的結合にすぎない。直接の前例である
products リファクタ（commit `a415cb0` / 親 Issue #255 系列）で
`products-list.e2e.ts` は既に `toBeGreaterThan(0)` + 全行一致パターンへ移行済み。
本変更はその確立済みパターンへ `customers-list.e2e.ts` を追従させるもので、
skill の方向性と一致する。ユーザー承認済み（products 前例に合わせ堅牢化）。
