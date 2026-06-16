# Issue #349: 見積一覧の検索条件（EstimateSearchCriteria）にフィルタ機能を追加する — 実装計画

## 概要

見積一覧取得クエリ（CQRS read model）の検索条件型 `EstimateSearchCriteria` を、現状の
`Record<string, never>`（空の受け皿）から**意味のある4フィルタ項目**を持つ型へ拡張し、
`PrismaEstimateQueryService.search` に絞り込みロジックを実装する。

背景: `/estimates` 一覧フロント（#345）の実装中に、バックエンドに検索条件の受け口が無いことが
判明。#344 が「フィルタはスコープ外、空の受け皿だけ用意」と意図的に残した拡張点を、本 issue で
実フィルタ化する。商品検索（`PrismaProductQueryService.buildWhereClause`）が対称の参照実装。

> 注: #345 issue 本文の「フロントで SearchForm を再利用」は、その前提（criteria にフィルタ項目が
> ある）が未成立だったため誤り。issue 文面の修正はユーザーが別途対応（本計画のスコープ外）。

## 設計判断

### フィルタ項目セット
- A. 標準4項目（採用）: `estimateNumber` / `customerName` / `estimateType` / `activeStatus`
- B. 最小2項目（見積番号・得意先名のみ）
- C. フル（標準＋担当者＋日付範囲）
- 採用理由: 商品検索（code/name/category/isActive）と対称な4項目。#345 グリルの高需要2項目
  （見積番号・得意先名の部分一致）を含みつつ、区分・状態という一覧の定番フィルタをカバーする。

### criteria フィールドの型
- A. 素の `string`（採用）
- B. リテラルユニオン（`"ACTIVE" | "INACTIVE"` 等）
- 採用理由: 既存 `ProductSearchCriteria.category` / `EstimateSummaryDTO` と同規約。generated/prisma
  の enum を application 層に持ち込まず、Prisma 実装側で `as Prisma.Enum...Filter` にキャストする
  （DDD レイヤリング）。

### activeStatus の DB 絞り込み方式（本 issue の肝）
- A. 代表バリエーション由来の `activeStatus` を some/none に落として WHERE で絞る（採用）
- B. 全件取得後に mapper の導出結果でアプリ側フィルタ
- 採用理由: ADR-0051（`docs/adr/0051-list-representative-variation-selection-as-read-model-concern.md`）
  の代表選択規則「ACTIVE 優先の最小 → 無ければ全体の最小」の定義上、**「代表が ACTIVE」⟺「ACTIVE
  が1件以上存在」** が厳密に成立する。よって WHERE で正しく絞れる（B のアプリ側フィルタは take/件数
  と整合せず不要）。
  - `activeStatus === "ACTIVE"` → `variations: { some: { status: "ACTIVE" } }`
  - `activeStatus === "INACTIVE"` → `variations: { none: { status: "ACTIVE" } }`
  - mapper（`toSummaryDTO` の `find(ACTIVE) ?? [0]`）は無変更。WHERE と mapper が同じ等価則で整合。

### スコープ外（無変更）
- インターフェース signature（`search(criteria, options)`）/ `searchEstimatesQueryFactory` /
  `buildOrderBy` / `EstimateSummaryDTO` は変更しない。複数フィールドは AND 合成、未指定時は全件。

## ステップ

### Step 1: EstimateSearchCriteria に4フィルタ項目を定義
- 対象ファイル: `src/server/subdomains/estimate/application/queries/dto/EstimateSearchCriteria.ts`
- 作業内容:
  - `Record<string, never>` → `{ estimateNumber?; customerName?; estimateType?; activeStatus? }`（全 optional・string）
  - 各フィールドに doc コメント（許容値・部分一致/等値・some/none 方針）
  - `EstimateSortField` / `EstimateListOptions` は据え置き
- コミットメッセージ: `feat: EstimateSearchCriteria に4フィルタ項目を定義する`

### Step 2: PrismaEstimateQueryService にフィルタ絞り込みを実装
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts`
  - `src/server/subdomains/estimate/application/queries/EstimateQueryService.ts`（doc コメント更新）
- 作業内容:
  - `search` の `_criteria` → `criteria`、`where: {}` → `where: buildWhereClause(criteria)`
  - 私有 static `buildWhereClause(criteria): Prisma.EstimateWhereInput` を新設（product と同型・4分岐）
  - 「空の受け皿」記述の doc コメントを実態へ更新
- コミットメッセージ: `feat: 見積一覧にフィルタ絞り込みを実装する`
  （body: activeStatus は代表導出値だが ADR-0051 の等価則で some/none に落とした判断を記載）

### Step 3: 見積一覧フィルタの単体テストを追加
- 対象ファイル: `src/server/subdomains/estimate/application/queries/__tests__/SearchEstimatesQuery.test.ts`
- 作業内容:
  - 予約番号レンジを拡張（`N9902007` 以降をフィルタ用）し予約レンジ後フィルタで隔離
  - `describe("フィルタ（#349）")`: estimateNumber 部分一致 / customerName 一致・非一致 /
    estimateType NEW・REPAIR / activeStatus ACTIVE・INACTIVE（some/none と ADR-0051 等価則）/
    複数 AND / 未指定で全件
  - ビルダー（`estimateAggregateBuilder.ts`）は無変更
- コミットメッセージ: `test: 見積一覧フィルタの単体テストを追加する`
