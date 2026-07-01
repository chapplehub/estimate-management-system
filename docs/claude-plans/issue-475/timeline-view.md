# Issue #475: 共通売単価 保守画面のタイムライン表示 — 実装計画

## Context

共通販売単価の適用期間は半開区間 `[開始, 終了)` の連なりで、表だと期間の連続性・隙間（未設定区間）・改定の前後関係が読み取りにくい。時間軸の帯で可視化すると、隙間や無期限（+∞）・現在有効/将来/失効が一目で分かる。

親 #429 の `fe-conversion-plan.md` 決定4で「表示モードは表のみ・timeline は後回し（付加的可視化で後付け可）」とされていた分の後付け実装。プロトタイプ（`docs/design/common-selling-price-maintenance/共通売単価 保守画面.dc.html`）の `タイムライン`/`テーブル` 切替に相当する。

本 issue は**付加的可視化**であり、機能完結には必須でない。BE/ドメインは #473 で編集読みモデル DTO（`start`/`end`/`status`）が揃っているため、**変更は presentation 層（FE）のみ**で完結する。

### grill で確定した前提（ユーザー回答）
- **表示構造**: プロト踏襲の**付加式**。操作テーブルは常時表示し、トグルで上部にタイムライン帯を付加表示する（相互排他の切替ではない）。
- **初期表示**: テーブル（帯なし）。fe-conversion-plan 決定4を尊重し、タイムラインは任意で開く付加機能とする。
- **トグル状態の保持**: クライアント状態（`useState`）。既存の決定2（パネル開閉を URL に載せずクライアント状態で保持）と一貫。リロードで初期値へ戻る。
- **テスト範囲**: E2E テスト作成まで含む。

## 設計判断

### 表示構造（付加式 vs 相互排他）
- A. 付加式（テーブル常時表示・帯をトグルで付加） ← プロト挙動に一致
- B. 相互排他の切替（timeline 時はテーブルを隠す）
- 決定: **A**（ユーザー確定済み）

### レイアウト計算ロジックの配置
- A. `_data/timeline-layout.ts` に純関数として切り出し、Vitest で単体テスト
- B. `PriceTimeline.tsx` コンポーネント内にインラインで計算
- 推奨: **A**。%変換・無期限の軸右端扱い・今日位置・パディングは副作用のない計算で、既存 `_data/period-rules.ts`（プレゼンテーション述語を純関数で分離しテスト済み）と同じ慣習に乗せられる。エッジケース（空・無期限・隙間・今日が範囲外）を単体テストで固定できる。

### 今日マーカーの基準日
- A. `page.tsx` が query に渡す `referenceDate`（`toJstCalendarDay(new Date())`）を props で client に流す
- B. client 側で `new Date()` を再計算する
- 推奨: **A**。BE が算出した `status`（active/future/expired）と同じ基準日に揃うため、帯の色分けと今日マーカーが必ず整合する。B は TZ・実行時刻差で status とマーカーがズレ得る。

### BE / ドメイン層の変更
- なし。DTO（`CommonSellingPriceEditPeriodDTO`）に `start`/`end`/`sellingPrice`/`status` が揃っており、追加取得は不要（#473 FE 素描画方針）。

## ステップ

### Step 1: タイムラインレイアウト純関数 + 単体テスト
- 対象ファイル:
  - `src/app/(features)/common-selling-prices/_data/timeline-layout.ts`（新規）
  - `src/app/(features)/common-selling-prices/_data/timeline-layout.test.ts`（新規）
- 作業内容:
  - `computeTimelineLayout(periods: CommonSellingPriceEditPeriodDTO[], referenceDate: string)` を実装。戻り値 `{ bars, todayPct, axisStart, axisEnd }`。
  - `bars` 各要素: `{ leftPct, widthPct, status, priceShort }`。プロト（HTML 586–614 行）の線形マッピングを踏襲 — 全期間の最小開始〜最大終了に約6%（下限30日相当）のパディング、`hi` を `referenceDate` まで拡張、無期限（`end === null`）は軸右端まで、`widthPct` は最小3%を確保。
  - 日付文字列 `"YYYY-MM-DD"` → 数値は UTC パースの純ヘルパで実装（TZ 非依存。`toJstCalendarDay` と同じ思想）。
  - `periods` 空配列時は `bars: []`（＝帯を描かない）。
  - `priceShort` は `formatYenFromDecimal`（`_components/formatYen.ts`）を流用。
  - Vitest: 空配列 / 単一無期限 / 隙間あり2期間 / 今日が全期間より過去・未来（範囲外）/ active・future・expired の3状態が正しく分類される、を検証。
- コミットメッセージ: `feat: 共通売単価タイムラインのレイアウト算出（純関数）を追加 (#475)`

### Step 2: PriceTimeline プレゼンテーションコンポーネント
- 対象ファイル:
  - `src/app/(features)/common-selling-prices/[productCd]/PriceTimeline.tsx`（新規）
- 作業内容:
  - `computeTimelineLayout` の結果を props で受け、帯・今日マーカー（赤・「今日」ラベル）・軸両端ラベル（axisStart/axisEnd）・凡例（現在有効/失効/将来）を描画。
  - `status` → パレット: `active`=緑・`future`=青・`expired`=灰（プロト HTML 209–211・599–601 行に一致）。
  - 帯は `left%`/`width%` を絶対配置。TailwindCSS 4 のユーティリティ + 動的 % は inline style で指定。
  - E2E 用に container へ `data-testid="price-timeline"`、凡例へ `data-testid="price-timeline-legend"` を付与（テーブルの状態バッジとテキストが衝突するため、凡例は testid でスコープ可能にする）。
  - `bars` が空なら「表示できる適用期間がありません」等の簡易表示（または帯領域のみ非表示）。
- コミットメッセージ: `feat: 共通売単価タイムライン帯コンポーネント PriceTimeline を追加 (#475)`

### Step 3: PeriodDetailPanel へトグル配線 + 参照日の受け渡し
- 対象ファイル:
  - `src/app/(features)/common-selling-prices/[productCd]/PeriodDetailPanel.tsx`（修正）
  - `src/app/(features)/common-selling-prices/[productCd]/page.tsx`（修正）
- 作業内容:
  - `page.tsx`: 既に算出済みの `referenceDate`（`toJstCalendarDay(new Date())`）を定数化し `PeriodDetailPanel` に `referenceDate` prop で渡す。
  - `PeriodDetailPanel.tsx`: `referenceDate` prop を追加。`useState<boolean>(false)`（既定＝帯なし＝テーブル）で帯表示を保持。「適用期間」ヘッダ付近にテーブル/タイムライン切替ボタン（プロト HTML 142–143 行のトグル風）を配置。ON 時に `computeTimelineLayout(detail.periods, referenceDate)` を呼び `PriceTimeline` を操作テーブルの**上**に描画（付加式）。テーブル本体と操作導線（新規追加/編集/適用終了/削除）は従来どおり常時表示。
- コミットメッセージ: `feat: 共通売単価 詳細にタイムライン/テーブル表示トグルを追加 (#475)`

### Step 4: E2E テスト
- 対象ファイル:
  - `src/app/(features)/common-selling-prices/common-selling-prices-detail.e2e.ts`（修正 — タイムライン用 `describe` を追加）
- 作業内容:
  - 既存の `PRD820`（失効/現在有効/将来の3期間・today 相対シード）を利用。
  - 検証: 初期状態で `price-timeline` が非表示（既定＝テーブル）→ 「タイムライン」ボタン押下で `price-timeline` が可視 → 今日マーカー可視・帯が3本・凡例（`price-timeline-legend` 内に 現在有効/失効/将来）表示 → 「テーブル」ボタンで帯が消える。
  - 状態バッジ（テーブル）と凡例のテキスト衝突を避けるため、凡例アサートは `data-testid="price-timeline-legend"` でスコープする。
  - 共通シード・DB 不変（並列可）。管理者 storageState 既定。
- コミットメッセージ: `test: 共通売単価タイムライン表示の E2E テストを追加 (#475)`

## 検証

- `pnpm test` — Step 1 の `timeline-layout.test.ts`（単体）がグリーン。
- `pnpm lint` — 型・lint 通過。
- `pnpm e2e` — Step 4 の詳細 E2E（タイムライン describe 含む）がグリーン。
- 手動確認: `pnpm dev` → `/common-selling-prices/PRD820` を開き、既定でテーブルのみ → トグルで帯・今日マーカー・凡例が出ること、無期限帯が軸右端まで伸びること、隙間が視認できることを目視。
