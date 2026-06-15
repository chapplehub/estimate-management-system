# Issue #344: 見積一覧取得クエリ（アプリ層 / インフラ層） — 実装計画

## 概要

見積一覧画面（フロントは別 issue）が依存する CQRS read model を実装する。一覧 1 行 = 見積 1 件（Estimate 単位）で、金額・状態は「代表バリエーション」の値を表示する。軽量 DTO `EstimateSummaryDTO` と検索メソッド `EstimateQueryService.search` を新設し、商品の `SearchProductsQuery` 系に対称な構成を取る。詳細用 `EstimateDetailDTO`（全リレーション eager load）は流用しない。

本計画は `/grill-with-docs` で合意した内容の結晶化。代表選択の設計は **ADR-0050** に記録済み。用語（代表バリエーション・表示ステータス・バリエーション状態）は `CONTEXT.md` に追記済み。

## 設計判断

### 代表バリエーションの選択ルール（ADR-0050 で確定）
- A. `variationNumber = 1` 固定（不採用。無効化された 1 番を代表にしてしまう／全 INACTIVE で破綻）
- B. **ACTIVE 優先の最小 `variationNumber` → 無ければ全体の最小**（採用）
- 採用理由: 物理削除は無いが無効化は可能で全 INACTIVE は正規状態。最低 1 バリエーションの不変条件により常に存在・決定的。`activeStatus` は全 INACTIVE 見積でも正直に INACTIVE を返す。

### 代表選択ロジックの配置
- read 専用の表示都合でありドメイン不変条件ではないため、**infra 層（`PrismaEstimateQueryService`）の read model に閉じる**（ADR-0013 と同じ思想）。賢い選択への将来拡張も write 側・ドメインに影響しない。

### 状態の 2 軸
- `activeStatus`: 代表の有効/無効（`VariationStatus`）。本 issue で**実値**。
- `displayStatus`: 表示ステータス（設計書 §1.3 の導出値・union 型 `EstimateDisplayStatus`）。本 issue では**常に `null`（場所だけ予約）**。共通申請テーブル（ADR-0001）・`Order` 系は未実装のため join しない。導出は将来の承認/受注 issue。

### 検索条件・並び替え
- `EstimateSearchCriteria` = `Record<string, never>`（空の受け皿。フィルタは本 issue 未実装）。
- `EstimateListOptions { limit?; offset?; orderBy?: SortOrder<EstimateSortField> }`。`EstimateSortField` = `estimateNumber | estimateDate | deadline | createdAt`。
- `buildOrderBy`: 未指定 → `[deadline asc, createdAt asc, estimateNumber asc]` / 指定 → `[{field:dir}, {estimateNumber:asc}]`（第 2 キー安定化）。

### DTO フィールド（12 件）
- `estimateId`, `estimateNumber`, `estimateType`, `estimateDate`, `deadline`, `customerCode`, `customerName`, `creatorCode`, `creatorName`, `finalTotal`, `activeStatus`, `displayStatus`
- 関連エンティティはコード＋名称で解決（FK の ID は持たない）。`estimateType`/`activeStatus` は `string`、`displayStatus` のみ union（ADR-0013）。

### 命名（商品クエリと対称）
- クラス `SearchEstimatesQuery` / メソッド `EstimateQueryService.search` / ファクトリ `searchEstimatesQueryFactory`。

### テスト方針
- ビルダー（`estimateAggregateBuilder.ts`）は**変更しない**（影響範囲を抑える）。並び順検証は `prisma.estimate.update` で締切を散らす（単体テストは prisma 直叩き可）。
- 単一 DB 結合テストで実物の `PrismaEstimateQueryService` を通す（代表選択ロジックまで検証）。A1（空条件）ゆえ予約番号レンジで後フィルタ。

## ステップ

### Step 1: 一覧用 DTO と入力型を新設
- 対象ファイル: `src/server/subdomains/estimate/application/queries/dto/EstimateSummaryDTO.ts`, `.../dto/EstimateSearchCriteria.ts`
- 作業内容:
  - `EstimateSummaryDTO`（12 フィールド）と `EstimateDisplayStatus`（8 値の union）を定義
  - `EstimateSearchCriteria = Record<string, never>`、`EstimateListOptions`、`EstimateSortField` を定義
- コミットメッセージ: `feat: 見積一覧 read model の DTO・検索条件型を新設（EstimateSummaryDTO / EstimateSearchCriteria）`

### Step 2: QueryService インターフェース拡張とアプリ層クエリ
- 対象ファイル: `.../application/queries/EstimateQueryService.ts`, `.../application/queries/SearchEstimatesQuery.ts`
- 作業内容:
  - `EstimateQueryService` に `search(criteria, options): Promise<EstimateSummaryDTO[]>` を追加（`findByEstimateNumber` と並置）
  - `SearchEstimatesQuery`（薄い委譲・`GetEstimateDetailQuery` と同型）を新設
- コミットメッセージ: `feat: 見積一覧取得クエリ（アプリ層）を追加（EstimateQueryService.search / SearchEstimatesQuery）`

### Step 3: Prisma 実装（代表選択・名前解決・並び順）
- 対象ファイル: `.../infrastructure/queries/PrismaEstimateQueryService.ts`
- 作業内容:
  - `estimate.findMany` + バリエーションを軽量 3 列（`variationNumber`/`status`/`finalTotal`、昇順）だけ `include`
  - `pickRepresentative`: `find(v => v.status === "ACTIVE") ?? variations[0]`
  - `customer`（code/name）・`creator`（employeeCd/name）の名前解決
  - `buildOrderBy`（多段既定／第 2 キー安定化）、`take: LIST_FETCH_LIMIT`、`displayStatus` は常に `null`
- コミットメッセージ: `feat: 見積一覧取得を PrismaEstimateQueryService に実装（代表バリエーション選択・ADR-0050）`（body に代表選択を infra に閉じる理由を記載）

### Step 4: ファクトリ追加
- 対象ファイル: `.../application/factories/estimateQueryFactory.ts`
- 作業内容: `searchEstimatesQueryFactory`（`new SearchEstimatesQuery(new PrismaEstimateQueryService())`）を追加
- コミットメッセージ: `feat: searchEstimatesQueryFactory を追加`

### Step 5: 単体テスト
- 対象ファイル: `.../application/queries/__tests__/SearchEstimatesQuery.test.ts`
- 作業内容:
  - 予約番号レンジを新設し、返り値を予約番号で後フィルタ
  - 代表選択 3 ケース（全 ACTIVE→最小／最小 INACTIVE・上位 ACTIVE→ACTIVE 中の最小／全 INACTIVE→全体最小。`buildNewEstimate(..., { variationNumbers:[1,2,3] })` ＋ `deactivateVariation()`）
  - `displayStatus` 常に null、`finalTotal`/`activeStatus` が代表由来、`customerCode/Name`・`creatorCode/Name` 解決
  - 並び順（`prisma.estimate.update` で締切を散らし `deadline asc` 既定＋第 2 キーを検証）
  - ビルダーは変更しない
- コミットメッセージ: `test: 見積一覧取得クエリの単体テストを追加`
