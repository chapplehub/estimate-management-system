# Issue #307: 楽観ロックを delivery-location サブドメインへ適用する（ADR-0039 横断展開） — 実装計画

## 概要

ADR-0039 の横断ポリシーに基づき、delivery-location サブドメインの「既存集約を変更するコマンド」（`Update` / `Activate` / `Deactivate`）へ楽観ロックを適用する。`delivery_location` テーブルへの `version Int @default(1)` 列は #301 の一括マイグレーションで追加済み（不活性）。本イシューはコード側の段階展開。

本質的には **customer #316 適用前 → 適用後の機械的移植**。delivery-location は customer と構造的に完全な双子（ADR-0043 で平坦化済み）であり、新規の設計判断は発生しない。リファレンスは customer サブドメイン一式。

スコープ:

- 対象: `UpdateDeliveryLocationCommand` / `ActivateDeliveryLocationCommand` / `DeactivateDeliveryLocationCommand`
- 除外: `DeleteDeliveryLocationCommand`（Delete 系横断イシュー送り。`delete()` のシグネチャは本イシューで不変）

## 設計判断

### 状態変更（Activate/Deactivate）の version 往復経路
- A. 詳細ページの `StatusForms` のみで version を hidden input 往復させる
- B. 一覧にも有効化/無効化ボタンを新設し、一覧からも version を往復させる
- **推奨・採用: A**。理由: customer のリファレンス実装は状態変更ボタンを詳細ページのみに置き、一覧（`columns.tsx`）は状態バッジ表示のみ。イシュー本文の「一覧・詳細のボタン経由」の「一覧」は ADR-0039 の一般則の引用であり、本サブドメインに一覧ボタンを新設する意図ではないとユーザー確認済み。customer に完全準拠し、スコープ外の UI 追加をしない。

### 楽観ロックトークンの実体・通り道・シグネチャ
- ADR-0039 で決定済み（`version Int` 列 / フォーム往復で引数渡し / `insert`・`update(agg, expectedVersion)` 分割）のため、本イシューでの判断は不要。customer 実装パターンをそのまま踏襲する。

### CONTEXT.md / ADR
- **CONTEXT.md 更新なし**。`version`/楽観ロックは並行制御メタデータで用語集の対象外（ADR-0039 が「業務概念ではない」と明言）。`納品先`の定義も揺るがない。
- **新規 ADR なし**。ADR-0039 が織り込み済みの段階展開で、新しい不可逆トレードオフが発生しない。

### 実装上の注意点
- Mapper の `toPrismaUpdate` は `version` を含めない。version は条件付き `updateMany` 側で `{ increment: 1 }` として一元管理し、エンティティ→Prisma マッピングは version に触れない（customer と同じ責務分離）。
- `update()` は条件付き `updateMany`（`WHERE id AND version` + `version: { increment: 1 }`）→ `count === 0` で `ConflictError`（ADR-0039 細目5の文言）→ version を進めた行を `findUnique` で再read して返す。
- `expectedVersion` を渡さない更新経路がコンパイルエラーになることを確認（`save` 廃止の効果）。

## ステップ

### Step 1: ドメイン層リポジトリインターフェースの分割
- 対象ファイル: `src/server/subdomains/delivery-location/domain/repositories/DeliveryLocationRepository.ts`
- 作業内容:
  - `save()` を廃止し `insert(deliveryLocation)` / `update(deliveryLocation, expectedVersion: number)` に分割
  - customer の `CustomerRepository` と同じ JSDoc（楽観ロック / ADR-0039 の説明）を付す
- コミットメッセージ: `feat: 納品先リポジトリIFをinsert/updateに分割し楽観ロックを導入する（ADR-0039）`

### Step 2: Prisma リポジトリ実装の条件付き UPDATE 化
- 対象ファイル: `src/server/subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository.ts`
- 作業内容:
  - `save()`（findUnique プローブ + create/update 分岐）を `insert()`（`create`）/ `update()`（条件付き `updateMany` + `ConflictError` + 再read）に置き換え
  - Mapper の `toPrismaUpdate` が version を含まないことを確認（必要なら除外）
- コミットメッセージ: `feat: 納品先Prismaリポジトリを条件付きupdateManyで楽観ロック化する（ADR-0039）`

### Step 3: 対象コマンドへの expectedVersion 素通し
- 対象ファイル:
  - `src/server/subdomains/delivery-location/application/commands/UpdateDeliveryLocationCommand.ts`
  - `.../ActivateDeliveryLocationCommand.ts`
  - `.../DeactivateDeliveryLocationCommand.ts`
- 作業内容:
  - 各 Input に `expectedVersion: number` を追加（JSDoc は customer 準拠）
  - `save()` 呼び出しを `update(entity, input.expectedVersion)` に置き換え
- コミットメッセージ: `feat: 納品先の更新系コマンドにexpectedVersionを通す（ADR-0039）`

### Step 4: クエリ側 DTO への version 追加
- 対象ファイル: `src/server/subdomains/delivery-location/application/queries/dto/DeliveryLocationDTO.ts`（および QueryService / Mapper で version を載せる箇所）
- 作業内容:
  - `version: number` を DTO に追加し、クエリ取得結果に version を含める（CustomerDTO 準拠）
- コミットメッセージ: `feat: 納品先DTOにversionを追加しフォーム往復に供給する（ADR-0039）`

### Step 5: プレゼンテーション層（フォーム / schema / actions）の version 往復
- 対象ファイル:
  - `src/app/(features)/delivery-locations/[code]/schema.ts`（`version: z.coerce.number().int()` を extend）
  - `.../[code]/DeliveryLocationUpdateForm.tsx`（hidden `version` input）
  - `.../[code]/DeliveryLocationStatusForms.tsx`（`version` prop + hidden input 追加）
  - `.../[code]/page.tsx`（StatusForms へ `version` を渡す）
  - `.../[code]/actions.ts`（update はフォーム由来 version を素通し、activate/deactivate は `Number(formData.get("version"))` を expectedVersion へ）
- 作業内容:
  - customer の同名ファイル群と同じパターンを適用。一覧（`columns.tsx`）にはボタンを**新設しない**
- コミットメッセージ: `feat: 納品先の編集・状態変更フォームでversionを往復させる（ADR-0039）`

### Step 6: テスト
- 対象ファイル:
  - `src/server/subdomains/delivery-location/infrastructure/prisma/__tests__/PrismaDeliveryLocationRepository.test.ts`（リポジトリ統合）
  - `src/server/subdomains/delivery-location/application/commands/__tests__/`（コマンド単体）
- 作業内容:
  - リポジトリ統合: stale トークンを**逐次**再現（insert → update(v1) 成功 → 再度 update(v1) が `ConflictError`、先行変更が残存）
  - コマンド単体: `expectedVersion` がリポジトリ `update` へ素通しされることを検証
- コミットメッセージ: `test: 納品先の楽観ロック（lost update防止・expectedVersion素通し）を検証する`

## 受け入れ条件（イシュー由来）

- [ ] 対象コマンド全てで version 不一致時に `ConflictError` が発生し、後勝ちによる静かな変更喪失が起きない
- [ ] `save` が廃止され、更新経路で expectedVersion を渡さないコードがコンパイルエラーになる
- [ ] 編集ウィンドウ（画面表示時点の version）がフォーム往復で保護される
- [ ] lost update 防止を示すテストが存在する
