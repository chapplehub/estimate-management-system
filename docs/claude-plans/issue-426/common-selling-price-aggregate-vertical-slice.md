# Issue #426: 共通販売単価集約の実装（縦スライス） — 実装計画

## 概要

価格決定機構（#422 / ADR-0064・0065）の実装フェーズ最初のスライス。**共通販売単価**を縦スライス（共有 VO → ドメイン集約 → Prisma スキーマ → Repository）で実装し、後続フェーズ（A2 上書き2層 / B 価格決定 / C マスタ画面）が依存する基盤を作る。

grill-with-docs（ADR-0066・0067）の結果、当初 issue 本文から **原価移設**と **Money 昇格**を切り出し、#426 は共通販売単価集約に純化した。

### スコープ境界（重要）

- **前提（先行マージ必須）**: Money を `estimate` から `shared/domain/values/` へ昇格する純リファクタ（別 issue）。本スライスの `SellingUnitPrice` が `shared` の Money に依存するため、#426 マージ前に取り込む。
- **本スライスに含む**: `ApplicablePeriod` VO（shared 共有基盤）、`SellingUnitPrice` VO、集約サロゲート ID VO、共通販売単価集約、Prisma 親子テーブル＋EXCLUDE、Repository（IF＋$queryRaw 実装＋Mapper）、seed。
- **本スライスに含まない（後続 issue）**: `CostPrice` の Money 化・原価集約・Product からの CostPrice 剥離・既存データ移行（＝原価移設 issue）。時点解決クエリ（見積年月日で売単価を引く QueryService）は価格決定 B。原価マスタ/販売単価マスタ画面は C。
- **配置**: 新規 `pricing` サブドメイン（`src/server/subdomains/pricing/`）。`ApplicablePeriod` のみ `shared`。

## 設計判断

確定済み。根拠の詳細は ADR-0066・0067 / `learning/` を参照（ここでは選択と採用のみ）。

### 集約境界（ADR-0066）
- A. 商品単位で1集約（適用期間行を内包） ← 採用
- B. TaxRate 型フラット（行＝集約）
- 採用理由: 期間重複禁止を集約内 `overlaps` で構造保証できる（B は不可）。

### 原価と共通売単価の分離（ADR-0066）
- 別集約に分離（適用期間は独立・別々に改定可） ← 採用
- 1集約に同居は不採用（独立改定で version 競合・跨る不変条件なし）。
- 本スライスでは原価集約は作らない（原価移設 issue へ）。

### 期間行の identity
- サロゲート UUIDv7（`EntityId` 基底） ← 採用
- 自然キー（product_id × 適用開始）は主キーにしない（開始日補正で identity が動き差分 upsert が壊れるため）。unique/EXCLUDE 制約側で担保。

### 期間の物理表現（ADR-0067）
- A. `daterange` 1列 ＋ `EXCLUDE USING gist (product_id WITH =, applicable_period WITH &&)` ＋ `btree_gist` ＋ `$queryRaw` ← 採用
- B. 2列＋to nullable / C. 2列＋番兵 は不採用（NULL レス・番兵レスを両立するのは A のみ）。
- 粒度は `daterange`（日付）。半開区間 `[開始, 終了)`、上端 unbounded で無期限。

### 重複禁止の置き場
- 二重防御 ← 採用: 集約内 `overlaps`（UX・早期 DomainError）＋ DB EXCLUDE（並行競合の最後の砦）。

### 集約ルートの identity / version
- ルート identity = ProductId 流用（商品と1:1の従属集約）。
- 親テーブルに version 列（ADR-0039 楽観ロック）、永続化は差分 upsert（ADR-0032）。

### 金額 VO
- `SellingUnitPrice` は Money ベース（ADR-0022）。Money は `shared` 昇格済みを使用（前提 issue）。

### Repository の責務
- `findByProductId` / `save` に限定。時点解決 read は価格決定 B の QueryService へ。

## ステップ

> TDD（Red-Green-Refactor）想定。各ステップは意味のあるまとまりでコミット（CLAUDE.md 規約）。

### Step 1: ApplicablePeriod VO（shared 共有基盤）
- 対象ファイル: `src/server/shared/domain/values/ApplicablePeriod.ts`、同 `__tests__`
- 作業内容:
  - 半開区間 `[開始, 終了)`。下端 = 適用開始日（含む）、上端 = 適用終了日（含まない）または無期限（上限なし）。
  - `contains(date)`: `開始 <= date < 終了`（無期限なら `開始 <= date`）。
  - `overlaps(other)`: 区間の重なり判定。
  - 上端 unbounded を表現（番兵を使わない）。日付粒度（時刻を持たない）。
- コミットメッセージ: `feat: 適用期間VO(ApplicablePeriod)をsharedに追加（半開区間・重なり/包含判定・無期限上端）`

### Step 2: SellingUnitPrice VO（Money ベース）
- 対象ファイル: `src/server/subdomains/pricing/domain/values/SellingUnitPrice.ts`、同 `__tests__`
- 作業内容:
  - Money（shared 昇格済み・JPY）ベースで売単価を表現。非負などの不変条件。
- コミットメッセージ: `feat: 共通販売単価のSellingUnitPrice VOをMoneyベースで実装`

### Step 3: 集約サロゲート ID VO
- 対象ファイル: `src/server/subdomains/pricing/domain/values/CommonSellingPricePeriodId.ts`（命名は実装時に最終確定）、同 `__tests__`
- 作業内容:
  - 適用期間行の identity。`EntityId` 基底（UUIDv7・`generate()`）。
- コミットメッセージ: `feat: 共通販売単価の適用期間行ID VO(UUIDv7)を実装`

### Step 4: 共通販売単価集約（ドメイン）
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`、`entities/index.ts`（バレル・ADR-0027）、同 `__tests__`
- 作業内容:
  - ルート identity = ProductId。適用期間行コレクションを内包。
  - `addPeriod(...)`: 既存区間と `overlaps` を判定し、重なれば DomainError（集約内構造保証）。
  - 集約内ドメインファクトリ（ADR-0036）で生成、`reconstruct` で再構成。
- コミットメッセージ: `feat: 共通販売単価集約を実装（商品単位・適用期間重複の集約内ガード）`

### Step 5: Prisma スキーマ＋マイグレーション
- 対象ファイル: `prisma/schema.prisma`、`prisma/migrations/<ts>_add_common_selling_price/migration.sql`
- 作業内容:
  - 親 `common_selling_prices`: `product_id`(PK・FK products)、`version`、timestamps。
  - 子 `common_selling_price_periods`: `id`(UUID PK)、`product_id`(FK)、`selling_price`(NUMERIC(12,2))、`applicable_period`(`Unsupported("daterange")`)、timestamps。
  - 手書き SQL: `CREATE EXTENSION IF NOT EXISTS btree_gist;`、`EXCLUDE USING gist (product_id WITH =, applicable_period WITH &&)`。
  - ※ dev DB は全 worktree 共有のためマイグレーション適用は `!` 委譲で実行（メモリ方針）。
- コミットメッセージ: `feat: 共通販売単価テーブルを追加（daterange＋EXCLUDE USING gist／btree_gist）`

### Step 6: Repository インターフェース（domain）
- 対象ファイル: `src/server/subdomains/pricing/domain/repositories/CommonSellingPriceRepository.ts`
- 作業内容:
  - `findByProductId(productId): CommonSellingPrice | null`、`save(aggregate, expectedVersion)`。
- コミットメッセージ: `feat: 共通販売単価Repositoryインターフェースを定義`

### Step 7: Prisma Repository 実装＋Mapper（$queryRaw）
- 対象ファイル: `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`、`infrastructure/mappers/CommonSellingPriceMapper.ts`、範囲型ヘルパ（infra 共有）、統合テスト
- 作業内容:
  - `$queryRaw`/`$executeRaw` で `daterange` の読み（`[2025-07-01,)` パース）・書き（`daterange($from,$to,'[)')`）。
  - 差分 upsert（ADR-0032）＋楽観ロック（ADR-0039・影響行数→ConflictError）。
  - 範囲型パーサ/ジェネレータは infra 共有ヘルパに隔離。
  - 統合テストで EXCLUDE 違反・楽観ロック競合・unbounded 上端の往復を検証。
- コミットメッセージ: `feat: 共通販売単価のPrisma Repository実装とMapperを追加（$queryRaw／差分upsert／楽観ロック）`

### Step 8: seed
- 対象ファイル: `prisma/seed.ts`（必要なら `prisma/seed-e2e.ts`）
- 作業内容:
  - Factory + Mapper + seed client で共通販売単価データを永続化（seed は repository を使わない・メモリ方針）。
- コミットメッセージ: `feat: 共通販売単価のseedデータを追加`

## 参考
- Issue: #426、#422
- ADR: 0064（単価固定）、0065（原価移設）、0066（集約境界）、0067（期間物理表現）、0022/0024/0026/0027/0029/0032/0036/0039
- CONTEXT.md「価格」節（適用期間・共通販売単価・原価）
- learning: `correctness-expression-layer-trilemma.md`、`aggregate-boundary-cardinality-vs-ownership.md`
