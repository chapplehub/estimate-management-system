# Issue #515: セット商品への単価・原価登録をファクトリガードで一律拒否する（4集約横断） — 実装計画

## Context

価格系の4集約（共通売単価 `CommonSellingPrice` / 原価 `CostPrice` / 得意先別販売単価 `CustomerSellingPrice` / 納品先別販売単価 `DeliveryLocationSellingPrice`）の write 系コマンドは `ProductCategory` を参照しておらず、セット商品（`ProductCategory.SET`）の `productId` を指定しても期間登録できてしまう（ガードなし）。#502（原価 BE write系）のグリル中に出た論点だが、原価単独ではなく4集約横断の方針決定になるため本 issue に先送りされていた。

### グリルで確定した業務ルール（ユーザー確認済み）

**セット商品は売単価・原価とも自前の値を持たず、常に構成商品から導出される。** 見積機構はセット商品を構成明細に自動展開し、各構成明細は構成商品自身のマスタ価格・原価を解決するため、セット商品 `productId` のマスタ価格・原価はどの機構からも参照されない（＝登録は常にデッドデータになる）。この理解は #514 が導入したグロッサリ（後述）と整合する。

### #514 グロッサリとの連携（別ブランチで先行編集）

#514 が CONTEXT.md に以下を導入済み。#515 はこの語彙に整合させる。

- **価格保守対象商品 (Priceable Product)**: 共通販売単価・原価を保守する対象。個別商品・消耗品が該当し、**セット商品は含まない**。原価一覧・共通販売単価一覧の母集合はこの区分に一致する（「全商品」ではない）。
- **未設定 (Unset)**: 期間行を1件も持たない派生状態。**母集合に含まないセット商品を「未設定」とは呼ばない**。
- **セット商品 (Set Product)**: それ自体は価格（単価・原価）を持たない（→価格保守対象商品ではない）。

### 調査で確定した事実

- **区分は不変**: `Product._category` は `private readonly`、`UpdateProductCommand` も「category は変更不可（B011）」。個別商品が後からセット商品になることはない。
- **ガードは生成入口のみで十分**: 区分不変ゆえセット商品は永久に価格集約を1つも持てない。`addPeriod`/`revise`/`editPeriod`/`endDate`/`delete` は既存集約のロードを前提とするため、セット商品では自然に「見つからない」で弾かれ到達不能。明示ガードが要るのは唯一の生成入口＝Register系コマンドの新規作成分岐（`existing === null → create`）だけ。ADR-0052 と同じ「ペイロード防御」の位置づけ。
- **read 側の母集合変更は #514 が担う**: 共通層2一覧の `FROM products p`（全商品）→ セット除外は #514 のスコープ。#515 は read 側コードを追加しない。
- **得意先別・納品先別は画面が未存在**: 価格保守UI・商品セレクタが無く、現時点でデッドエンドは発生しない。納品先別は write 系コマンド自体も未実装。
- **既存データは移行不要（監査済み）**: セット商品（`PRD005`/`PRD015–018`）と価格・原価対象（`PRD810/811/820–826`・`PRD840–847`）は重複ゼロ。得意先別・納品先別の価格 seed は存在しない。原価 backfill は既に `category === "SET"` を除外。

## 設計判断

### ガード対象範囲（Issue 未決事項）
- 案A: ガード不要（現状維持） / 案B: 4集約一律 / 案C: 集約ごと個別
- **採用: 案B（4集約一律）**（ユーザー確認済み）。業務ルールが集約横断で一様（売単価・原価とも構成品から導出）なため、案Cは根拠を欠く。上書き2層でセット商品を許すと「上書き対象の共通価格が存在しない上書き」という論理的に空虚なレコードを生む。
- 実装は write 系のある3集約（共通売単価・原価・得意先別）に施す。**納品先別は write 系未実装のため前方ポリシー**（後述）として記録。

### ガードの配置・実装方式（Issue 未決事項）
- 案①: ドメインのファクトリ `create(productId, category)` に不変条件として置く / 案②: アプリ層で `ValidationError` を投げる
- **採用: 案①（ファクトリガード）**（ユーザー確認済み）。「セット商品の価格集約は生成不能」を集約の構造的不変条件にでき、4集約で表現が統一され、将来コード・テストがうっかりセット商品の価格集約を作る事故も構造的に防げる。ADR-0052 の「ルール判定はドメインの純粋関数」に最も忠実。
- category は ADR-0030（集約越えの事実はアプリ層が集めメソッド引数で渡す）に従い、アプリ層が `ProductQueryService` でライブ取得して `create` に渡す。ドメインの純粋性を保つ。
- `ProductCategory` の pricing/domain への import は、既に全 pricing エンティティが `ProductId`（product/domain の VO）を import している越境と同性質（eslint 集約境界ルールが禁じるのは子エンティティの越境のみで VO は対象外）。

### category 取得のタイミング
- **`existing === null`（新規作成分岐）到達時のみ** `ProductQueryService.findById` を呼ぶ。区分不変性により既存集約は必ず非セットのため、更新経路では取得不要。無駄なクエリを増やさない。
- `findById` が `null`（商品不在）の場合は `ValidationError`（入力契約違反）で早期に弾く。

### インライン vs 共有ルール
- 3ファクトリの `if (category.isSet()) throw` は各1行の自明な重複。共有ヘルパ抽出は over-engineering のため**インライン**とする。

### read/UI 側の扱い（Issue 未決事項）
- **#515 では read 側コードを追加しない**（ユーザー確認済み）。共通層2一覧のセット除外は #514、得意先別・納品先別のセレクタは未存在。

### ADR 起票
- **不要**（ユーザー判断）。ファクトリガードは実装詳細であり、独立した ADR を要するアーキテクチャ判断ではない。既存の ADR-0030/0052（メソッド引数での文脈渡し・集約越え検証）の適用に閉じる。

## 前方ポリシー（将来 issue への申し送り）

1. **納品先別販売単価の write 系を実装する将来 issue**では、共通売単価・原価・得意先別と同型のファクトリガード（`DeliveryLocationSellingPrice.create` にセット商品拒否）を適用する。
2. **得意先別・納品先別の価格保守 UI・商品セレクタを実装する将来 issue**では、価格保守対象商品と同様にセット商品を選択肢から除外する（write ガードが最終担保だが、デッドエンド回避の UX 二重防御）。

## ステップ

### Step 1: 計画ファイルの保存
- 対象ファイル: `docs/claude-plans/issue-515/set-product-price-cost-guard.md`（新規）
- 作業内容:
  - 本計画を保存
- コミットメッセージ: `docs: #515 セット商品への単価・原価登録ガードの実装計画`

### Step 2: 原価（CostPrice）ガード一式
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CostPrice.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterCostPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/factories/registerCostPricePeriodCommandFactory.ts`
  - `src/server/subdomains/pricing/domain/entities/__tests__/CostPrice.test.ts`
  - `src/server/subdomains/pricing/application/commands/__tests__/RegisterCostPricePeriodCommand.test.ts`
- 作業内容:
  - `CostPrice.create(productId, category: ProductCategory)` に変更し、`category.isSet()` なら `ValidationError("セット商品には原価を登録できません")` を throw
  - `RegisterCostPricePeriodCommand` の constructor に `ProductQueryService` を追加。`existing === null` 分岐で `findById` により区分を取得（不在は `ValidationError`）→ `ProductCategory.from(dto.category)` を `create` へ渡す
  - factory で `new PrismaProductQueryService()` を注入
  - ドメインテスト: セット商品区分で `create` が throw / 非セットで成功
  - コマンドテスト: 既存テストの constructor に非セットを返す `ProductQueryService` スタブを追加。セット商品 `productId` の登録が throw するケースを追加
- コミットメッセージ: `feat: #515 原価の期間登録でセット商品をファクトリガードで拒否`

### Step 3: 共通売単価（CommonSellingPrice）ガード一式
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterCommonSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/factories/registerCommonSellingPricePeriodCommandFactory.ts`
  - 同名の domain / command テスト2ファイル
- 作業内容:
  - Step 2 と同型。`create(productId, category)`、`category.isSet()` で `ValidationError("セット商品には販売単価を登録できません")`
  - Register への `ProductQueryService` 導入・factory 配線・テスト追加
- コミットメッセージ: `feat: #515 共通売単価の期間登録でセット商品をファクトリガードで拒否`

### Step 4: 得意先別販売単価（CustomerSellingPrice）ガード一式
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CustomerSellingPrice.ts`
  - `src/server/subdomains/pricing/application/commands/RegisterCustomerSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/factories/registerCustomerSellingPricePeriodCommandFactory.ts`
  - 同名の domain / command テスト2ファイル
- 作業内容:
  - Step 2 と同型。`create(customerId, productId, category)`（customerId は先頭のまま維持）、`category.isSet()` で `ValidationError("セット商品には販売単価を登録できません")`
  - Register への `ProductQueryService` 導入・factory 配線・テスト追加
- コミットメッセージ: `feat: #515 得意先別販売単価の期間登録でセット商品をファクトリガードで拒否`

### Step 5: 全体検証と逸脱記録
- 作業内容:
  - `pnpm test`（pricing の domain/application）と `pnpm lint` をグリーン確認
  - 計画と異なる対応があれば `docs/claude-plans/issue-515/deviations.md` に記録
- コミットメッセージ: （逸脱があれば）`docs: #515 実装計画からの逸脱記録`
