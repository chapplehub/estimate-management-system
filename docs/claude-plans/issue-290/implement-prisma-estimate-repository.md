# Issue #290: 見積集約の永続化を担う PrismaEstimateRepository / EstimateMapper を実装する（着手順序 #5 後段） — 実装計画

## Context

着手順序 #5 前段の #287 で、ドメイン層に `EstimateRepository` interface（`save` / `delete` / `findById` / `findByEstimateNumber`）が定義済み。本イシューはその Prisma 実装（`PrismaEstimateRepository`）と、ドメイン集約 ⇔ Prisma レコードを相互変換する `EstimateMapper` を infrastructure 層に追加し、後続のアプリ層ユースケース（着手順序 #6）が見積集約を永続化できる状態にする。

対象集約は深いオブジェクトグラフ（`Estimate → EstimateVariation[] → EstimateItem[] → RevisedEstimateItemDetail?` ＋ 排他的サブタイプ `RepairEstimateDetail?` / `AfterRepairEstimateDetail?`）であり、単一集約ルート + 1 子の Customer 実装とはこの点が異なる。既存の `PrismaCustomerRepository` / `CustomerMapper` の規約・構造に揃えつつ、子エンティティを持つ集約特有の課題（集約境界の eslint 規約への到達経路、更新時の子の差分反映）を解決する。

## 設計判断

### 子エンティティ `reconstruct()` への到達経路（#287 先送り課題）
- A. `entities/internal.ts` バレル新設 + mappers ディレクトリに scoped override
- B. **`EstimateMapper.ts` 単一ファイルのみ eslint `no-restricted-imports` を off にし、子を直接 import**
- C. 集約ルート Estimate に再構築ファクトリを追加（子は完全非公開）
- **採用: B**（ユーザー決定）。理由: 永続化からの再構築は infrastructure の正当な責務であり Mapper が集約内部を知るのは妥当。コード最小・凝集度高。例外は単一ファイルに限定し、コメントで「再構築の正当例外」と根拠を明記して境界の穴の増殖を防ぐ。

### save() 更新時の子エンティティ差分反映
- A. **差分 upsert（identity 保持）**: 残存=upsert / 削除分=`deleteMany(notIn)` / 新規=create
- B. 全削除→再作成（snapshot replace）
- **採用: A**（ユーザー決定）。理由: `EstimateVariation` は `Order` / `EstimateVariationCopy` / `EstimateVariationRevision` から FK 参照されるため、B では着手順序 #7 以降にそれらを cascade 破壊するリスク。A は子の行 identity と `createdAt` を保持し FK を壊さない。

### create パスと update パスのトランザクション方針
- **create**: `prisma.estimate.create({ data, include })` の単一ネスト create（任意の深さで原子的、明示 `$transaction` 不要）
- **update**: `prisma.$transaction` 必須。Prisma のネスト `upsert`/`deleteMany` は 1 リレーション階層までのため、3 階層グラフの差分は `$transaction` 内で命令的にオーケストレーションする。

### variationNumber ユニーク制約の並べ替え衝突（重要）
- `@@unique([estimateId, variationNumber])`（schema.prisma:602）は PostgreSQL の **即時**（非 deferrable）制約。更新時に番号を入れ替える（A:1↔B:2）と upsert 途中で衝突しトランザクションが abort する。ループ順では回避不可。
- **対応**: update の `$transaction` 内で 2 フェーズ採番。① `tx.estimateVariation.updateMany({ where: { estimateId }, data: { variationNumber: { increment: 1000 } } })` で既存全行を 1–99 帯の外へ退避（並べ替えが無ければ実質コストゼロ）。② 各 variation を最終番号で upsert。ドメインが番号重複を排除済み（`assertNoVariationNumberDuplication`）のため最終番号は衝突しない。
- `EstimateItem.sortOrder` は **非ユニーク**インデックスのため 2 フェーズ不要。

## ステップ

### Step 1: EstimateMapper 実装 + eslint 例外追加
- 対象ファイル:
  - `eslint.config.mjs`（末尾に override ブロック追加）
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（新規）
- 作業内容:
  - eslint に `files: ["src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts"]` → `"no-restricted-imports": "off"` の override を追加。既存の `entities/**` 例外（148–152行付近）と同スタイル。コメントで「集約再構築の正当例外」と明記。
  - `EstimateMapper` を `CustomerMapper` の規約に倣って実装:
    - **VO ⇔ primitive 変換規則**:
      - Money: 読み `Money.fromMajorUnits(Number(decimal))` / 書き `new Prisma.Decimal(money.majorUnits)`（DB は Decimal(12,2) 主単位）
      - TaxRate: `new TaxRate(Number(d))` / `new Prisma.Decimal(taxRate.value)`（Decimal(4,3)）
      - DiscountRate: `new DiscountRate(Number(d))` / `new Prisma.Decimal(d.value)`（Decimal(5,4)）
      - Quantity: `new Quantity(n)` / `q.value`（Int）
      - EstimateNumber: `EstimateNumber.parse(row.estimateNumber)`（estimateType/fiscalYear/sequence は派生のため read では不要、create では明示書き込み）
      - enum VO: `EstimateType.from(v)` / `SubmissionType.from(v)` / `VariationStatus.from(v)` / `TaxRoundingType.from(v)`、書きは `.value`
      - ID VO: `new EstimateId(row.id)` 等 / `.value`
    - `toDomain(row: PrismaEstimateFull): Estimate` — full include 行から各子の `reconstruct()` を呼んで集約を再構築。`RevisedEstimateItemDetail.reconstruct(id, deliveryPrice, createdAt, updatedAt)` は**位置引数**である点に注意（他は単一オブジェクト引数）。
    - 列マッピングの単一情報源となる scalar builder 群: `toEstimateScalarData` / `toVariationScalarData` / `toItemScalarData` / `toRevisedDetailScalarData` / `toRepairDetailScalarData` / `toAfterRepairDetailScalarData`（id・リレーションキーは含めず caller が付与）。
    - create パス合成: `toEstimateCreateInput(e): Prisma.EstimateCreateInput`（scalar builder を再利用し variations→items→revisedDetail と repair/afterRepair を nested `create`）。
    - update パス補助: `toVariationUpsertArgs(estimateId, v)` / `toItemUpsertArgs(variationId, i)` 等（`where: { id }`, `create: { id, <relationKey>, ...scalar }`, `update: { ...scalar }`）。同じ scalar builder を使い Money/enum 変換ロジックを重複させない。
  - 参考: `src/server/subdomains/customer/infrastructure/mappers/CustomerMapper.ts`
- コミットメッセージ: `feat: EstimateMapper（見積集約 ⇔ Prisma レコード相互変換）を実装する (#290)`
  - ボディに「子エンティティ reconstruct へは EstimateMapper 単一ファイル限定の eslint 例外で到達。理由: 永続化再構築は infrastructure の正当責務、例外を 1 ファイルに閉じ込め集約境界の穴の増殖を防ぐため」を記載。

### Step 2: PrismaEstimateRepository — 読み取り・削除・save(create パス)
- 対象ファイル: `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`（新規）
- 作業内容:
  - `import prisma from "@server/prisma"`（DI 無し、Customer と同じ singleton）。
  - 決定的ラウンドトリップのための共有 include 定数:
    ```ts
    const INCLUDE_FULL = {
      variations: {
        orderBy: { variationNumber: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" }, include: { revisedDetail: true } } },
      },
      repairDetail: true,
      afterRepairDetail: true,
    } as const;
    ```
  - `findById(id)`: `findUnique({ where: { id: id.value }, include: INCLUDE_FULL })` → `EstimateMapper.toDomain` or null。
  - `findByEstimateNumber(en)`: `findUnique({ where: { estimateNumber: en.value }, include: INCLUDE_FULL })` → 同上。
  - `delete(id)`: 存在確認後 `prisma.estimate.delete({ where: { id } })`（schema の `onDelete: Cascade` で variations→items→revisedDetail と repair/afterRepair が連鎖削除。Customer と違い親 Company 削除は不要）。存在しなければ no-op。
  - `save(estimate)`: 存在確認で分岐。**create パスのみ実装** = `prisma.estimate.create({ data: EstimateMapper.toEstimateCreateInput(estimate), include: INCLUDE_FULL })` → `toDomain` で返す。update パスは Step 3 まで暫定的に明示エラー（`throw new Error("update path not yet implemented")`）。
  - 参考: `src/server/subdomains/customer/infrastructure/prisma/PrismaCustomerRepository.ts`
- コミットメッセージ: `feat: PrismaEstimateRepository の findById/findByEstimateNumber/delete/save(新規作成) を実装する (#290)`

### Step 3: PrismaEstimateRepository — save(更新パス・差分 upsert)
- 対象ファイル: `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`
- 作業内容:
  - `save()` の既存分岐に update パスを実装。`prisma.$transaction(async (tx) => { ... })` 内で:
    1. `tx.estimate.update` でルートの scalar フィールド更新。
    2. variations 差分: `tx.estimateVariation.deleteMany({ where: { estimateId, id: { notIn: keepVariationIds } } })`。
    3. **2 フェーズ採番**: `tx.estimateVariation.updateMany({ where: { estimateId }, data: { variationNumber: { increment: 1000 } } })` → 各 variation を `EstimateMapper.toVariationUpsertArgs` で最終番号にて upsert。
    4. 各 variation の items 差分: `deleteMany({ where: { variationId, id: { notIn: keepItemIds } } })` → 各 item を upsert（`sortOrder` は非ユニークのため退避不要）。
    5. 各 item の revisedDetail 同期: 有れば upsert、無ければ `deleteMany({ where: { estimateItemId } })`（idempotent。`delete` は P2025 で throw するため `deleteMany` を使う）。
    6. repair/afterRepair 同期: estimateType に応じ片方を `estimateId` 起点で upsert、他方を `deleteMany({ where: { estimateId } })`。ドメインの `assertSubtypeIntegrity` で排他性は保証済み。
    7. 同一 tx 内で `INCLUDE_FULL` 再取得 → `toDomain` で返す。
  - エラー方針: 参照中の variation を削除しようとした際の Prisma `P2003`（FK 違反）は、生の Prisma 例外を漏らさずドメイン的に意味のあるエラーへ変換（メッセージで「他テーブルから参照されている variation は削除不可」を明示）。
  - 注意: `@updatedAt` は DB 管理。返却集約は再取得値を反映するため呼び出し側の `updatedAt` 前提は持たない。
- コミットメッセージ: `feat: PrismaEstimateRepository の save(更新) を identity 保持の差分 upsert で実装する (#290)`
  - ボディに「全削除→再作成ではなく差分 upsert。理由: EstimateVariation を参照する Order/Copy/Revision を cascade 破壊しないため」「variationNumber ユニーク制約衝突回避に updateMany increment の 2 フェーズ採番を採用」を記載。

### Step 4: 網羅テスト + フィクスチャヘルパー
- 対象ファイル:
  - `src/server/__tests__/helpers/ensureTestEmployee.ts` ほか必要なヘルパー（新規。`ensureTestDepartment.ts` のスタイルに倣う）
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`（新規）
- 作業内容:
  - フィクスチャ前提（すべて Estimate の FK 先で、見積 create で連鎖作成されない共有マスタ）: Department（`ensureTestDepartment` 再利用）/ Employee（creator）/ Customer + Company / DeliveryLocation / Product（item 用 + repair targetProductId 用）。冪等 upsert ヘルパーとして用意。
  - 予約テスト見積番号（例: `N9900001` / `R9900001` / `A9900001`）を使い、`beforeEach`/`afterEach` で `prisma.estimate.deleteMany({ where: { estimateNumber: { in: [...] } } })`（サブツリーは cascade）。共有マスタは Employee テスト同様に残す。
  - テストケース（網羅）:
    - save(新規) → findById ラウンドトリップ（NEW: variations / items / revisedDetail を含め、5 集計金額・3 明細金額・VO が等価に再構築されること。Money 等価, EstimateNumber 等価。`updatedAt` は DB 権威として構造・金額の等価を検証）。
    - REPAIR サブタイプ: repairDetail 付き save→findById 等価。
    - AFTER_REPAIR サブタイプ: afterRepairDetail（`afterServiceWarningAcknowledged` 含む）付き save→findById 等価。
    - save(更新): item 追加/削除/値変更、variation の番号入れ替え（2 フェーズ採番の検証）、overallDiscount 変更が反映され、削除分が消えること。子の `id` が保持されること。
    - findByEstimateNumber: 一致取得・不一致 null。
    - delete: 実行後に `estimateVariation` / `estimateItem` / `revisedEstimateItemDetail` / repair・afterRepair が空になり cascade を確認。
  - `pnpm lint` / `pnpm test`（必要に応じ `pnpm e2e:setup` 相当のテスト DB 準備）が通ることを確認。
  - 参考: `src/server/subdomains/employee/infrastructure/prisma/__tests__/PrismaEmployeeRepository.test.ts`
- コミットメッセージ: `test: PrismaEstimateRepository の網羅テスト（4メソッド・サブタイプ・cascade）とフィクスチャを追加する (#290)`

> 実装中に本計画と異なる対応をした場合は、完了時に `docs/claude-plans/issue-290/deviations.md` に {元の計画}・{実際の実装}・{理由} を記録する（CLAUDE.md ルール）。

## 検証

- `pnpm lint` — eslint 例外が `EstimateMapper.ts` 単一ファイルに限定され、他から子エンティティ直接 import が無いこと（境界規約遵守）。
- `pnpm test` — 上記網羅テストが全通。特に save→findById ラウンドトリップ（受け入れ条件）と cascade delete を確認。
- DDD レイヤリング: Mapper / Repository が infrastructure 層に配置され、ドメイン層へ Prisma 型が漏れていないこと（ドメイン層の import に `@generated/prisma` が無い）。
- インターフェース完全実装: `PrismaEstimateRepository implements EstimateRepository` が型エラー無くコンパイルされること（`pnpm build` もしくは tsc）。

## 受け入れ条件との対応
- [x] interface 完全実装 → Step 2/3
- [x] save→findById ラウンドトリップで子含め等価再構築 → Step 4
- [x] DDD レイヤリング遵守（infrastructure 配置・Prisma 非漏出）→ Step 1–3 + 検証
- [x] 集約境界遵守（子直接 import 禁止、決定した経路のみ）→ Step 1（単一ファイル例外）
- [x] `pnpm lint` / `pnpm test` 通過 → Step 4 + 検証
