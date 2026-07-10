# Issue #593: 見積単価とマスタ現在値の乖離警告（行内バッジ＋申請時警告） — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。

## 概要

固定済みの見積単価（ADR-0064）と、現在のマスタ内容で価格決定を再実行した解決値との乖離（→CONTEXT「単価乖離」）をユーザーに可視化する。

- **行内バッジ**: 見積詳細＋C4 バリ内容編集の明細行に、乖離／解決不能のバッジを出す（warning トーン固定文言、現在値・差額はツールチップ）
- **申請時警告**: 申請確認モーダルの preview に警告フィールドを追加し、非ブロッキングの警告バナーを出す（申請ボタンの活性は変えない）
- 乖離の解消（再解決）は責務外。可視化に徹する

設計討議はグリルセッションで完了済み（2026-07-10）。決定の芯は **ADR-20260710-fg7**（見積年月日基準・表示時再解決の派生状態・永続化もブロックもしない）、用語は CONTEXT.md「単価乖離」「解決不能」を正準とする。

**TDD で実装する**: 各 step は Red（失敗するテストを先に書く）→ Green（最小実装）→ Refactor の順で進め、関連テストが緑になる単位でコミットする（pre-commit の `vitest related` が緑で通ること）。

## 設計判断

グリルセッションで確定済み。新たな判断は原則発生しない想定。

### 乖離の定義・判定方式・介入度（ADR-20260710-fg7 で記録済み）
- 比較基準: 見積年月日を参照日に、現在のマスタ内容で価格決定を再実行した値（今日基準は不採用）
- 判定方式: 永続化せず、Application 層 read クエリで表示のたびに再解決・突合（事前計算フラグは不採用）
- 介入度: 非ブロッキング（申請ブロック・保存時ダイアログは不採用）

### 解決不能の扱い（CONTEXT「解決不能」で記録済み）
- 乖離とは別の独立状態・別バッジ。見積行では失効/未設定の区別を畳む
- pricing に非 throw の解決経路を新設する（書き込み契機の throw 経路とは別。失効/未設定 3 状態クエリ #487 と同構図）

### 実装方針（ADR 対象外の合意事項）
- 対象画面: 見積詳細＋C4 編集の 2 画面。申請詳細は対象外
- 合成の配置: `GetEstimateDetailQuery`（app 層）が pricing の非 throw 解決クエリを呼んで LineDTO に合成する（ADR-20260707-ae2 の「query service は事実だけ・app 層で合成」パターン）
- デデュープ: 解決キーは「提出区分×商品ID」（見積年月日・得意先・納品先はヘッダ不変属性のため同一見積内で固定）。#597 の `duplicatedUnitPriceKey` と同形
- 申請時警告: `PreviewApplicationResultDTO` の `REQUIRED`/`EXEMPT` に警告情報（乖離件数・解決不能件数）を追加。kind は増やさない（警告は申請可否と直交）
- バッジ仕様: warning トーン・固定文言（「単価乖離」「解決不能」）。現在の解決値と差額（符号つき）はツールチップ（`title` 属性）。方向の色分けはしない
- 判定対象: 表示される価格付き末端行すべて一律（バリエーション状態・商品有効性で絞らない。セット群行は価格を持たないため対象外、セット構成明細は対象）
- テスト: BE 単体＋FE コンポーネントテストで担保。E2E は張らない（乖離シナリオは「作成後にマスタを動かす」時系列操作が必要で today 相対 seed と相性が悪く、バッジは読み取り専用表示で E2E が守る動線がない）

### DTO・命名の裁量（実装時に確定してよい範囲）
- 非 throw 解決クエリの名前、LineDTO に載せる判別ユニオンのフィールド名・kind 名、ツールチップの正確な文言形式は実装時の裁量。ただし用語は CONTEXT の正準語（単価乖離・解決不能）に沿うこと

## ステップ

### Step 1: pricing — 非 throw の販売単価解決経路
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/policies/PriceResolutionPolicy.ts`（非 throw 版メソッド追加。例: `tryResolve`）
  - `src/server/subdomains/pricing/application/queries/`（非 throw 解決クエリ新設。既存 `ResolveSellingPriceQuery.ts` の兄弟。「解決値 or 解決不能」の判別ユニオン DTO を返す）
  - `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts`（factory 追加）
  - 対応するテストファイル（先に書く）
- 作業内容:
  - Red: ポリシー非 throw 版（override ?? common → 値、両方 null → 解決不能）とクエリ（得意先宛/納品先宛×解決可/不能）のテストを先に書く
  - Green: 既存 throw 経路（書き込み契機の拒否）は変更せず、read 用の非 throw 経路を追加する
  - 既存 `ResolveSellingPriceQuery` と重複する解決ロジック（2 層並列取得・暦日変換）は共有できる形にリファクタしてよいが、throw 経路の挙動を変えない
- コミットメッセージ: `feat: 販売単価の非throw解決経路を追加（解決値or解決不能の判別ユニオン）`

### Step 2: estimate read — GetEstimateDetailQuery の乖離合成
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/GetEstimateDetailQuery.ts`（app 層で合成）
  - `src/server/subdomains/estimate/application/queries/dto/EstimateDetailDTO.ts`（LineDTO に判別ユニオン追加。例: 乖離なし／乖離（現在値つき）／解決不能）
  - 対応するテストファイル（先に書く）
- 作業内容:
  - Red: 単体テスト（専用 DB）で「乖離なし／乖離あり（現在値・固定値が DTO に載る）／解決不能／セット構成明細も判定される／同一提出区分×商品のデデュープ」を先に書く。乖離の作り方は「見積生成後に適用期間を動かす（適用終了・未来開始期間の削除に相当するデータ操作）」
  - Green: 価格付き末端行を「提出区分×商品ID」でデデュープし、Step 1 のクエリを並列実行して固定 unitPrice と突合、LineDTO に合成する。Prisma query service（`PrismaEstimateQueryService`）は変更しない（事実だけ返す責務を維持）
  - 状態・商品有効性による絞り込み分岐を入れない（一律適用）
- コミットメッセージ: `feat: 見積詳細readで単価乖離・解決不能を合成 (#593)`

### Step 3: 申請 preview — 警告フィールドの追加
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/PreviewApplicationResultDTO.ts`（`REQUIRED`/`EXEMPT` に乖離件数・解決不能件数の警告情報を追加）
  - 申請 preview クエリ（`previewApplication` の BE 実体）
  - 対応するテストファイル（先に書く）
- 作業内容:
  - Red: 「乖離明細があるバリの preview に件数が載る／乖離ゼロなら警告なし／解決不能も件数が載る」テストを先に書く
  - Green: 対象バリエーションの明細を Step 2 と同じ突合ヘルパーで判定し、件数を DTO に載せる。kind（REQUIRED/EXEMPT/BLOCKED/INACTIVE）は増やさない
  - Step 2 と Step 3 で突合ロジックが重複するなら app 層の共有ヘルパー（`application/shared/`）に抽出する
- コミットメッセージ: `feat: 申請previewに単価乖離・解決不能の警告件数を追加 (#593)`

### Step 4: FE — 見積詳細（LineTable）の行内バッジ
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/components/LineTable.tsx`
  - バッジ部品（既存 tone 体系 `badgeToneClassName` / shadcn Badge を流用。code→tone 写像は `switch`＋`never` 網羅ガードの既存パターン）
  - 対応するコンポーネントテスト（先に書く）
- 作業内容:
  - Red: 「乖離行に『単価乖離』バッジと現在値・差額ツールチップ／解決不能行に『解決不能』バッジと説明ツールチップ／乖離なし行にバッジなし」のテストを先に書く
  - Green: 単価列の隣にバッジを描画。warning トーン固定・方向の色分けなし。差額は符号つき（+¥/−¥）でツールチップに
- コミットメッセージ: `feat: 見積詳細の明細行に単価乖離・解決不能バッジを表示 (#593)`

### Step 5: FE — C4 編集（LineEditTable）の行内バッジ
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/components/LineEditTable.tsx`（および必要に応じ `VariationLineEditor.tsx` / `variationContentMapping.ts` / `variationLines.ts` で乖離情報を編集行モデルへ引き回す）
  - 対応するコンポーネントテスト（先に書く）
- 作業内容:
  - Red: 既存行に乖離／解決不能バッジが出るテストを先に書く（Step 4 と同じ表示仕様）
  - Green: DTO→編集フォームのマッピングに乖離情報を通し、既存行に表示する。編集操作（数量・掛率変更）はバッジに影響しない（ページロード時点の判定のまま）。商品入れ替え・行追加後の新行は保存まで判定対象外でよい
  - バッジ描画は Step 4 と部品を共有する
- コミットメッセージ: `feat: C4編集画面の明細行に単価乖離・解決不能バッジを表示 (#593)`

### Step 6: FE — 申請確認モーダルの警告バナー
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/ApplicationConfirmDialog.tsx`（`PreviewBody` の REQUIRED/EXEMPT 分岐に警告バナー追加）
  - `ApplicationConfirmDialog.test.tsx`（先に書く）
- 作業内容:
  - Red: 「警告ありの preview で黄色バナー（乖離 N 件・解決不能 M 件の文言）が出る／警告なしなら出ない／『申請する』ボタンの活性は警告の有無で変わらない」テストを先に書く
  - Green: 非ブロッキングでバナーを描画。BLOCKED は作らない・確認フッターは変更しない
- コミットメッセージ: `feat: 申請確認モーダルに単価乖離の非ブロッキング警告を表示 (#593)`

### Step 7: 仕上げ — Issue 更新と逸脱記録
- [ ] **完了**
- 対象ファイル: `docs/claude-plans/issue-593/deviations.md`（逸脱があった場合のみ）
- 作業内容:
  - 実装中に本計画から逸脱した点があれば deviations.md に記録する
  - Issue #593 の未決事項チェックボックスを決定内容で更新する（gh CLI）
  - `pnpm lint` / `tsc --noEmit` / 関連テスト全体の最終確認（pre-push のフルスイートが通ること）
- コミットメッセージ: `docs: issue-593 の逸脱記録を追加`（逸脱があった場合のみ）
