# Issue #333: 見積詳細画面 S5 セット明細の編集（C1/C4 のセット書き込み） — 実装計画

## 概要

セット明細の**書き込み経路**を実装する。S1（永続化 diff-upsert）と S2（読み取り DTO `LineDTO | SetGroupDTO`）は完成済みで、空白なのは中間の write チェーン（`VariationContent` 型 → `replaceContent` → `EstimateFactory` → `VariationContentInput` → フォーム schema → 作業コピー → `LineEditTable`）。これらにセット群を通し、C4（`UpdateVariation`・詳細画面の編集フォーム）と C1（`CreateEstimate`・app/factory/domain 層のみ、UI は別 issue #351）でセット群を書けるようにする。

設計判断は `/grill-with-docs`（2026-06-16）で合意済み。機構は **ADR-0052**、計画逸脱は **deviations.md** に記録済み。

## 設計判断

すべて合意・記録済み（再オープン不要）。

### 往復形状（A・採用）
- 作業コピー／JSON を `(LineNode | SetGroupNode)[]` のトップレベル判別子 union。`SetGroupNode` が `components` を内包し、読み取り DTO（`LineDTO | SetGroupDTO`）と対称。
- 理由: 連続配置・非交錯・set-aware D&D が配列構造でタダで保証される。ADR-0050（JSON hidden 往復）の継承・具体化。

### 自動展開（B・採用）
- `expandSetComponents(productId)` サーバーアクションで構成を解決。`unitPrice=0`（要入力）、`quantity=SetProductComponent.quantity`、名称/単位はスナップショット。
- 無効構成商品（`isActive=false`）は**捨てず含めて警告フラグを付ける**（周辺商品サジェストとは意図的に非対称＝セット構成は商品定義そのものゆえ欠けさせない）。

### 集約越え検証の機構（ADR-0052・採用）
- ドメインポートは新設せず、**ADR-0030（method-args）**: アプリ層が `ProductQueryService` で区分・`isActive` をライブ取得 → 純粋ドメイン検証 `SetComponentRule` に引数で渡す。
- 構成商品の区分 ∈ {個別, 消耗品}（ネスト禁止＝SET不可）は**ハードエラー**、無効構成は**非ブロッキング警告**。自動展開しか UI が無くても保存時のライブ検証を**ペイロード防御**として導入。
- ADR-0047 §補足の「ドメインポート」前約束を ADR-0052 で差し替え。

### 無効構成の警告 UI（C・採用）
- **インライン・状態導出**（永続条件ゆえトースト不可）。`LineDTO` に `isActive`（read-through・既存 join から1列）を追加し、展開時・再編集時とも作業コピーの `isActive` から導出。

### 商品インライン差し替え（不採用）
- S4 同様に行の商品差し替え UI は作らない。SET は明細追加モーダルから新規ノードとして追加。行改良指示書 §8 残課題「切替時の既存値」は**該当なし**で消滅。

### 群ライフサイクル（採用）
- 群ヘッダ削除＝構成カスケード／最後の構成明細削除＝群ごと自動削除（空群禁止の第一防御）／D&D は群＝トップレベル `arrayMove`・構成＝群内 `components` 配列内のみ。

### スコープ
- C1 は app/factory/domain まで配線（seed/テストでセット付き生成可）、**UI は C4 のみ**。create 画面 UI は #351。
- 手動構成追加（＋区分検証の UI 到達経路）は #350 へ繰り延べ。

## ステップ

### Step 1: ドメイン — VariationContent / replaceContent / ファクトリにセット群を通す
- 対象ファイル: `domain/entities/EstimateVariation.ts`, `domain/entities/EstimateFactory.ts`
- 作業内容:
  - `VariationContent` 型に `setGroups: EstimateSetGroup[]` を追加。
  - `replaceContent` で `_setGroups` も「同一参照を保ったまま全置換」し、`assertSetGroupsConsistency`（参照整合・排他所属）を再実行。
  - `EstimateVariationDescriptor` / `VariationContentDescriptor` に setGroups を追加（create 経路 C1）。
  - `EstimateFactory.buildVariationContent` / `buildVariation` を、構成明細を先に `EstimateItem.create` し**生成された id** を `EstimateSetGroup.create({ memberItemIds })` へ配線するよう拡張（会員解決）。
- コミットメッセージ: `feat: 見積詳細画面 S5 セット群を VariationContent/replaceContent/ファクトリへ通す`（body: replaceContent は _setGroups も全置換し参照整合・排他所属を再検証。会員解決は構成明細の生成 id を群へ配線）

### Step 2: ドメイン — SetComponentRule（区分・無効の純粋検証）
- 対象ファイル: `domain/services/SetComponentRule.ts`（新規）, `domain/services/__tests__/`
- 作業内容:
  - 商品事実（`{ productId → { category, isActive } }`）を**引数で受け取る**純粋検証を実装（ADR-0030/0052）。
  - 構成商品の区分 ∈ {個別, 消耗品} 以外（SET 含む）は `BusinessRuleViolationError`。無効構成は warning として集約して返す（throw しない）。
- コミットメッセージ: `feat: 見積詳細画面 S5 セット構成の集約越え検証 SetComponentRule（ADR-0052）`（body: ドメインポートを新設せず商品事実を引数で受ける。区分外はハード、無効は非ブロッキング警告）

### Step 3: アプリ — 入力 union 化＋コマンドでライブ検証配線
- 対象ファイル: `application/shared/variationContentInput.ts`, `application/commands/UpdateVariationCommand.ts`, `application/commands/CreateEstimateCommand.ts`, product 側 `ProductQueryService`（区分・isActive のバッチ取得が無ければ追加）
- 作業内容:
  - `VariationContentInput` を `nodes: (line | setGroup)` union へ変更し、`toVariationContentDescriptor` を setGroups 対応に。
  - C4/C1 コマンドで、セット群の全 productId（群本体＋構成）について `ProductQueryService` で区分・isActive をライブ取得 → `SetComponentRule` を実行。
- コミットメッセージ: `feat: 見積詳細画面 S5 C4/C1 にセット書き込み＋区分ライブ検証を配線`（body: 商品事実は ProductQueryService から取得し SetComponentRule へ引数で渡す。ADR-0052）

### Step 4: 読み取り — LineDTO に isActive を追加（read-through）
- 対象ファイル: `application/queries/dto/EstimateDetailDTO.ts`, `infrastructure/queries/PrismaEstimateQueryService.ts`
- 作業内容:
  - `LineDTO` に `isActive: boolean` を追加。read クエリが既に `include: { product: true }` 済みなので `i.product.isActive` を1列写すだけ。
- コミットメッセージ: `feat: 見積詳細画面 S5 LineDTO に商品 isActive を read-through で追加`（body: 無効構成のインライン警告を状態導出するため。既存 join 済みデータの1列）

### Step 5: プレゼン — expandSetComponents サーバーアクション
- 対象ファイル: `_shared/selection-actions.ts`
- 作業内容:
  - `getProductSuggestions` と同型に、SET 商品を findById → 各 `setComponents` を findById で単位・isActive 解決 → 構成スナップショット（id/code/name/category/unit/quantity/isActive）を返す。無効は捨てず isActive を付けて返す。
- コミットメッセージ: `feat: 見積詳細画面 S5 セット構成の自動展開アクション expandSetComponents`

### Step 6: プレゼン — 作業コピーとフォーム schema の union 化
- 対象ファイル: `[estimateNumber]/variationLines.ts`, `[estimateNumber]/variationSchema.ts`, `[estimateNumber]/variationContentMapping.ts`, 各 `*.test.ts`
- 作業内容:
  - `WorkingNode = WorkingLine | WorkingSetGroup`（components 内包）。`fromLineDTO`/`fromSetGroupDTO`、展開挿入、群カスケード削除、**最後の構成削除で群自動削除**、set-aware reorder（群＝トップレベル／構成＝群内）、`toNodePayload`。
  - `variationSchema` を `discriminatedUnion("kind", [lineNode, setGroupNode])`、`setGroupNode.components` は `.min(1)`（空群禁止の第一防御）。
  - `variationContentMapping` を nodes union → `VariationContentInput.nodes` へ。
- コミットメッセージ: `feat: 見積詳細画面 S5 作業コピー・フォーム schema をセット群入れ子 union 化（ADR-0050）`

### Step 7: プレゼン — LineEditTable / VariationEditForm のセット UI・D&D・配線
- 対象ファイル: `[estimateNumber]/components/LineEditTable.tsx`, `[estimateNumber]/VariationEditForm.tsx`, `[estimateNumber]/previewAmounts.ts`
- 作業内容:
  - 群ヘッダ行（価格列非活性・金額＝構成合計の導出表示）・構成行のインデント・無効構成のインライン警告バッジ。
  - set-aware D&D（群＝トップレベル `arrayMove`、構成＝群内のみ）。群削除＝カスケード。
  - `handleProductSelect` に `picked.category === 'SET'` 分岐 → `expandSetComponents` → `WorkingSetGroup` 挿入（アクティブが構成/群のときは群直後＝トップレベルへ）。
  - プレビュー金額に群合計の導出を追加。
- コミットメッセージ: `feat: 見積詳細画面 S5 明細テーブルのセット群描画・set-aware D&D・配線`

### Step 8: seed＋テスト（ドメイン/アプリ/E2E）
- 対象ファイル: `prisma/seed*`, ドメイン/アプリ/プレゼンの `__tests__`, E2E（`*.e2e.ts`）
- 作業内容:
  - seed にセット群付き見積を含める（S2 閲覧・S5 編集の確認データ）。
  - replaceContent（setGroups 全置換）・SetComponentRule・コマンド検証・作業コピー純関数のテスト。E2E でセット追加→保存→再表示。
- コミットメッセージ: `test: 見積詳細画面 S5 セット明細編集のドメイン/アプリ/E2E テストと seed`
