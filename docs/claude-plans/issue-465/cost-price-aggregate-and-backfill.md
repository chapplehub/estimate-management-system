# Issue #465: 原価移設 A — 新原価集約＋スキーマ＋バックフィル移行（加法スライス） — 実装計画

## 概要

原価を Product から剥がすための**加法スライス（expand）**。`pricing` に `CommonSellingPrice` と同型の独立集約（商品id × 適用期間 × 原価）を新設し、既存 `products.cost_price` をバックフィル移行する。**`products.cost_price` 列は温存し、Product 集約は無改変**（正本切替・列削除・画面付け替えはカットオーバースライス #468 = 原価移設 B に隔離）。

分割方針と移行方式は **ADR-20260627-a5c** に記録済み。集約境界は ADR-0065/0066、期間表現は ADR-0067。実装は既存 `src/server/subdomains/pricing/` の `CommonSellingPrice` 一式（#462〜#466）を機械的にミラーする。

**実装方針: TDD（red-green-refactor）**。ドメイン純粋層（VO→エンティティ）はユニットテスト先行、インフラ層（Mapper/Repository/QueryService）はテストDBの統合テスト先行、続いてバックフィル移行（手書き SQL）、最後に seed への反映。各ステップでテストとプロダクションコードを同一コミットにまとめる。

## 設計判断

会話・ADR-20260627-a5c で確定済みの判断（再掲。詳細は ADR 参照）:

### 集約の配置・命名（確定）
- `pricing` 内の**別集約**。ルート `CostPrice`（identity = ProductId 流用）／期間 `CostPricePeriod`（サロゲート UUIDv7）／金額VO `CostUnitPrice`。
- 金額VO は `SellingUnitPrice` と対をなす命名。「Common」修飾は付けない（原価は宛先非依存の単層）。
- **Issue A では pricing 側 `CostUnitPrice` を新規作成し、既存 `product/domain/values/CostPrice.ts` は温存**（A を加法的に保つため。旧 VO 削除は B）。

### 移行起点（確定）
- 開放端期間の開始日 = **一律・固定の `2026-04-01`（当年度期首・ADR-0024 の 4月始まり）**。マイグレーションに暦日定数で直書きする。`now()`・行別 `created_at` は不採用。
- 起点規則の根拠: デプロイ日に依存せず今確定でき決定的。当年度内の遡及見積を救う。移行値は現在原価で過去はどの起点でもフィクションだが、年度概念に乗せフィクションを当年度内に限定する。売単価が going-forward のため、これより過去へ伸ばしても粗利は出ず（挙動不変）無駄。

### 特殊行の写像（確定）
- **カテゴリで分岐**: 複合品（`canHaveComponents()` 真）→ 期間なし／非複合品 ＆ `cost_price IS NULL` → 期間なし／非複合品 ＆ 非NULL → `[本番投入日, )` を1本。
- **遅延・疎生成**: 親ルート＋期間を作るのは「非複合品 ＆ 非NULL」のみ（空ルートを撒かない）。

### バックフィル移行の実装機構（確定）
- **A. 手書き SQL マイグレーション**を採用（B. 一回限り TS スクリプトは不採用）。
- 根拠: 範囲型テーブルの読み書きは元々 `$executeRaw` 手書き＝ADR-0067 の運用に同じ。カテゴリ分岐は **`category <> 'SET'`**（`canHaveComponents()` の実体は `category === "SET"` の単一 enum 等価）で表現でき、複雑な多列導出がないためドリフトしない。マイグレーションパイプラインで決定的・versioned・デプロイ時に自動適用され「固定起点・一回限り」と整合。
- 実装時の小判断（期間行のサロゲート UUIDv7 生成）: PG18+なら `uuidv7()`／未満なら移行内に uuidv7 SQL 関数を定義／一回限りに限り `gen_random_uuid()`(v4) 許容（サロゲートで時系列性不要、以後追加の期間は v7）。PG バージョンを実装時に確認して選ぶ。

### seed への反映（確定）
- 原価 seed は**別 curated 配列を作らず既存 `PRODUCTS`／E2E products 配列の `costPrice`＋`category` から導出**する（非SET ＆ 非null のみ）。移行と同じカテゴリ分岐・同じ起点 `2026-04-01` を1ソースで再現し、seed と移行の意味論ドリフトを防ぐ。

## ステップ

### Step 1: 金額VO `CostUnitPrice`
- 対象ファイル: `src/server/subdomains/pricing/domain/values/CostUnitPrice.ts`（＋ `__tests__/CostUnitPrice.test.ts`）
- 作業内容:
  - `SellingUnitPrice` をミラー。テスト先行（red→green）: 生成・等価・非負/銭精度などの不変条件を既存 VO に揃える。
  - 既存 `product` の `CostPrice` VO は触らない（併存）。
- コミットメッセージ: `feat: 原価金額VO CostUnitPrice を pricing に追加`

### Step 2: 期間ID VO `CostPricePeriodId`
- 対象ファイル: `src/server/subdomains/pricing/domain/values/CostPricePeriodId.ts`（＋ `__tests__/`）
- 作業内容:
  - `CommonSellingPricePeriodId`（UUIDv7 サロゲート・ADR-0032）をミラー。テスト先行。
- コミットメッセージ: `feat: CostPricePeriodId VO を追加`

### Step 3: 原価集約 `CostPrice`（ルート＋期間エンティティ）
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CostPricePeriod.ts`, `CostPrice.ts`, `index.ts`（barrel）（＋ `__tests__/CostPrice.test.ts`）
- 作業内容:
  - `CommonSellingPricePeriod` / `CommonSellingPrice` をミラー。`create(productId)`（空集約）・`reconstruct`・`addPeriod`（既存期間との `overlaps` で重複禁止＝ADR-0029/0066 の構造的不変条件）。
  - テスト先行: 重複期間の追加が `BusinessRuleViolationError`、隣接半開区間は許可、空集約生成、reconstruct の状態復元。
  - barrel `entities/index.ts` に追加（集約境界・ADR-0027）。
- コミットメッセージ: `feat: 原価集約 CostPrice（ルート＋期間エンティティ）を追加`

### Step 4: Repository インターフェース `CostPriceRepository`
- 対象ファイル: `src/server/subdomains/pricing/domain/repositories/CostPriceRepository.ts`
- 作業内容:
  - `CommonSellingPriceRepository` をミラーし `findByProductId`/`save` に限定（時点解決 read は QueryService 側＝ADR-0066）。インターフェースのみのため Step 7 のテストで実装を駆動。
- コミットメッセージ: `feat: CostPriceRepository インターフェースを追加`

### Step 5: Prisma スキーマ＋マイグレーション
- 対象ファイル: `prisma/schema.prisma`, `prisma/migrations/.../migration.sql`
- 作業内容:
  - `cost_prices`（親・`version` 保持・Product と 1:1・onDelete Cascade）＋ `cost_price_periods`（子・`applicable_period Unsupported("daterange")`・`@@index([productId])`）を `CommonSellingPrice` 同型で追加。
  - 手書き SQL マイグレーション（ADR-0067/0019/0021）: `CREATE EXTENSION IF NOT EXISTS btree_gist;`（既存なら冪等）、`EXCLUDE USING gist (product_id WITH =, applicable_period WITH &&)`。
  - `pnpm db:generate`。`products.cost_price` 列は**変更しない**。
  - ※ dev DB は全 worktree 共有のためマイグレーション適用は `!` 委譲で慎重に。
- コミットメッセージ: `feat: 原価集約のスキーマとマイグレーションを追加`

### Step 6: Mapper `CostPriceMapper`
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/mappers/CostPriceMapper.ts`（＋ テスト）
- 作業内容:
  - `CommonSellingPriceMapper` をミラー。`daterange` パース/生成は既存の infra 共有ヘルパ（`sellingPricePeriodPersistence` 周辺）を再利用し、生 SQL の染み出しを抑える（ADR-0067）。
  - テスト先行: `[2025-07-01,)` パース・上端 unbounded・Domain↔行 往復。
- コミットメッセージ: `feat: CostPriceMapper を追加`

### Step 7: Prisma Repository `PrismaCostPriceRepository`
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCostPriceRepository.ts`（＋ 統合テスト）
- 作業内容:
  - `PrismaCommonSellingPriceRepository` をミラー。`findByProductId`（親 null なら null 返す＝遅延パターン）／`save`（差分 upsert・ADR-0032、`$executeRaw` で `daterange()` 生成、version 楽観ロック・ADR-0039、影響行数で `ConflictError` 判定）。
  - テストDB 統合テスト先行: 保存→再取得の往復、重複期間が EXCLUDE で弾かれる、version 競合。
- コミットメッセージ: `feat: PrismaCostPriceRepository を追加`

### Step 8: 時点解決 QueryService
- 対象ファイル: `src/server/subdomains/pricing/application/queries/ResolveCostPriceQuery.ts`, `dto/...`, `infrastructure/queries/PrismaCostPriceQueryService.ts`, `application/factories/pricingQueryFactory.ts`（配線）（＋ テスト）
- 作業内容:
  - `ResolveCommonSellingPriceQuery` / `PrismaCommonSellingPriceQueryService` をミラー。入力は暦日文字列（ADR-20260624-95f）、見積年月日が `contains` する期間行を解決。期間なし商品は「解決なし」を返す。
  - テスト先行: 区間内/区間外/期間なし/上端 unbounded。
- コミットメッセージ: `feat: 原価の時点解決 QueryService を追加`

### Step 9: バックフィル移行（手書き SQL）
- 対象ファイル: `prisma/migrations/.../migration.sql`（＋ 検証）
- 作業内容:
  - ADR-20260627-a5c の方式で `products.cost_price` を新集約へ写す手書き SQL マイグレーション: `INSERT ... SELECT` で `WHERE category <> 'SET' AND cost_price IS NOT NULL` に絞り、親（id = product_id 流用・version=1）＋期間（`daterange('2026-04-01', NULL, '[)')`・サロゲート id は前述の v7 方針）を投入。複合品・NULL は行を作らない（遅延・疎）。
  - 起点は `2026-04-01` 定数を直書き。
  - 検証: 移行後、非SET ＆ 非NULL のみ親行が存在し、SET・NULL には親行が無いこと。`products.cost_price` は温存されたまま。
- コミットメッセージ: `feat: products.cost_price を原価集約へバックフィル移行`

### Step 10: seed への原価集約反映
- 対象ファイル: `prisma/seed.ts`, `prisma/seed-e2e.ts`
- 作業内容:
  - 既存 `PRODUCTS`／E2E products 配列から原価集約を**導出**して投入（別 curated 配列は作らない）。非SET ＆ `costPrice` 非null の商品のみ、親ルート `costPrice.create({ data: { productId } })` ＋ 期間行を `$executeRaw` で `daterange('2026-04-01', NULL, '[)')`＋`generateId()`（v7）投入。`CommonSellingPrice` seed（seed.ts:1284-）と同じ構造をミラー。
  - クリーンアップに `costPrice.deleteMany()` を追加（`commonSellingPrice.deleteMany()`(seed.ts:1176) と並べる）。
  - Product 行の `costPrice` 列セット（seed.ts:1260）は A では温存（列温存・二重書き）。`seed-estimates.ts` は原価が粗利未接続のため影響なしを確認。
- コミットメッセージ: `test: 原価集約を seed に反映（PRODUCTS から導出）`
