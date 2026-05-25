# Issue #284 実装中の計画逸脱記録

実装中に計画 (`estimate-aggregate-and-module-boundary.md`) と異なる対応をした項目の記録。

## 1. ID 値オブジェクトの個別単体テストを書かなかった

- **元の計画 (Step 1)**: `EstimateId` / `EstimateVariationId` / `EstimateItemId` の各 `__tests__/{Name}.test.ts` を作成。
- **実際の実装**: 個別テストを作成しなかった。
- **理由**: 既存サブドメイン（Customer/Product/Department 等）の ID VO はいずれも個別テストを持っておらず、`shared/domain/values/__tests__/EntityId.test.ts` の共通テストで UUIDv7 バリデーションがカバーされている。本プロジェクトの規約に合わせる方を優先した。

## 2. 子エンティティ用 ID VO 3 つを追加

- **元の計画 (Step 1)**: ID VO は 3 つ（EstimateId / EstimateVariationId / EstimateItemId）。
- **実際の実装**: さらに 3 つ追加（`RevisedEstimateItemDetailId` / `RepairEstimateDetailId` / `AfterRepairEstimateDetailId`）。
- **理由**: 子エンティティもプロジェクト規約（全エンティティが型ブランド ID を持つ）に整合させるため。`string` のまま運用すると Money・Quantity 等の VO 化規約と整合しない。

## 3. VariationStatus に遷移メソッドを持たせなかった

- **元の計画 (Step 2)**: `activate()` / `deactivate()` 等の判定/遷移ヘルパを VariationStatus VO に持たせる。
- **実際の実装**: `isActive()` / `isInactive()` の判定のみ。遷移は親エンティティ (`EstimateVariation.activate()` / `deactivate()`) 側で `this._status = VariationStatus.INACTIVE` の形で行う。
- **理由**: VO の責務は「状態の表現」であり、状態遷移そのものはエンティティの責務。既存 `EstimateType` 実装にも遷移メソッドは無く、一貫性を優先。

## 4. EstimateItem.create() でオブジェクト引数を採用

- **元の計画 (Step 6)**: 既存 Customer エンティティ等の「positional + options」パターンを踏襲する想定。
- **実際の実装**: `EstimateItemCreateInput` 型の単一オブジェクト引数を採用。
- **理由**: 必須 6 項目 + 任意 5 項目あり、positional 7 つは可読性が著しく落ちる。同サブドメインの `EstimateAmountPolicy.calculate(input)` 既存パターンに揃えた。

## 5. itemName / unit / memo を VO 化せず string で受けた

- **元の計画 (Step 6)**: 明確な指示なしだが、VO 化規約に従う暗黙の想定があった。
- **実際の実装**: `string` のまま受け、エンティティ内 `private static assert*` で長さ検証。
- **理由**: これらは商品マスタからのスナップショット（§8 金額の保存形式と整合させるため見積時点の値を凍結）であり、見積独自の業務制約は VarChar 長制限のみ。VO 化のコスト（クラス 3 つ + テスト追加）に見合うリターンがない。

## 6. EstimateVariation に明細委譲メソッド群を追加

- **元の計画 (Step 9)**: `addItem()` / `removeItem()` / `updateItem()` ですべて自動再計算。
- **実際の実装**: 加えて `changeItemQuantity()` / `changeItemUnitPrice()` / `changeItemDiscountRate()` / `changeItemDiscount()` の 4 つの委譲メソッドを追加（さらに集約ルート Estimate からも同名で呼べる）。
- **理由**: 集約境界規約により子 EstimateItem を外部から直接操作できないため、Variation 経由の API が必要。「明細変更のつど自動再計算」を構造的に守るための具体実装として必須だった。

## 7. EstimateVariation の税情報を引数で受ける形にした (TaxContext)

- **元の計画 (Step 9)**: `taxRate` / `taxRoundingType` は計算時に親 Estimate から渡される（自分では保持しない）。
- **実際の実装**: 計画通り Variation 自身は税情報を保持しないが、全 mutator が `tax: TaxContext` を引数で受けるシグネチャを採用。
- **理由**: 計画の方針を具体化した結果。集約ルート Estimate が `taxContext()` をプライベートに作って各呼び出しで渡すパターンに収まった。利用者は集約ルート経由で呼ぶため `TaxContext` を意識しない。

## 8. §3.4「申請バリエーション 1 つ制約」を Domain 層では構造的に禁止しなかった

- **元の計画 (Step 10)**: `activateVariation(id)` 等で §3.4 制約チェックを集約ルート側に含める。
- **実際の実装**: 複数の Variation を同時に ACTIVE にできる（API で禁止しない）。§3.4 は申請ユースケース（着手順序 #6）で実装する方針に変更。
- **理由**: §3.4 は「**申請できる**バリエーションは1つのみ」であり、ACTIVE 状態と申請可能性を Domain 層で同一視するのは過剰制約。バリエーション間で見積を比較しながら複数を ACTIVE にしておくワークフロー（顧客提案・社内検討）を許容する必要があり、申請という業務イベントの時に 1 つに絞る方が業務実態に合う。

## 9. 集約レベルで「最低 1 明細」を強制しなかった

- **元の計画 (Step 10)**: §C1 不変条件 = 空見積不可 として「ヘッダ + 最低 1 バリエーション + 明細」を同時に受け取る。
- **実際の実装**: 集約ルート Estimate は「最低 1 バリエーション」のみ強制。EstimateVariation 自身は `items: []` の作成を許可する。
- **理由**: 「ヘッダだけ先に作って明細は後から追加」「明細を空にしてからまとめて入れ替える」など、業務上の正当なワークフローを Domain で阻害しない判断。「明細が必要」な制約は「申請可能性チェック」など特定のユースケースで実装する方が業務実態と整合する。

## 10. 計画ファイル名

- **元の計画**: `docs/claude-plans/snappy-finding-russell.md` から `docs/claude-plans/issue-284/plan.md` に移動。
- **実際の実装**: 移動先を `docs/claude-plans/issue-284/estimate-aggregate-and-module-boundary.md` とした。
- **理由**: PostToolUse フックリマインダで「`plan.md` やランダム名は不可、kebab-case にする」と指示があったため、内容を表す kebab-case 名を採用。
