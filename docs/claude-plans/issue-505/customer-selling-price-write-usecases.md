# Issue #505: 得意先別販売単価の書き込みユースケース（ドメイン編集操作 + commands/factories） — 実装計画

## 概要

得意先別販売単価（`CustomerSellingPrice`）の「書き込み」関心を実装する。**動作中の共通販売単価 BE（`CommonSellingPrice` 集約 + 5 コマンド + `loadCommonSellingPriceOrThrow` + factories + `PrismaCommonSellingPriceRepository`）を得意先別へ完全写像**する。得意先軸の差分は複合自然キー `(CustomerId, ProductId)` が identity である一点のみ（ADR-20260624-8tg）で、それ以外の業務ルール・永続化パターンは共通と同一。

現状の得意先別は集約が `addPeriod`（過去ガード無し）のみ・コマンドゼロ。リポジトリは #460 時点の append-only 実装のまま。本計画で共通と同水準まで引き上げる。

- **含む**: 集約の編集系ミューテータ（`editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod`、および `addPeriod` への参照日ガード）／application commands 5 種（Register / Edit / EndDate / Delete / Revise）＋共有ロードヘルパ／factories／リポジトリの差分 sync 化／テスト一式
- **含まない**: 読みモデル（一覧・編集 QueryService / DTO）、FE 一切、納品先別（DeliveryLocation）への波及、E2E（いずれも別イシュー）

## 設計判断

### リポジトリの infra 変更をスコープに含めるか
- A. 含める（`PrismaCommonSellingPriceRepository` を完全写像。insert=`appendPeriodRows`／update=`syncPeriodRows`）
- B. 含めない（既存 append-only を温存）
- **採用: A**。理由: 集約に `editPeriod`（既存 id の in-place 変更）・`deletePeriod`（行の除去）を足すと、現行 update の `appendPeriodRows`（`ON CONFLICT (id) DO NOTHING`）では編集が黙って握り潰され・削除が DB に残存し、コマンドが機能しない。#460 の古い実装は温存せず、動作中の共通リポジトリを写像する（既に共有ヘルパ `sellingPricePeriodPersistence` が存在するため新規ロジック無し）。

### ドメインルールの写像度（得意先軸固有ルールの有無）
- A. 共通の完全ミラー・得意先固有ルールを足さない
- B. 得意先軸に固有ルール（跨集約の存在チェック等）を追加
- **採用: A**。理由: 温度ガード（将来行=編集/削除可・現在有効行=適用終了のみ・失効行=不可／ADR-20260627-86b）、結果型（集約を返す・失敗は例外・union 不使用／ADR-0037-0038）、楽観ロック（Register は既存追加時のみ expectedVersion 必須／ADR-0039）、参照日注入（`referenceDate` を入力で受けサーバー生成は上流の別イシュー）はすべて共通と同一。跨集約チェック（対応する共通販売単価の存在・Customer 実在）は**入れない** — CONTEXT.md「適用終了」注記が「最低1期間の保証は跨集約ハード強制せず価格決定の安全弁で担保」と明言し #476 でハード強制は不採用。

### 納品先別（DeliveryLocation）への同時波及
- A. 触れない（得意先別のみ共通へ追いつかせる）
- B. 同型2層として納品先別も同時にミューテータ補完
- **採用: A**。理由: 親 #492 は得意先別保守の分割。ADR-20260624-8tg の「同型」は集約構造の同型であり全レイヤー機能の同時実装を約束しない（既に共通↔上書き2層で非対称は存在）。納品先別への写像は同型ゆえ後日ほぼ機械作業で追随できる。「1回1スコープ」方針にも沿う。

### ADR 起票 / CONTEXT.md 更新
- **不要**。本計画の判断はすべて既存 ADR の適用（8tg 同型／86b 温度ガード／0032 差分 upsert／0037-0038 結果型／0039 楽観ロック／0018 独立 EndDate／0067 daterange）であり、「反転しにくい・文脈なしに驚く・真のトレードオフ」の3条件を満たす新規判断が無い。用語集（得意先別販売単価/適用終了/単価改定/失効/適用期間）も完備。

### 実装方式（TDD）
- 依存の向き **ドメイン（純粋）→ リポジトリ（実DB往復）→ コマンド（実DB・実 Customer/Product 前提）** に従い red-green-refactor で進める。共通側コマンドテストが実 `Prisma*Repository` を直接注入し実 Product を FK 生成するため、リポジトリの sync 化をコマンド実装より前に置く。

## ステップ

### Step 1: ドメイン集約 CustomerSellingPrice のミューテータ補完（TDD・純粋ドメイン）
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CustomerSellingPrice.ts`
  - `src/server/subdomains/pricing/domain/entities/__tests__/CustomerSellingPrice.test.ts`
  - 署名変更で影響する既存テスト（コンパイル修復）: `application/queries/__tests__/ResolveCustomerSellingPriceQuery.test.ts` / `infrastructure/queries/__tests__/PrismaCustomerSellingPriceQueryService.test.ts` / `infrastructure/prisma/__tests__/PrismaCustomerSellingPriceRepository.test.ts` / `application/queries/__tests__/ResolveSellingPriceQuery.test.ts`
- 作業内容:
  - Red: `CommonSellingPrice.test.ts` を写し、`addPeriod` の過去開始拒否・`editPeriod`（将来行のみ・過去開始拒否・重複拒否）・`endDatePeriod`（現在有効行のみ・短縮限定・今日以前拒否・`assertNoOverlap`）・`deletePeriod`（未来行のみ）・`currentValidPeriod` のケースを追加
  - Green: `addPeriod` に第3引数 `referenceDate` と `assertStartNotPast` を追加、`editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod` と private ヘルパ（`requireRow` / `isFuture` / `assertStartNotPast` / `assertNoOverlap`）を実装
  - 署名変更で壊れる既存テストの `addPeriod(...)` 呼び出しに `referenceDate`（＝開始日）を機械付与してコンパイル復旧
- コミットメッセージ: `feat: 得意先別販売単価 集約の編集系ミューテータを補完`
  - body: 共通販売単価集約の完全ミラー。addPeriod に参照日注入の過去不変ガードを追加し editPeriod/endDatePeriod/deletePeriod/currentValidPeriod を実装（ADR-20260624-8tg / 20260627-86b）。

### Step 2: リポジトリを共通実装へ写像（TDD・実DB往復）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/infrastructure/prisma/__tests__/PrismaCustomerSellingPriceRepository.test.ts`
- 作業内容:
  - Red: 編集の in-place 反映（`updated_at` 挙動含む）・削除行の消滅・楽観ロック競合の往復テストを追加
  - Green: `update()` を `syncPeriodRows` へ切り替え、`PERIOD_TABLE` 定数・`toWriteRows` を分離、`insert()` は `appendPeriodRows` 維持。クラスコメントを刷新（append-only 前提の旧根拠を差分 sync 前提へ）
- コミットメッセージ: `feat: 得意先別販売単価リポジトリを差分sync同期へ`
  - body: #460 の append-only 実装を PrismaCommonSellingPriceRepository へ写像。update は syncPeriodRows で編集・適用終了・削除を反映し無変更行の updated_at は据え置く（ADR-0032 / 0039）。

### Step 3: 登録コマンド Register（TDD・実DB）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/RegisterCustomerSellingPricePeriodCommand.ts`（+ `__tests__`）
  - `src/server/subdomains/pricing/application/factories/registerCustomerSellingPricePeriodCommandFactory.ts`
- 作業内容:
  - Red→Green: 未設定 (customer,product) は新規 insert（version 1）・既存は addPeriod + update（expectedVersion 必須、未指定は ValidationError）。実 Customer + Product を FK 生成する fixture でテスト
  - factory で `PrismaCustomerSellingPriceRepository` を DI
- コミットメッセージ: `feat: 得意先別販売単価 登録コマンド（Register）`

### Step 4: 共有ロードヘルパ + 編集コマンド Edit（TDD・実DB）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/loadCustomerSellingPriceOrThrow.ts`
  - `src/server/subdomains/pricing/application/commands/EditCustomerSellingPricePeriodCommand.ts`（+ `__tests__`）
  - `src/server/subdomains/pricing/application/factories/editCustomerSellingPricePeriodCommandFactory.ts`
- 作業内容:
  - `loadCustomerSellingPriceOrThrow(repository, customerId, productId)`：`findByCustomerIdAndProductId` で取得し null なら `NotFoundEntityError`
  - Red→Green: Edit は集約取得 → `editPeriod` → update（expectedVersion 必須）。状態違反は集約が BusinessRuleViolationError
- コミットメッセージ: `feat: 得意先別販売単価 編集コマンド（Edit）と共有ロードヘルパ`

### Step 5: 適用終了コマンド EndDate（TDD・実DB）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/EndDateCustomerSellingPricePeriodCommand.ts`（+ `__tests__`）
  - `src/server/subdomains/pricing/application/factories/endDateCustomerSellingPricePeriodCommandFactory.ts`
- 作業内容: 入力 `{ customerId, productId, periodId, endDate, referenceDate, expectedVersion }`。現在有効行を `endDatePeriod` で打ち切り update。独立コマンド（ADR-0018 / 86b 軸4）
- コミットメッセージ: `feat: 得意先別販売単価 適用終了コマンド（EndDate）`

### Step 6: 削除コマンド Delete（TDD・実DB）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/DeleteCustomerSellingPricePeriodCommand.ts`（+ `__tests__`）
  - `src/server/subdomains/pricing/application/factories/deleteCustomerSellingPricePeriodCommandFactory.ts`
- 作業内容: 未来開始行を `deletePeriod` で物理削除 update。現在有効・失効行の削除は BusinessRuleViolationError
- コミットメッセージ: `feat: 得意先別販売単価 削除コマンド（Delete）`

### Step 7: 単価改定コマンド Revise（TDD・実DB）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/commands/ReviseCustomerSellingPricePeriodCommand.ts`（+ `__tests__`）
  - `src/server/subdomains/pricing/application/factories/reviseCustomerSellingPricePeriodCommandFactory.ts`
- 作業内容: `currentValidPeriod` が無ければ拒否。`endDatePeriod`（終了日=改定日）→ `addPeriod`（改定日開始・無期限）の順で1ロード1セーブ。単一集約 version でアトミック（合成糖衣・CONTEXT.md「単価改定」）
- コミットメッセージ: `feat: 得意先別販売単価 単価改定コマンド（Revise）`
