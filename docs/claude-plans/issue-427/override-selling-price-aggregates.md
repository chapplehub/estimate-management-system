# Issue #427: 得意先別・納品先別販売単価集約の実装（上書き2層） — 実装計画

## 概要

価格決定機構（ADR-0064）の実装フェーズとして、販売単価の上書き2層（得意先別販売単価・納品先別販売単価）を**スキーマ＋ドメイン＋Repository の縦スライス**として実装する（#426 共通販売単価と同じ範囲）。2層は同型（キー＋売単価＋適用期間、原価は持たない）だが、独立した具象集約2つとして実装し、共有は葉 VO（`ApplicablePeriod`・`SellingUnitPrice`）に限定する。

時点解決（見積年月日で有効な単価を引く read）・Application 層・マスタ画面 UI・seed・E2E は後続（B 価格決定／C マスタ画面）へ送る。

設計判断は **ADR-20260624-8tg** に記録済み。

## 設計判断

### 2層の共通化方針（ADR-20260624-8tg）
- A. 独立した具象集約2つ・葉VOのみ共有（**採用**）
- B. スコープ判別子で1集約に統合（不採用）
- C. 抽象基底クラス＋薄いサブクラス（不採用）
- 理由: CONTEXT.md が2層を別正準語として扱い価格決定もクロス参照しない／ADR-0043（Company サブタイプ平坦化）の前例／重複の実体が小さく抽象基底のコストに見合わない

### 集約ルートの identity
- 複合自然キー: `CustomerSellingPrice` = `(CustomerId, ProductId)`、`DeliveryLocationSellingPrice` = `(DeliveryLocationId, ProductId)`。サロゲートは足さない
- 理由: 「同一キー内で期間重複ゼロ」の重複禁止キーをそのまま identity にすると集約内 `overlaps` 判定が成立する（ADR-0066・0029 と同型）

### 命名
- 納品先別は `DeliveryLocationSellingPrice`（既存の `DeliveryLocation` 系識別子に統一）。CONTEXT.md 英訳を `DeliveryLocation-specific` へ修正済み。"Destination" は採らない

### テーブル構造
- 層ごとに親子2枚・計4枚。親=複合PK＋version（ADR-0039）、子=uuid PK＋`selling_price`＋`applicable_period daterange`＋EXCLUDE`(key…, applicable_period)`＋CHECK（非負・半開区間境界）
- daterange/EXCLUDE は手書き SQL マイグレーション（ADR-0067）。`CREATE EXTENSION IF NOT EXISTS btree_gist`（既存だが冪等に再宣言）

### 原価非依存（ADR-0065）・共通との関係
- 原価列を持たないこと自体で担保。`SellingUnitPrice` VO は売単価専用
- 共通販売単価（`common_selling_prices`）への FK・存在依存は張らない。FK は `customers`/`delivery_locations`/`products` のみ。フォールバックは価格決定（B）の read 時関心

### VO 再利用
- `ApplicablePeriod`（shared）直 import／`SellingUnitPrice`（pricing 同一サブドメイン）直 import・昇格不要
- 期間行 ID は層ごとに branded VO 新設: `CustomerSellingPricePeriodId` / `DeliveryLocationSellingPricePeriodId`（`extends EntityId<...>`）

### Repository/Mapper 構成
- 共通販売単価のミラー: append-only `writePeriods`＋`ON CONFLICT (id) DO NOTHING`／`insert` は親複合PK衝突(P2002)→`ConflictError`／`update` は version 条件付き `updateMany`(count=0→`ConflictError`)／EXCLUDE(23P01) は翻訳せず DB 最後の砦
- API は `findByCustomerIdAndProductId` / `findByDeliveryLocationIdAndProductId` / `insert` / `update` に限定（時点解決は B へ）

### daterange 生 SQL の共有化（ADR-0067 履行）
- daterange 値生成と期間境界の読み projection を `Prisma.sql` フラグメントとして `src/server/shared/infrastructure/` に抽出し、**common 含む3層で共用**（既存 #426 リポジトリもリファクタして採用）
- 理由: 消費者が3つになり rule of three 成立。半開区間 `[)` の不変条件を1か所に集約。3層中2層だけ共用は最悪なので一斉適用

## ステップ

### Step 1: 共有 infra ヘルパの抽出（daterange 読み書き）
- 対象ファイル: `src/server/shared/infrastructure/dateRange.ts`（新規）＋テスト、`PrismaCommonSellingPriceRepository.ts`（リファクタ）
- 作業内容:
  - daterange 値生成（`daterange($start::date, $end::date, '[)')`）と期間境界読み projection（`lower()/upper()::text`）を `Prisma.sql` フラグメントとして切り出す
  - 既存 common リポジトリをヘルパ採用にリファクタ（テストが緑のままを確認）
- コミットメッセージ: `refactor: daterange の生SQLを共有infraヘルパへ抽出しcommonへ適用`

### Step 2: 得意先別販売単価 — ドメイン（VO・期間行・集約）＋テスト
- 対象ファイル: `src/server/subdomains/pricing/domain/values/CustomerSellingPricePeriodId.ts`、`domain/entities/CustomerSellingPricePeriod.ts`、`domain/entities/CustomerSellingPrice.ts`、各 `__tests__`、`entities/index.ts`・barrel 追従
- 作業内容:
  - branded 期間行 ID VO、期間行子エンティティ、集約ルート（identity=`(CustomerId, ProductId)`・`create`/`reconstruct`/`addPeriod` overlaps 判定）を `CommonSellingPrice` と同型で実装
- コミットメッセージ: `feat: 得意先別販売単価のドメイン（集約・期間行・ID VO）を実装`

### Step 3: 得意先別販売単価 — スキーマ＋マイグレーション
- 対象ファイル: `prisma/schema.prisma`、`prisma/migrations/{ts}_add_customer_selling_price/migration.sql`（手書き）
- 作業内容:
  - 親 `customer_selling_prices`（複合PK＋version）＋子 `customer_selling_price_periods`（daterange・Unsupported）を定義
  - 手書き SQL で EXCLUDE`(customer_id, product_id, applicable_period)`・CHECK（非負・半開区間境界）・FK・btree_gist
- コミットメッセージ: `feat: 得意先別販売単価のスキーマとマイグレーション（daterange+EXCLUDE）`

### Step 4: 得意先別販売単価 — Repository/Mapper＋統合テスト
- 対象ファイル: `domain/repositories/CustomerSellingPriceRepository.ts`、`infrastructure/mappers/CustomerSellingPriceMapper.ts`、`infrastructure/prisma/PrismaCustomerSellingPriceRepository.ts`、`__tests__`
- 作業内容:
  - インターフェース（`findByCustomerIdAndProductId`/`insert`/`update`）、Mapper、Prisma 実装（Step 1 のヘルパ使用・append-only・version 楽観ロック・P2002 翻訳）
- コミットメッセージ: `feat: 得意先別販売単価のRepository/Mapper（Prisma実装）`

### Step 5: 納品先別販売単価 — ドメイン＋テスト
- 対象ファイル: `domain/values/DeliveryLocationSellingPricePeriodId.ts`、`domain/entities/DeliveryLocationSellingPricePeriod.ts`、`domain/entities/DeliveryLocationSellingPrice.ts`、各 `__tests__`・barrel 追従
- 作業内容: Step 2 と同型で納品先別（identity=`(DeliveryLocationId, ProductId)`）を実装
- コミットメッセージ: `feat: 納品先別販売単価のドメイン（集約・期間行・ID VO）を実装`

### Step 6: 納品先別販売単価 — スキーマ＋マイグレーション
- 対象ファイル: `prisma/schema.prisma`、`prisma/migrations/{ts}_add_delivery_location_selling_price/migration.sql`
- 作業内容: Step 3 と同型で `delivery_location_selling_prices` ＋ `delivery_location_selling_price_periods`
- コミットメッセージ: `feat: 納品先別販売単価のスキーマとマイグレーション（daterange+EXCLUDE）`

### Step 7: 納品先別販売単価 — Repository/Mapper＋統合テスト
- 対象ファイル: `domain/repositories/DeliveryLocationSellingPriceRepository.ts`、`infrastructure/mappers/DeliveryLocationSellingPriceMapper.ts`、`infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository.ts`、`__tests__`
- 作業内容: Step 4 と同型（API は `findByDeliveryLocationIdAndProductId`）
- コミットメッセージ: `feat: 納品先別販売単価のRepository/Mapper（Prisma実装）`

> 備考: Step 3/6 のマイグレーションは dev DB が全 worktree 共有でドリフトしやすいため、`prisma migrate` 実行は `!` 委譲で行う。
