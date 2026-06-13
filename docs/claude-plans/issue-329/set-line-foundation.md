# Issue #329: 見積詳細画面 S1 セット明細 基盤（ADR-0047 / Shape ③-a） — 実装計画

> 本計画は `/grill-with-docs` セッションで設計ツリー全10分岐を解決した合意内容の結晶化。
> 永続化形状は ADR-0047（改訂済み）、用語は CONTEXT.md で確定済み。

## 概要

見積のセット明細を表現する永続化・ドメイン基盤を追加する（ADR-0047 / Shape ③-a）。

- `estimate_set_groups`（セット群＝価格・並び順・金額を持たない薄い衛星）と `estimate_set_components`（所属交差表・`item_id` を PK ＝排他所属を DB 担保）を新設。
- `estimate_items`（価格付き末端行＝通常明細＋構成明細）は**列・DDL とも不変**。
- セット群の金額・位置は構成明細から**導出**（永続化する派生列ゼロ）。
- S1 は基盤（entities＋create/reconstruct＋導出＋構築時不変条件＋Mapper＋diff-upsert＋テスト）に閉じ、**mutator・C4 セット書き込み・自動展開・D&D・空群カスケード・区分駆動チェックは S5**。

## 設計判断

### セット群のドメイン表現（Q1）
- A. `EstimateSetGroup` を子エンティティ化し、所属は群が持つ関係。`EstimateItem` は完全不変
- B. `EstimateItem` に `setGroupId` バッジを持たせる
- **採用: A**。理由: 学びノート「バッジ＝関係であって属性ではない」／構成明細と通常明細を構造的に同一に保つ／交差表（関係）への素直な対応／`estimate_items` 不変

### 所属の保持形（Q2）
- α. 群は順序付き `EstimateItemId[]` のみ保持、実体は `_items` が単一所有
- β. 群が `EstimateItem` 参照を保持（エイリアス）
- **採用: α**。理由: 単一所有で整合が単純／交差表に 1:1 で写る／`revisedFrom` の id 参照と同流儀。メンバー id の正準順序＝構成明細 sortOrder 順

### S1/S5 スコープ境界（Q3）
- **採用**: S1 は構築＋再構築＋導出＋構築時不変条件まで。mutator・`replaceContent` 拡張・空群カスケードは S5。`reconstruct`/`create` はセット群対応・`replaceContent` 据え置きの非対称を許容
- 理由: issue 分割表に忠実／AC は構築時不変条件＋reconstruct 2状態の往復テストで満たせる／S5 コマンド形状に API を先取りされない（YAGNI）

### 不変条件の配置（Q4）
- **S1 ドメイン（集約内・構築時 assert）**: 空群禁止・参照整合・排他所属
- **S5 アプリ**: ネスト禁止／構成商品区分（`ProductCategory` は集約越え → ADR-0029 例外 → `estimate/domain/services/` の**ルール検証型 Domain Service ＋ドメインポート**）。必要性は S5 手動合成 UX 次第
- 連続配置 → S5。単価0/数量1 → ③-a では vacuous（実装しない）
- `create` で assert・`reconstruct` は信頼（金額計算と同じ非対称）
- 理由: ADR-0029（集約越え制約は集約で判定不能）＋ ADR-0011（複数失敗理由＝ルール検証型）。`Estimate` を `Product` に依存させない（ADR-0027）

### 金額・位置の導出（Q5）
- A. `SetGroupDerivationPolicy`（純粋関数）に集約、`EstimateVariation` が解決して呼ぶ
- B. `EstimateVariation` 直書き
- **採用: A**。理由: `LineItemAmountPolicy`/`EstimateAmountPolicy` と同じ ADR-0023 の Policy／単一情報源・単体テスト容易
- **`computeTotals` 無変更**（群は `_items` に居らず二重計上なし）・**導出値は非永続/読み取り専用**（ADR-0033 と両立）

### スキーマ列（Q6）
- `estimate_set_groups`: `id`/`variationId` FK(Cascade)/`productId` FK/`itemName` VarChar(100)/`unit` VarChar(20)/`customerMemo`＋`internalMemo` VarChar(2000) default ""/timestamps。**sortOrder・価格・金額列なし**
- `estimate_set_components`: `itemId @id`（PK＝排他所属を DB 担保）/`setGroupId` FK。**両 FK Cascade・surrogate id なし・timestamps なし**
- 既存3モデルは**仮想リレーションのみ**追加（FK 列なし）→ `estimate_items` の DDL 不変

### Mapper（Q7）
- include に `setGroups: { orderBy: id, include: { components: true } }`
- 再構築: 所属マップ → 全 item フラット復元 → 群ごとにメンバーを sortOrder 順 filter。`reconstruct` は信頼
- create-input: `setGroups` はネスト、**交差行はネストせず別 `createMany`**（兄弟 FK 順序事故回避・`insertWithCopies` と同型）

### diff-upsert（Q8）
- 順序: **明細（削除→upsert）→ セット群（identity 保持 upsert）→ 交差表（全削除→createMany）**
- 交差表は identity を持たない（surrogate id/timestamps なし・被参照なし）→ 全削除→再作成。群は被参照のため identity 保持
- **`insert` もトランザクション化**。`delete()` は Cascade で無変更

### 命名（Q9）
- **テーブル/モデルを `estimate_set_items` → `estimate_set_groups` にリネーム**（3層統一・グロッサリ整合・ADR-0047 改訂済み）
- `EstimateSetGroup` / `EstimateSetGroupId`（VO は id 1つ）／`EstimateSetComponent`（`SetProductComponent` と対）／`SetGroupDerivationPolicy`。交差表に surrogate VO なし

### テスト（Q10）
- **`ensureEstimateFixtures` に SET 区分商品を追加**（前提作業）＋builder 拡張（`makeSetGroup`/`makeVariationWithSetGroups`／reconstruct variant）
- ドメイン: 空群禁止・参照整合・排他所属・computeTotals 無変更・導出
- リポジトリ: 往復＋diff-upsert 5 シナリオ（構成追加/削除/群間移動/群削除/新群追加）。更新テストは **reconstruct で id 固定の2状態**
- 隔離: 年度バンド（2098/2099）＋cleanup・商品名/id はユニーク（commit 4211a35 の flaky 教訓）

## ステップ

### Step 1: セット群ドメインモデル
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/EstimateSetGroupId.ts`（新規・UUIDv7）
  - `src/server/subdomains/estimate/domain/entities/EstimateSetGroup.ts`（新規）
  - `src/server/subdomains/estimate/domain/policies/SetGroupDerivationPolicy.ts`（新規）
  - `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`（`create`/`reconstruct` に `setGroups`・構築時 assert・`setGroups` getter）
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`（`reconstruct` 経由で setGroups を運ぶ）
  - 各 `__tests__`（ドメインテスト・DB 不要）
- 作業内容:
  - `EstimateSetGroup`（snapshot＋`EstimateItemId[]`＋`create` で空群禁止）
  - `EstimateVariation.create` で参照整合・排他所属・空群禁止を assert、`reconstruct` は信頼
  - `SetGroupDerivationPolicy`（金額＝Σ`finalAmount`／位置＝min`sortOrder`）、`computeTotals` 無変更
- コミットメッセージ: `feat: セット群ドメインモデル（EstimateSetGroup・導出・構築時不変条件）を追加`
  - body: 所属は群が持つ EstimateItemId[]（案2-α）／区分駆動チェックは集約越えのため S5 Domain Service へ（ADR-0029）

### Step 2: 永続化スキーマ
- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - `EstimateSetGroup`（`estimate_set_groups`）・`EstimateSetComponent`（`estimate_set_components`・`itemId @id`）を追加
  - `EstimateVariation`/`EstimateItem`/`Product` に仮想リレーションのみ追加（`estimate_items` DDL 不変）
  - `pnpm db:generate` → マイグレーション適用（`! pnpm db:migrate` 委譲・dev DB 共有に注意）
- コミットメッセージ: `feat: セット明細の永続化スキーマ（estimate_set_groups＋所属交差表）を追加`
  - body: 薄い衛星＋交差表（NULL ゼロ）／item_id を交差表 PK ＝排他所属を DB 担保／estimate_items 不変

### Step 3: Mapper・diff-upsert・リポジトリ/フィクスチャ拡張
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts`
  - `src/server/subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository.ts`
  - `src/server/__tests__/helpers/ensureEstimateFixtures.ts`（SET 商品追加）
  - `src/server/subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder.ts`（builder 拡張）
  - リポジトリ `__tests__`
- 作業内容:
  - include 拡張・再構築（所属マップ→群を sortOrder 順メンバーで復元）・scalar builder・create-input（交差行は別 createMany）
  - `insert` トランザクション化・`update` の diff-upsert（明細→群→交差の順・交差は全削除→再作成）
  - リポジトリテスト（往復＋diff-upsert 5 シナリオ・reconstruct 2状態）
- コミットメッセージ: `feat: EstimateMapper/PrismaEstimateRepository をセット群対応に拡張`
  - body: 交差行は兄弟 FK 順序事故回避のため別 createMany（insertWithCopies と同型）／交差表は identity なしのため全削除→再作成、群は被参照のため identity 保持 upsert

## 補足

- **ADR-0047 改訂済み**（リネーム＋`item_id` PK＋区分駆動を S5 Domain Service とする補足）。
- **CONTEXT.md 変更不要**（用語は既に正確）。
- 計画と異なる対応をした場合は `docs/claude-plans/issue-329/deviations.md` に記録（CLAUDE.md 規約）。
