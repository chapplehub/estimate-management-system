# Issue #448: 共通販売単価の時点解決QueryService(価格決定B) — 実装計画

## 概要

見積年月日で有効な共通販売単価を引く、read 関心の時点解決 QueryService を実装する（価格決定フェーズ B）。#426 で共通販売単価集約（書き込み側）と `ApplicablePeriod.contains` が実装済み。ADR-0066 で「時点解決は read 関心として QueryService に置く／Repository は `findByProductId`・`insert`・`update` に限定」と決まっており、本 issue でその read 側を埋める。後続 A2（得意先別・納品先別販売単価）の時点解決の土台になる。

`pricing` サブドメインに**共通レイヤー1本だけ**を縦に実装する。SQL の `applicable_period @> $date::date` で0/1行を直接引き、集約ロードを介さず DTO を返す。

## 設計判断

グリルセッション（`/grill-with-docs`）で全論点を確定済み。

### 時点解決の機構（確定: SQL `@>`）
- A. SQL `@>` で1行を直接引く（集約ロードなし・DTO 返却）
- B. 集約を `findByProductId` でロードし `contains` で絞る
- **採用: A**。issue の「集約ロードを介さず効率的に引きたい」要件と、既存 QueryService 規約（Repository・集約を触らず Prisma 直当てで DTO を返す）に整合。`@>` と `contains` はともに半開 `[)`（ADR-0067 が `dateRangeValue` の `'[)'` で固定）のため乖離しない。

### 時点入力の型（確定: 暦日文字列） → **ADR-20260624-95f 起票済み**
- A. `"YYYY-MM-DD"` 暦日文字列（Date→JST 変換は価格決定側）
- B. `Date` を受けて QueryService 内部で変換
- **採用: A**。`Date` を `$queryRaw ... ::date` に直渡しするとセッション TZ 依存の off-by-one を抱える。リテラル暦日は曖昧さゼロ。Date→JST 暦日変換は業務暦の意味が分かる価格決定側に1箇所集約し、A2 の3層での変換再演を避ける。税率 `findEffectiveAt(date: Date)` は timestamptz 同士の瞬間比較で暦日変換が無く、前例として転用しない。

### 0件・複数件の扱い（確定: null 返却・ガードなし）
- 0件 → `null` を返す。解決不能の翻訳（エラー化）・画面メッセージ化は文脈を持つ上位（価格決定／presentation）の責務。`findEffectiveAt` が null を返しドメインサービスで翻訳するのと同型。
- 複数件 → ガードを置かない。`applicable_period` の EXCLUDE が区間重複ゼロを物理保証し `@>` は構造的に最大1件。`length > 1` の throw は到達不能・テスト不能な死にコードになる（チーム明文方針）。`rows[0] ?? null` で先頭を取る（`findFirst` と同型）。`LIMIT 1` も冗長なので付けない。
- 「商品に共通単価行が無い」と「行はあるが当日を覆う区間が無い」は区別しない（今回のメッセージ要件は両者を同じ扱いにできる）。

### DTO の単価表現（確定: string）
- A. `sellingPrice: string`（`::text`、消費側が `Money.fromDecimalString` で包む）
- B. `number`（`EstimateDetailDTO` 流）
- **採用: A**。返す単価は表示用の終端値ではなく価格決定の入力（見積単価になり四則演算を受ける）。pricing Mapper の「float64 を通さず厳密変換」規律が当てはまる。`EstimateDetailDTO` の `number` は表示専用前例なので転用しない。ドメイン VO（Money/SellingUnitPrice）は直接返さず、包む責務は消費側に置く。

### A2 一般化の範囲（確定: 共通1本に絞る）
- 共通レイヤー QueryService 1本のみ実装。
- `@>` 述語はインライン。`dateRange.ts` への共有フラグメント抽出・3層汎用化は **A2 送り**（rule of three）。`@>` は守るべき不変条件を持たないため co-locate の利得が薄く、現利用者は1人。

### 配置（規約確定・判断不要）
既存 QueryService 規約（customer 等）を踏襲。`application/queries/` に IF＋DTO、`infrastructure/queries/` に Prisma 実装、`application/factories/` で結線、薄いユースケースラッパも置く。

## ステップ

### Step 1: QueryService インターフェースと DTO
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/CommonSellingPriceQueryService.ts`
  - `src/server/subdomains/pricing/application/queries/dto/CommonSellingPriceResolutionDTO.ts`
- 作業内容:
  - `CommonSellingPriceResolutionDTO`: `{ sellingPrice: string }`（10進文字列・`Money.fromDecimalString` で包む前提を doc コメントに明記）
  - `CommonSellingPriceQueryService` IF: `resolve(input: { productId: string; date: string }): Promise<CommonSellingPriceResolutionDTO | null>`（`date` は `"YYYY-MM-DD"` 暦日・ADR-20260624-95f を参照）
- コミットメッセージ: `feat: 共通販売単価 時点解決 QueryService の IF と DTO を定義`

### Step 2: Prisma QueryService 実装
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceQueryService.ts`
- 作業内容:
  - `$queryRaw` で `SELECT selling_price::text AS "sellingPrice" FROM common_selling_price_periods WHERE product_id = ${productId}::uuid AND applicable_period @> ${date}::date`
  - `rows[0] ?? null` を返す（複数件ガードなし・EXCLUDE に委ねる）
  - クラス doc に「集約ロードなし／`@>` インライン（共有フラグメント抽出は A2 送り）／ADR-0066・0067・20260624-95f」を記載
- コミットメッセージ: `feat: 共通販売単価 時点解決 QueryService の Prisma 実装（@> で時点直引き）`

### Step 3: ユースケースラッパと factory
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/ResolveCommonSellingPriceQuery.ts`
  - `src/server/subdomains/pricing/application/factories/{命名は既存規約に合わせる}.ts`
- 作業内容:
  - `ResolveCommonSellingPriceQuery`: コンストラクタで QueryService を受け `execute({ productId, date })` を公開（`GetCustomerByIdQuery` と同型）
  - factory で `PrismaCommonSellingPriceQueryService` を結線
- コミットメッセージ: `feat: 共通販売単価 時点解決のユースケースラッパと factory を追加`

### Step 4: 統合テスト（境界日リグレッション）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceQueryService.test.ts`
- 作業内容:
  - ヒット: 区間内の日で単価を引く
  - 境界: `start` ちょうど → 含む／`end` ちょうど → 含まない（半開 `[)` を突き `@>` ≡ `ApplicablePeriod.contains` を担保）
  - 0件: 区間外の日・未登録商品で `null`
  - 無期限上端（`end = null`）の区間で遠い未来日がヒット
- コミットメッセージ: `test: 共通販売単価 時点解決 QueryService の境界日・0件テストを追加`
