# Issue #619: 周辺商品の追加を明細行の「周辺商品追加」ボタン操作に変更する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

商品追加時に周辺商品サジェストダイアログが自動で割り込む方式（`useVariationLineEditor.handleProductSelect` → `setSuggestState` → `ProductSuggestDialog`）を廃止し、周辺商品を持つ本体明細行の**明示ボタン**からダイアログを開く方式へ変更する。自動割り込みは #618（複数商品の一括追加）と相性が悪く、一括追加のたびに複数のサジェストが割り込む問題を生むため。

- 商品追加時の自動サジェスト表示を廃止（`handleProductSelect` 内の単一商品分岐を削除）
- 周辺商品を持つ**トップレベル通常明細**に「周辺追加」ボタンを設ける
- 押下でサジェストダイアログを開き、周辺商品を本体直下へ通常行として追加できるようにする

エディタは3画面（新規見積 `CreateEstimateForm`／バリ追加 `VariationCreateForm`／バリ編集 `VariationEditForm`）で共有。凍結（改訂元）・行構成固定（改訂先）のバリは `VariationEditForm` 自体がレンダーされない（`isVariationEditable` = `revisionRole === "NONE" && status === "ACTIVE"`）ため、追加のガードは不要（既存「明細追加」ボタンと同じ土俵）。

## 設計判断

### ボタンの出し分けに使う「周辺商品を持つか」の供給方法
- A. `hasPeripheral: boolean` を行モデル（`LineDTO`／`WorkingLine`）に持たせ、同期的に出し分ける
- B. 全通常行にボタンを出し、押下時にフェッチして空なら通知
- C. エディタが productId 群をまとめて遅延バッチ解決
- **採用: A**。Issue の「周辺商品を持つ行にだけ出す」に忠実で、押下時のネットワーク待ちが無く、既存 product read-through（ADR-0048）に相乗りできるため。

### `hasPeripheral` の性質（スナップショット vs read-through）
- **採用: 現在マスタの read-through（非スナップショット）**。ボタンの目的は「今のマスタが提供する周辺を足す」ことで、実追加も押下時に現在マスタを引く。出し分けも現在マスタと一致していないと嘘になる。既存 `productCode`/`isActive` と同じ read-through（ADR-0048）に相乗りでき、永続化列・スキーマ変更が不要。

### `hasPeripheral` の判定粒度
- **採用: 周辺関係（`ProductRelation`）の行が1件以上（相手の有効性は問わない）**。ダイアログ中身の真実は押下時の `getProductSuggestions`（有効フィルタ済み）が握るため、フラグは安い出し分けで足りる。全見積詳細ロードに相手商品への入れ子 join を足す恒常コストを避ける。「全周辺が無効」の稀ケースは後述の空周辺ハンドリングで吸収。

### ボタンの適用対象
- **採用: トップレベル通常明細のみ**（構成明細・セット群には出さない）。周辺商品は「別売り＝親に金額集約しない通常明細」であり、セット群の中に入れる行ではない。構成明細に出すと挿入先が「群の中（ADR-0047 の構成明細不変条件違反）」か「群の外（位置が不自然）」で破綻する。セット商品は周辺商品を設定できない（設定先は個別商品・消耗品のみ）。

### カスケード（周辺の周辺）
- **採用: 許可（特別扱いしない）**。ボタンで足した周辺行も `hasPeripheral` を持てば同じくボタンが出る。旧「1段のみ」は自動割り込みのスパム防止という対話上の制約で、ドメイン不変条件ではない。手動操作なのでスパムは起きず、「周辺由来の行」を追跡するフラグを持たずに一律ルールで済む。

### 空周辺（押下したが有効な周辺が0件）のハンドリング
- **採用: ダイアログを開かず `selectionError` バナーに「有効な周辺商品がありません」を出す**。空モーダルの無駄足を避け、`suggestState` は「必ず中身がある」不変を保つ。`getProductSuggestions` の結果が ≥1 件のときだけダイアログを開く。

### ダイアログの既定チェック挙動
- **採用: 全件チェック維持（現状の `ProductSuggestDialog` のまま）**。ボタン押下は「周辺を足したい」明示操作なので全件チェックが意図と合う。再オープンで重複しうるがユーザーが外せる範囲で、見積は元々同一商品の重複明細を許す。既追加分を外す賢い既定（兄弟行 productId をダイアログへ渡す結合）は再オープンの頻度に見合わないため採らない。

### ドキュメント
- **CONTEXT.md 変更なし**。`周辺商品` は既に「見積画面で本体商品の下の行として追加できる」と定義済みで、今回は操作契機（自動→明示ボタン）の変更＝実装詳細。用語集に足す新語は無い。
- **ADR 起票せず**。read-through（ADR-0048）・0円明細拒否（ADR-0064）の既存決定に相乗りし、UI 配線と派生 DTO フィールド追加で容易に巻き戻せる（不可逆でない）。設計判断はコミットボディに残す。

## ステップ

### Step 1: 見積詳細 read-through に `hasPeripheral` を追加
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/EstimateDetailDTO.ts`（`LineDTO` に `hasPeripheral: boolean` を追加）
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts`（product read-through に周辺関係の件数を含め、`hasPeripheral = 件数 > 0` を導出）
  - `src/server/subdomains/estimate/application/queries/__tests__/GetEstimateDetailQuery.test.ts`（期待 DTO に `hasPeripheral` を追記）
- テスト戦略: テスト不要（Infrastructure QueryService の read-through マッピング。Application 層テストが間接カバー。既存 GetEstimateDetailQuery.test.ts の期待値へ `hasPeripheral` を追記するのみで、新規テスト設計は不要）
- 作業内容:
  - `LineDTO` に `hasPeripheral: boolean`（read-through・ADR-0048 系）を追加。JSDoc に「現在マスタ read-through／周辺関係行の有無で判定（相手の有効性は問わない）」を明記
  - include に周辺関係の件数を足す（`_count` もしくは関係の最小取得）。セット群の構成明細（`SetGroupDTO.components` の `LineDTO`）にもフィールドは載るが、UI はトップレベル通常明細でしか参照しない
  - QueryService の LineDTO マッピングで `hasPeripheral` を埋める
- コミットメッセージ: `feat: 見積明細DTOに周辺商品の有無(hasPeripheral)をread-throughで追加 (#619)`

### Step 2: クライアント行モデルへ `hasPeripheral` を供給
- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/_shared/selection-actions.ts`（`ProductLineSnapshot` に `hasPeripheral` を追加し、`getProductLineSnapshot` が `product` の周辺関係有無から埋める）
  - `src/app/(features)/estimates/[estimateNumber]/variationLines.ts`（`WorkingLine` に `hasPeripheral` を追加。`createWorkingLine`＝スナップショット由来、`fromLineDTO`＝DTO 由来の双方で搬送）
  - `src/app/(features)/estimates/[estimateNumber]/variationLines.test.ts`（`hasPeripheral` の搬送を担保）
- テスト戦略: 実装後テスト（`variationLines.ts` は純関数マッピング。既存 vitest スペックに `hasPeripheral` の搬送検証を追記する）
- 作業内容:
  - `ProductLineSnapshot`／`SuggestedProduct` に `hasPeripheral` を追加。`getProductLineSnapshot` は `product.relatedProducts` の件数から `hasPeripheral` を埋める（現在マスタ由来）。周辺商品として足す行（`getProductSuggestions` 由来）も自身の `hasPeripheral` を持てるようにし、カスケードのボタン表示に使う
  - `WorkingLine` に `hasPeripheral` を追加し、`createWorkingLine`／`fromLineDTO` で搬送
- コミットメッセージ: `feat: クライアント明細行に周辺商品の有無を搬送する (#619)`

### Step 3: フックを自動サジェスト廃止＋ボタン駆動へ書き換え
- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.test.ts`
- テスト戦略: TDD（フックの振る舞いは実装前に言い切れる：空周辺→`selectionError` セット・`suggestState` 据え置き／非空→`suggestState` セット。既存フックテスト harness あり）
- 作業内容:
  - `handleProductSelect` 末尾の「単一の通常商品なら自動でサジェスト」分岐（`if (only?.kind === "product")` 一帯）を削除。`handleProductSelect` はノード挿入までで完結させる
  - 新ハンドラ `requestSuggestions(rowId, productId)` を追加：`getProductSuggestions(productId)` を叩き、≥1件なら `setSuggestState({ mainRowId: rowId, mainName, suggestions })`、0件なら `setSelectionError("有効な周辺商品がありません")` でダイアログを開かない
  - `confirmSuggestions` は現状踏襲（`suggestState.mainRowId` 直下へ挿入、単価解決不能はスキップ列挙）。返り値に `requestSuggestions` を追加
- コミットメッセージ: `feat: 周辺商品サジェストを自動表示からボタン駆動に変更する (#619)`

### Step 4: 明細行に「周辺追加」ボタンを設置・配線
- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/components/LineEditTable.tsx`（トップレベル `EditRow` の操作列に、`line.hasPeripheral` のときだけ「周辺追加」ボタン。構成明細＝`indent` 行とセット群には出さない）
  - `src/app/(features)/estimates/[estimateNumber]/components/VariationLineEditor.tsx`（`LineEditTable` へ `onRequestSuggestions` を渡し、`editor.requestSuggestions` に配線）
  - `src/app/(features)/estimates/[estimateNumber]/components/ProductSuggestDialog.tsx`（「本体追加直後に表示」等の文言・JSDoc を on-demand 前提に更新。既定全件チェックは維持）
- テスト戦略: 実装後テスト（Presentation コンポーネント。画面が動いてから E2E で担保）
- 作業内容:
  - `EditRow` に `hasPeripheral` と `onRequestSuggestions` を渡し、トップレベル（`!indent`）かつ `hasPeripheral` のときのみ操作列にボタンを描画。押下中は非活性（連打防止）
  - `LineEditTable` の Props に `onRequestSuggestions?: (rowId: string, productId: string) => void` を追加し、構成明細には渡さない
  - ダイアログの文言・コメントを「明示操作で開く」前提に修正
- コミットメッセージ: `feat: 明細行に周辺商品追加ボタンを設置する (#619)`

### Step 5: E2E を自動サジェスト廃止＋ボタン駆動へ更新
- [ ] **完了**
- 対象ファイル: 周辺サジェストに触れる既存 `*.e2e.ts`（変更に関係するスペックのみ特定して更新）
- テスト戦略: 実装後テスト（E2E）
- 作業内容:
  - 「商品追加直後にダイアログが自動で出る」前提のアサーションを削除・置換
  - 「周辺を持つ本体行の『周辺追加』ボタン押下→ダイアログ→本体直下に周辺行が入る」フローを検証
  - 構成明細・セット群にはボタンが出ないこと、周辺を持たない行にはボタンが出ないことを確認
- コミットメッセージ: `test: 周辺商品追加のボタン駆動フローをE2Eで検証する (#619)`

### Step 6: dev server + Playwright MCP で実機確認
- [ ] **完了**
- 対象ファイル: なし（実機目視確認。コミットは発生しない）
- テスト戦略: テスト不要（自動テストではなく `verify-frontend` スキルによる実機目視確認）
- 作業内容:
  - `verify-frontend` スキルの手順で dev server を立て、Playwright MCP でログイン→見積編集画面へ遷移
  - 商品追加時に**サジェストが自動で割り込まない**ことを目視確認（旧挙動の廃止）
  - 周辺商品を持つ本体明細行に「周辺追加」ボタンが出ること、押下でダイアログが開き本体直下に周辺行が入ることを確認
  - 周辺を持たない行・構成明細・セット群にボタンが出ないことを確認
  - 空周辺（有効な周辺が0件）の商品でボタン押下時、ダイアログを開かず `selectionError` バナーに通知が出ることを確認（該当データがあれば）
  - カスケード：追加した周辺行が自身も周辺を持つ場合にボタンが出ることを確認
  - 気づいた不具合は前ステップへ戻して修正する（このステップ自体はコミットを生まない）
- コミットメッセージ: なし（実機確認のみ）
