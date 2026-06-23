# Issue #425: 標準マージン率(marginRate)をスキーマ・コードベースから全面削除 — 実装計画

## 概要

得意先マスタの `marginRate`（標準マージン率）を、スキーマ・ドメイン・アプリ・プレゼンテーション・seed・テストから全面削除する。

#422（価格決定機構の輪郭定め／ADR-0064: 見積単価はマスタ固定・手入力なし）により、価格決定は販売単価マスタを唯一の源とすることが確定し、原価×(1+マージン)で売価を作る出発点としての `marginRate` は構造的に役割を失った。調査の結果 `marginRate` は得意先マスタに保存・一覧表示されるのみで、estimate/pricing の計算コードからの参照はゼロ（未実現の設計意図）。二重の価格源による誤読を避けるため残置ではなく削除する。

過去のどの見積も `marginRate` をスナップショットしていないため、削除による過去データ整合性の懸念はない。

## 設計判断

### 削除 vs 残置（deprecation）
- A. 列・VOごと全面削除する
- B. 列を残し deprecated 扱いにする
- 採用: **A**。理由: 計算にも表示価値にも寄与しない死んだ属性で、残すと「何かに効いているはず」という誤読負債になる。価格決定方針（ADR-0064）上、復活余地もない。

### 受け入れ条件の grep スコープ
- 当初条件 `grep -rni "margin" src prisma` = 0 は**達成不能**。マイグレーション履歴 SQL 2 本（`20260217074132_add_company_issue_73`, `20260415012955_add_column_constraints`）に `margin_rate` が残るため。
- 採用: 履歴 SQL は適用済みの**不変記録**として残し、受け入れ条件を **`grep -rni "margin" src prisma --exclude-dir=migrations` = 0** に修正する。

### ADR の扱い
- ADR-0019（`add-varchar-and-check-constraints`）は本文で `marginRate` を CHECK 制約の例として名指しするが、**不変記録として一切触れない**。当時 `marginRate` に CHECK を付けたのは史実であり、改変すると履歴の意味が壊れる。
- **新規 ADR は起こさない**。削除は ADR-0064 の従属的帰結であり、本件固有のトレードオフではない（起票3条件のいずれも弱い）。

### 一覧の「マージン率」列
- 代替なしで単純削除（`_components/columns.tsx`）。唯一の利用者向け挙動変化。

### CONTEXT.md（反映済み）
- 「標準マージン率」用語ブロック削除・得意先の括弧書き除去・共通販売単価の avoid 理由を曖昧さベースへ差し替え。本計画保存時点で**編集済み**。

### 実装手法
- **/tdd は使わない**。削除リファクタには規定すべき新しい振る舞いがなく、red→green が自然に作れない。
- 採用: **tsc（型エラー）を駆動役にした「コミット毎グリーンバー」増分リファクタ**。`MarginRate` VO → `Customer` → Mapper/QueryService/DTO → UI と型エラーが上流から下流へ連鎖し、削除漏れチェックリストになる。既存ユニット/E2E は現状維持の網として使い、margin 固有アサーションはコードと一緒に削除する。

## ステップ

### Step 1: ドメイン層から marginRate を削除
- 対象ファイル: `src/server/subdomains/customer/domain/values/MarginRate.ts`（ファイルごと削除）, `domain/entities/Customer.ts`（`_marginRate` フィールド・`changeMarginRate`・getter・create option・reconstruct 位置引数）, `domain/values/__tests__/MarginRate.test.ts`, `domain/entities/__tests__/Customer.test.ts`
- 作業内容:
  - `MarginRate.ts` とそのテストを削除
  - `Customer.ts` から margin 関連の構造を除去。reconstruct は位置引数のため、後続引数（version 等）の位置ズレに注意
  - `Customer.test.ts` の margin 関連ケースを削除
- コミットメッセージ: `refactor: customer ドメインから marginRate を削除`

### Step 2: アプリ層（Mapper / QueryService / DTO / Command）の追従
- 対象ファイル: `infrastructure/mappers/CustomerMapper.ts`, `infrastructure/queries/PrismaCustomerQueryService.ts`, `application/queries/dto/CustomerDTO.ts`, `application/commands/CreateCustomerCommand.ts`, `application/commands/UpdateCustomerCommand.ts`, および対応する `__tests__`（`CreateCustomerCommand.test.ts`, `UpdateCustomerCommand.test.ts`, `GetCustomerByIdQuery.test.ts`, `SearchCustomersQuery.test.ts`, `PrismaCustomerRepository.test.ts`）
- 作業内容:
  - Step 1 で発生した型エラーを上流から潰す。Mapper の reconstruct 呼び出し引数、QueryService の SELECT/DTO 組み立て、DTO 定義、各 Command の入力から marginRate を除去
  - 各テストの margin 箇所を削除
- コミットメッセージ: `refactor: customer アプリ層から marginRate を削除`

### Step 3: プレゼンテーション層から marginRate を削除
- 対象ファイル: `src/app/(features)/customers/_shared/schema.ts`, `new/CustomerCreateForm.tsx`, `[code]/CustomerUpdateForm.tsx`, `new/actions.ts`, `[code]/actions.ts`, `_components/columns.tsx`, `customers-crud.e2e.ts`
- 作業内容:
  - フォームスキーマの marginRate フィールド除去、両フォームの入力UI除去、Server Action の受け渡し除去
  - 一覧の「マージン率」列を代替なしで削除
  - E2E テストの marginRate 入力・検証箇所を削除
- コミットメッセージ: `refactor: 得意先画面から marginRate 入力・一覧列を削除`

### Step 4: スキーマ・マイグレーション・seed の削除
- 対象ファイル: `prisma/schema.prisma`（`marginRate Decimal? @map("margin_rate")` 行）, 新規マイグレーション, `prisma/seed.ts`, `prisma/seed-e2e.ts`
- 作業内容:
  - schema から marginRate 列を削除し、`DROP COLUMN margin_rate` のマイグレーションを生成（CHECK 制約 `customers_margin_rate_check` は DROP COLUMN で自動連鎖削除されるため個別 DROP 不要）
  - seed / seed-e2e の marginRate 投入箇所を削除
  - マイグレーション適用は `!` 委譲。dev DB は全 worktree 共有のため他ブランチの実行時破壊に注意
- コミットメッセージ: `refactor: customers テーブルから margin_rate 列を削除`

### Step 5: 完了確認
- 作業内容:
  - `grep -rni "margin" src prisma --exclude-dir=migrations` = 0 を確認
  - `pnpm build` / `pnpm test` / `pnpm lint` グリーンを確認
  - マイグレーションで `customers.margin_rate` 列が消えていることを確認
- コミットメッセージ: （確認のみ。コード変更があれば内容に応じて）
