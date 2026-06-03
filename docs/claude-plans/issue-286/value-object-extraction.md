# Issue #286: refactor(estimate): EstimateItem の itemName / unit / memo をプリミティブから値オブジェクト化する — 実装計画

## Context

Issue #284 で Estimate 集約を実装した際、`EstimateItem` の `itemName` / `unit` / `customerMemo` / `internalMemo` を VO 化せず `string` のまま受けた（判断理由: `docs/claude-plans/issue-284/deviations.md §5`）。現状はエンティティ内に `private static assertItemName / assertUnit / assertMemo` を置いて検証している。

このリファクタは上記プリミティブ受けを `ItemName` / `Unit` / `Memo` の3つの値オブジェクトに置き換え、検証責務を VO のコンストラクタに移譲する。これにより `EstimateItem` から検証ヘルパが消え、ドメインモデルの型安全性と意図表現が向上する。`Memo` は `EstimateItem` だけでなく `EstimateVariation` の `customerMemo` / `internalMemo`（同一制約: `VarChar(2000)`）にも横断適用する。

完了条件（抜粋）: VO 3 種＋単体テスト追加 / `EstimateItem` の対象 string 型が全消去 / `assert*` 削除 / Prisma マッピング対応 / `pnpm test` `pnpm build` 通過。

## 設計判断（ユーザー確認済み）

### 論点1: マスタ側 VO の共有判断（ItemName / Unit）
- A. 全て estimate 独自で新設 ← **採用**
- B. Product の `ProductName` / `ProductUnit` を再利用
- 採用理由: スナップショットは見積時点の**凍結値**であり、Product 側の制約（特に `ProductUnit` は enum 6 値）に結合させると、将来 enum 値が変わった際に過去スナップショットの `reconstruct` が壊れる。estimate コンテキストの独立性を保つため独自 VO とする。`ProductId` のような cross-context 参照（identity）とは異なり、snapshot 属性は estimate 側に閉じた copy として持つ。

### 論点2: `Memo` の null 許容モデル
- 既存流儀（`ProductNote | null`、`Product.ts:32`）に合わせ `Memo | null` とする。VO 内部で null を表現しない。→ 判断不要（規約踏襲）

### 論点3: VO に `withFoo` 遷移メソッドを持たせるか
- 既存 VO（Product 系）に `withFoo` は無く、`change*` は全置換。Memo も全置換のため不要。→ 判断不要（規約踏襲）

### 論点4: `Memo` のエラーメッセージ label
- A. 共有 `Memo` VO ＋ 汎用 label（`LABEL = "メモ"`）← **採用**
- B. `CustomerMemo` / `InternalMemo` を別 VO に分離
- 採用理由: Memo は最大長のみの技術的制約であり、`顧客/社内` の区別を失っても実害が小さい。エラーは「メモは2000文字以内で入力してください」。最もシンプル。

### 関連スコープ: EstimateVariation の memo
- **同 PR で全置換**（採用）。`EstimateVariation` の `customerMemo` / `internalMemo` も `VarChar(2000)`・同一バリデーションのため同じ `Memo` VO に置換する。

### 補足: バレル整理
- `estimate/domain/values/` および `product/domain/values/` に `index.ts` バレルは存在しない（直接 import 流儀）。Issue チェックリストの「バレル整理」は N/A。新 VO も直接 import で参照する。

## 実装方針メモ

- 基底クラス `StringValueObject<U>`（`src/server/shared/StringValueObject.ts`）を継承。`LABEL` / `MIN_LENGTH` / `MAX_LENGTH` の override でエラーメッセージは自動生成される。
- 既存の手本: `FaultDescription`（必須・トリム・max 制約のミニマル VO, `estimate/domain/values/FaultDescription.ts`）、`ProductName`（max100/必須）、`ProductNote`（max・任意）。
- VO 仕様:
  - `ItemName`: `LABEL="商品名"`, `MIN_LENGTH=1`, `MAX_LENGTH=100`, コンストラクタで `trim()`。
  - `Unit`: `LABEL="単位"`, `MIN_LENGTH=1`, `MAX_LENGTH=20`, `trim()`。（enum ではなくスナップショット文字列なので自由文字列）
  - `Memo`: `LABEL="メモ"`, `MAX_LENGTH=2000`（MIN 無し）, `trim()`。null は `Memo | null` で表現。
- ブラスト半径（調査済み）:
  - ドメイン: `EstimateItem.ts` / `EstimateVariation.ts`
  - インフラ: `EstimateMapper.ts`（`itemToDomain` / `variationToDomain` / `toItemScalarData` / `toVariationScalarData`）
  - テスト: `estimateAggregateBuilder.ts`（中心フィクスチャ）, `EstimateItem.test.ts`, `EstimateVariation.test.ts`, `Estimate.test.ts`, `PrismaEstimateRepository.test.ts`
- マッピング変換規約:
  - 読み（toDomain）: `itemName: new ItemName(i.itemName)` / `unit: new Unit(i.unit)` / `customerMemo: i.customerMemo ? new Memo(i.customerMemo) : null`
  - 書き（scalarData）: `itemName: i.itemName.value` / `unit: i.unit.value` / `customerMemo: i.customerMemo?.value ?? null`

## ステップ

### Step 1: ItemName / Unit / Memo VO ＋ 単体テストを追加
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/ItemName.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/Unit.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/Memo.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/ItemName.test.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/Unit.test.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/__tests__/Memo.test.ts`（新規）
- 作業内容:
  - `StringValueObject` 継承で 3 VO を実装（上記「VO 仕様」通り）
  - 各テストは `FaultDescription.test.ts` の粒度に合わせ、正常系（通常値・トリム・境界 max 文字）/ 異常系（空文字・空白のみ・max+1 文字）を網羅。`Memo` は max のみ（空文字許容、null は呼び出し側責務なので VO テストでは扱わない）
- コミットメッセージ: `feat(estimate): ItemName / Unit / Memo 値オブジェクトを追加する`

### Step 2: EstimateItem を VO ベースに差し替え
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateItem.ts`
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（item 側: `itemToDomain` / `toItemScalarData`）
  - `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateItem.test.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/Estimate.test.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`（item 構築箇所）
- 作業内容:
  - `EstimateItemCreateInput` / コンストラクタ / `reconstruct` / `changeItemName` / `changeUnit` / `changeCustomerMemo` / `changeInternalMemo` / ゲッターのシグネチャを `string` → `ItemName` / `Unit` / `Memo`（memo は `Memo | null`）に差し替え
  - `private static assertItemName / assertUnit / assertMemo` と定数 `ITEM_NAME_MAX` / `UNIT_MAX` / `MEMO_MAX`、`ValidationError` import を削除（検証は VO に移譲）
  - `EstimateMapper` の item 側で `string <-> VO` 変換を追加
  - テストフィクスチャ・テストの呼び出し側を VO 生成（`new ItemName(...)` 等）に更新
- コミットメッセージ: `refactor(estimate): EstimateItem の itemName / unit / memo を値オブジェクト化する`
  - body に「検証責務を assert* から VO コンストラクタへ移譲。Unit は Product enum を再利用せず estimate 独自の自由文字列 VO とした（スナップショット凍結値のため）」を記載

### Step 3: EstimateVariation の memo を Memo VO に差し替え（関連スコープ）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`（variation 側: `variationToDomain` / `toVariationScalarData`）
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateVariation.test.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`（variation 構築箇所、Step 2 で未対応なら）
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`（variation 構築箇所）
- 作業内容:
  - `customerMemo` / `internalMemo` の create input / コンストラクタ / `reconstruct` / `change*` / ゲッターを `Memo | null` に差し替え
  - `private static assertMemo` と `MEMO_MAX` を削除
  - `EstimateMapper` の variation 側で `string <-> VO` 変換を追加
  - テスト呼び出し側を更新
- コミットメッセージ: `refactor(estimate): EstimateVariation の memo を Memo 値オブジェクトに統一する`

### Step 4: 検証 ＆ 逸脱記録
- 対象ファイル:
  - `docs/claude-plans/issue-286/deviations.md`（計画と差異が出た場合のみ）
- 作業内容:
  - `pnpm test` 通過確認
  - `pnpm build`（型チェック）通過確認
  - `pnpm lint` 確認
  - 計画から逸脱した点があれば deviations.md に {元の計画}/{実際}/{理由} を記録
- コミットメッセージ:（逸脱記録が発生した場合のみ）`docs(estimate): issue-286 の実装逸脱を記録する`

## 検証（Verification）

- 単体テスト: `pnpm test`（新 VO テスト 3 ファイル＋既存エンティティ/マッパーテストが全通過すること）
- 型チェック: `pnpm build`（`EstimateItem` / `EstimateVariation` の全シグネチャから対象 `string` 型が消え、型エラーが無いこと）
- Lint: `pnpm lint`
- 受け入れ確認:
  - `EstimateItem` に `assertItemName / assertUnit / assertMemo` が存在しない（grep で 0 件）
  - `EstimateMapper` ラウンドトリップ（`toDomain` → scalarData → 再 `toDomain`）が `PrismaEstimateRepository.test.ts` で破綻しない
