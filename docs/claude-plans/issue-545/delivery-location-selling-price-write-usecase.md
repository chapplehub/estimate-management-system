# Issue #545: 納品先別販売単価の書き込みユースケース（ドメイン編集操作 + commands/factories） — 実装計画

## Context

納品先別販売単価 `DeliveryLocationSellingPrice` は、集約・スキーマ・時点解決 QueryService まで実装済みだが、
編集系の「書き込み」関心が未実装。現状の集約は `addPeriod`（追加）しか持たず、application 層に
コマンドも factory も無いため、画面から登録・編集・改定・適用終了・削除ができない。

本 Issue は親 #544 の分割のうち **BE 書き込み側**。既に完成している **得意先別 #505**（`CustomerSellingPrice`）が
ほぼ完全なテンプレートで、identity が複合自然キー `DeliveryLocationId × ProductId` である点だけが異なる。
得意先別と同型に補完し、納品先別の書き込みユースケースを機能させることが目的。

**調査で判明した重要事実**: Issue 本文の「含む」スコープはドメイン編集操作 + commands + factories を挙げるが、
現状の `PrismaDeliveryLocationSellingPriceRepository` は **追記専用（append-only, `ON CONFLICT DO NOTHING`）**で
実装されている（過去に mutation が `addPeriod` のみだった前提）。`editPeriod`（将来行の内容差し替え）・
`endDatePeriod`（終了日書き換え）・`deletePeriod`（行削除）は既存行の in-place 更新・削除を伴うため、
追記専用のままではこれらの書き込みが**黙って失われる**。したがってインフラ層の改修が必須で、
ユーザー確認済みで本 Issue に含める。

## 設計判断

### 全体方針: 得意先別 #505 の完全踏襲
- 得意先別（`CustomerSellingPrice` 集約 / `*CustomerSellingPricePeriodCommand` / `*CommandFactory`）を
  identity（`CustomerId` → `DeliveryLocationId`）だけ差し替えて模倣する。参照日注入（input に `referenceDate`）・
  楽観ロック（input に `expectedVersion`、既存集約追加時は必須で未指定は `ValidationError`）・結果型（登録後の集約を返す）は
  すべて得意先別と同一契約。判断不要（既存パターン踏襲）。

### インフラ層の期間行永続化ヘルパの共有範囲（Issue の未決事項）
- 共通ヘルパ `sellingPricePeriodPersistence.ts` に差分同期版 `syncPeriodRows`（upsert＋消えた id の削除）が
  **既に存在**し、得意先別リポジトリが使用中。納品先別も `update()` を `appendPeriodRows` → `syncPeriodRows` へ
  切替え、`delete()` を追加するだけでよい。**ヘルパ自体の改修は不要**。判断不要。

### factory の「pricingQueryFactory への配線」の解釈
- Issue は「`pricingQueryFactory` への配線含む」と記すが、得意先別の書き込み factory は
  `registerCustomerSellingPricePeriodCommandFactory.ts` 等の**独立ファイル**として実装されており、
  `pricingQueryFactory.ts`（読みモデル/時点解決 query の factory 群）には**書き込みコマンドは配線されていない**。
- 推奨: 得意先別踏襲で独立 factory ファイル 5 本を新設し、`pricingQueryFactory.ts` は**変更しない**。
  （書き込み factory を pricingQueryFactory に集約する構成変更は本 Issue の関心外）

### 状態別（future / active / expired）の編集・削除権限
- 集約の不変条件として得意先別と同一に展開する（判断不要）:
  editPeriod=将来行のみ / endDatePeriod=現在有効行のみ・短縮限定 / deletePeriod=未来開始行のみ /
  addPeriod=開始日 ≥ 参照日・重複禁止。すべて `BusinessRuleViolationError`。

### スコープ逸脱の記録
- Issue「含む」に無いインフラ層改修を追加するため、完了時に `docs/claude-plans/issue-545/deviations.md` へ
  {元の計画=含むにインフラ層記載なし}／{実際=書き込み機能に必須のため追加}／{理由} を記録する（CLAUDE.md 準拠）。

## ステップ

### Step 1: ドメイン層 — 編集操作の補完
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/DeliveryLocationSellingPricePeriod.ts`
  - `src/server/subdomains/pricing/domain/entities/DeliveryLocationSellingPrice.ts`
  - `src/server/subdomains/pricing/domain/entities/__tests__/DeliveryLocationSellingPrice.test.ts`
- 作業内容（得意先別を鏡像コピー）:
  - 子エンティティ: `_period`/`_price` を mutable 化し、`changeTo(period, price)` と `endDateOn(endDate)` を追加
    （`CustomerSellingPricePeriod.ts` L33-48 と同一）
  - 集約ルート: `addPeriod` に `referenceDate` 引数を追加（`assertStartNotPast`）。
    `editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod` / `isEmpty` getter と、
    private helper `requireRow` / `isFuture` / `assertStartNotPast` / `assertNoOverlap` を追加
    （`CustomerSellingPrice.ts` L79-233 と同一。ENTITY_NAME だけ「納品先別販売単価」）
  - 集約テスト: 得意先別 `CustomerSellingPrice.test.ts`（34 ケース）を鏡像に拡充。
    編集・適用終了・削除・現在有効行取得・過去不変ガード・状態別権限を網羅
- コミットメッセージ: `feat: 納品先別販売単価集約に編集系ミューテータを補完（edit/endDate/delete/currentValid）`

### Step 2: インフラ層 — 差分同期化と delete 追加
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/repositories/DeliveryLocationSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/infrastructure/prisma/__tests__/PrismaDeliveryLocationSellingPriceRepository.test.ts`
- 作業内容（得意先別リポジトリ L80-143 と同型）:
  - interface に `delete(aggregate, expectedVersion): Promise<void>` を追加（`CustomerSellingPriceRepository` L36-46 相当）
  - Prisma 実装: `PERIOD_TABLE` を static 定数化。`update()` の `writePeriods`（append）を
    `syncPeriodRows(tx, PERIOD_TABLE, [deliveryLocationId, productId], toWriteRows)` へ切替。
    `writePeriods`（`appendPeriodRows`）は insert 専用として残す。`delete()` を `deleteMany`＋`assertVersionBumped` で追加。
    クラス doc の「append-only で削除分岐は到達不能」の記述を差分 sync 前提へ更新
  - リポジトリテスト: 得意先別テストの追加ケースを移植 — 将来行の in-place 編集反映／消えた行の削除／
    最終行削除で 0 件（空配列バインド）／`delete` の cascade／`delete` の古い version で ConflictError／
    delete 後の再 insert 成功。既存の「append-only」文言のテストを sync 前提へ修正
- コミットメッセージ: `feat: 納品先別販売単価リポジトリを差分sync化しdeleteを追加（編集・適用終了・削除の永続化）`
  - ボディに「append-only→syncPeriodRows 切替の理由（edit/endDate/delete が既存行の in-place 更新・削除を伴うため）」を記載

### Step 3: application/commands — 共有ヘルパ + Register
- 対象ファイル（新規）:
  - `src/server/subdomains/pricing/application/commands/loadDeliveryLocationSellingPriceOrThrow.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterDeliveryLocationSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/__tests__/RegisterDeliveryLocationSellingPricePeriodCommand.test.ts`
- 作業内容:
  - `loadDeliveryLocationSellingPriceOrThrow`: `findByDeliveryLocationIdAndProductId` で取得し無ければ `NotFoundEntityError`
    （得意先別 `loadCustomerSellingPriceOrThrow.ts` と同型）
  - Register: 未設定なら `ProductQueryService.findById` で区分取得 → `DeliveryLocationSellingPrice.create`（セット商品ガード・
    **create() の初回呼び出し元**・#531 申し送り確認）→ `addPeriod` → `insert`。既存なら `expectedVersion` 必須で `addPeriod` → `update`
    （得意先別 `RegisterCustomerSellingPricePeriodCommand.ts` L41-78 と同一）
  - テストは得意先別 Register テストを鏡像に移植
- コミットメッセージ: `feat: 納品先別販売単価の登録コマンドと取得ヘルパを追加`

### Step 4: application/commands — 編集系 4 種（Edit / EndDate / Delete / Revise）
- 対象ファイル（新規、各コマンド + テスト）:
  - `Edit` / `EndDate` / `Delete` / `Revise` `DeliveryLocationSellingPricePeriodCommand.ts` と `__tests__/*`
- 作業内容:
  - いずれも `loadDeliveryLocationSellingPriceOrThrow` で集約取得後、対応ミューテータを呼んで `update`
    （Delete のみ `aggregate.isEmpty` で `delete`/`update` を分岐、Revise は endDate→addPeriod の順で合成）。
    得意先別の同名コマンドを identity 差し替えで鏡像コピー
  - 各コマンドテストも得意先別から移植
- コミットメッセージ: `feat: 納品先別販売単価の編集・適用終了・削除・改定コマンドを追加`

### Step 5: application/factories — 書き込みコマンドの DI
- 対象ファイル（新規 5 本）:
  - `register` / `edit` / `revise` / `endDate` / `delete` `DeliveryLocationSellingPricePeriodCommandFactory.ts`
- 作業内容:
  - 各 factory は `new PrismaDeliveryLocationSellingPriceRepository()` を注入して対応コマンドを構築。
    Register のみ `new PrismaProductQueryService()` も注入（得意先別 factory 群と同型）。
  - `pricingQueryFactory.ts` は変更しない（設計判断参照）。factory はテスト対象外（薄い DI・得意先別も無し）
- コミットメッセージ: `feat: 納品先別販売単価 書き込みコマンドの factory を追加`

### Step 6: 逸脱記録
- 対象ファイル: `docs/claude-plans/issue-545/deviations.md`（新規）
- 作業内容: インフラ層改修をスコープに追加した経緯を記録（設計判断「スコープ逸脱の記録」参照）
- コミットメッセージ: `docs: issue-545 のスコープ逸脱（インフラ層追加）を記録`

## 検証

- **ユニット/統合**: 変更に関係するスペックのみ実行（ローカルで全 E2E は回さない）
  ```bash
  pnpm test src/server/subdomains/pricing/domain/entities/__tests__/DeliveryLocationSellingPrice.test.ts
  pnpm test src/server/subdomains/pricing/infrastructure/prisma/__tests__/PrismaDeliveryLocationSellingPriceRepository.test.ts
  pnpm test src/server/subdomains/pricing/application/commands/__tests__/  # 5 コマンド
  ```
  - リポジトリテストは実 DB を使う統合テスト。差分 sync（in-place 編集反映・消えた行削除・空集約 delete）と
    delete の cascade / ConflictError が緑になることを確認
- **型/lint**: `pnpm lint`（子エンティティを集約外から import していないか eslint `no-restricted-imports` で担保されることも確認）
- **レイヤ規約**: ドメイン層が Prisma/Next を import していないこと、application が repository **interface** に依存していることを確認（CLAUDE.md DDD ルール）
- **読みモデル/FE は本 Issue 対象外**（#546 以降）。書き込みコマンドが集約経由で永続化まで通ることをテストで担保する
