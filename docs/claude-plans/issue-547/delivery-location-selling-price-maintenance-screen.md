# Issue #547: 納品先別販売単価 管理画面（登録・編集・適用終了・削除 + 改訂ウィザード + タイムライン） — 実装計画

## Context

納品先別販売単価の価格決定は「**納品先別 → 得意先別 → 共通**」の3段フォールバック。親 #544 の分割のうち本イシューは **FE 管理画面**で、ある納品先 × 商品の適用期間行に対する登録・編集・適用終了・削除と、改訂ウィザード・タイムライン帯を1画面に含める。

BE は完成済み（書き込み #545/#550・読みモデル #546/#552）で、本イシューは **FE のみ**（BE に接続するだけ）。一覧画面 #548 は出荷済みで、そこから行クリックで本管理画面へ遷移する。得意先別 #507 とほぼ同型のため、`customer-selling-prices/[customerCd]/[productCd]/` を**ディレクトリごとコピー写像**し、宛先軸を「得意先→納品先」に差し替えるのが基本方針。唯一 #507 の単純写像で済まないのがタイムラインで、フォールバック層が1段深い（得意先別レーンが増える）ため従レーンが2本になる。

## 設計判断

### 得意先別 #507 の流用方針 — 判断不要（前例踏襲）
`customer-selling-prices/[customerCd]/[productCd]/` をディレクトリごとコピー写像し、`_shared` の原子（`authorityFor` / `computeTimelineLayout` / `formatYenFromDecimal` / `formatPeriod` / `handleCommandError`）は共有を続ける。ADR-20260627-a5c（型は集約ごとに独立複製し共有しない）と対称。BE factory も既に `DeliveryLocation` へ置換した同名構造で実装済み。

### ルート階層（2階層 vs 3階層） — 確定（#548 に追従）
**2階層 `/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]`**。出荷済みの #548 が `columns.tsx` で `href=/delivery-location-selling-prices/${deliveryLocationCode}/${productCode}`（customerCd を挟まない）と遷移リンクを組んでおり、本管理画面はその受け側。追従一択。

### タイムラインのフォールバック層 — 確定（ユーザー選択: 得意先別＋共通の2従レーン）
主レーン=納品先別（操作対象）、従レーン=得意先別＋共通（淡色・表示専用）の**3レーン**。3段フォールバックの「上書きが無い期間に実際いくらが適用されるか（得意先別があればそれ、無ければ共通）」を一目で対比できる。データは編集DTOの親 `customerCode` から得意先別を、`productCode` から共通を追加取得でき、BE 追加実装ゼロ。

### `computeTimelineLayout` の複数従レーン一般化方式 — 推奨 A
現状は主 + 従レーン**1本**（`secondaryPeriods: TimelinePeriod[]` → `secondaryBars: TimelineBar[]`）まで。従レーン2本には拡張が必要。
- **A（推奨）**: `secondaryPeriods` を従レーンの配列 `secondaryLanes: TimelinePeriod[][]` に一般化し、`secondaryBars: TimelineBar[][]` を返す。軸範囲は主＋全従レーンの和集合から算出。得意先別 #507 側は `[commonPeriods]` と配列でラップして渡す1行修正＋`PriceTimeline` の `secondaryBars` 消費を `secondaryBars[0]` に読み替える軽微修正。
- **B**: 第4引数 `tertiaryPeriods` を足し `tertiaryBars` を返す（2従レーン固定）。得意先別は第4引数省略で無修正。ただし「従レーン2本まで」を型に刻み、将来の拡張余地を狭める。
- 採用理由: #507 計画が予告した「**抽象化は納品先別（3例目）が出てから**」の実行タイミング。従レーン数を型で固定しない一般化が正しい方向。跨ぎ作業（#507 の2ファイル修正）は発生するが軽微で、純関数ゆえ TDD で既存の単レーン（共通単価・原価）・2レーン（得意先別）テスト GREEN を担保できる。

### 得意先別レーンの取得順 — detail 依存の2段取得
得意先別レーンを引くには親得意先コードが要り、これは納品先別の編集DTO（`detail`）取得後に判明する。よって `page.tsx` は「①納品先別 detail と共通（`productCode` のみで引ける）を `Promise.all`、②detail から得た `customerCode` で得意先別を引く」の2段。共通は最初から並行、得意先別のみ detail 依存。得意先別が null（商品不在等）でも従レーンを空扱いで描画継続（#507 の共通レーンと同じ堅牢性）。

### 「上書きなし」状態の画面表現 — 3段フォールバックに合わせた情報提供トーン
`version: null` + `periods` 空は異常ではなく正常な派生状態。文言は「**この納品先×商品の上書きはありません。価格決定は得意先別販売単価を、無ければ共通販売単価を適用します。**」（警告 UI なし）。タイムラインは上書きなしでも描画し、従レーン（得意先別・共通）のみが表示される。

### 戻りリンク — 納品先選択済み一覧へ戻す
#548 出荷済みかつ納品先選択状態をパスに持つため、`/delivery-location-selling-prices/${deliveryLocationCode}`（選択済み一覧）へ戻す。#507 が一覧トップに戻したのは #508 未出荷時の死リンク回避事情によるもので、本イシューは選択状態を保った戻りが可能。

### フォーム統一（#351）・権限 — 判断不要（前例踏襲）
`PeriodForm` の3モード（new/edit/endDate 単一フォーム切替・`pickRuntime` で action(bind)＋zod スキーマ選択・`version==null` で新規/既存分岐）写像で自動充足。権限は `authorityFor(status)`（`_shared/period-rules.ts`・集約非依存）× `isAdmin(session)` の踏襲。

## TDD 適用方針
- **新規純ロジックは `computeTimelineLayout` の複数従レーン一般化のみ** → red-green-refactor（Step 3-1）。`_shared/timeline-layout.test.ts` に前例あり。
- コピー写像部分（画面部品・actions・schema）はコンポーネントテスト前例がなく、挙動担保は別イシューの E2E に委ねる。写像部分にテストを新設する逸脱はしない。

## ステップ

コミットは Issue 方針（基本操作 → 改訂ウィザード → タイムライン）の順で刻む。

### Step 1: 基本操作（登録・編集・適用終了・削除）
- 対象ファイル（すべて `src/app/(features)/delivery-location-selling-prices/[deliveryLocationCd]/[productCd]/` 配下・新規写像）:
  - `page.tsx` — `deliveryLocationSellingPriceEditQueryFactory().find({ deliveryLocationCode, productCode, referenceDate })`。null → `notFound()`。ヘッダに納品先・親得意先・商品の identity（コード/名称/無効バッジ）を dl 表示。`isAdmin(session)` 算出。戻りリンクは `/delivery-location-selling-prices/${deliveryLocationCode}`。この Step では共通のみ従レーン取得（後述 PriceTimeline 先行作成）。
  - `PeriodDetailPanel.tsx` — 期間行を束ねる中核 client。`PanelMode`(closed/new/edit/endDate/revise/delete) を client state 保持、表示/タイムライントグル、`authorityFor` で行操作出し分け、`isAdmin` false でミューテーションUI非描画。
  - `PeriodForm.tsx` — new/edit/endDate 単一フォーム写像。宛先キーを `(deliveryLocationId, productId)`、route キーを `(deliveryLocationCode, productCode)` に差し替え。
  - `PeriodDeleteConfirm.tsx` — 行内2段階削除確認。
  - `PriceTimeline.tsx` — **この Step では #507 の2レーン版を写像**（主=納品先別 / 従=共通1本）で先行作成しビルド可能に保つ（PeriodDetailPanel がトグルで参照するため。Step 3-2 で3レーン化。#507 と同じ先行作成パターンを計画に織り込み逸脱化を回避）。
  - `actions.ts` — add / updateFuture / endDate / delete の4 action。`register`/`edit`/`endDate`/`delete` `DeliveryLocationSellingPricePeriodCommandFactory` に接続、宛先キーを `.bind()`。parse→command→`handleCommandError`→revalidate（詳細＋一覧、redirect せず留まる）。
  - `schema.ts` — `addPeriodSchema`/`updateFuturePeriodSchema`/`endDatePeriodSchema`/`deletePeriodSchema`。conform 空文字→undefined 規約に従い必須でない string は `.optional()`。
- 空状態文言: 「この納品先×商品の上書きはありません。価格決定は得意先別販売単価を、無ければ共通販売単価を適用します。」
- コミット: `feat: 納品先別販売単価 管理画面の基本操作（登録・編集・適用終了・削除） (#547)`

### Step 2: 改訂ウィザード
- 対象ファイル:
  - `ReviseForm.tsx`（新規写像・改定日＋新単価のみ、periodId 送らない。方向ラベル表示）
  - `actions.ts` / `schema.ts`（revise action + `revisePeriodSchema` 追記）
- `reviseDeliveryLocationSellingPricePeriodCommandFactory` に接続（合成＝適用終了+新期間は BE 単一コマンドがアトミック実行、FE では合成しない）。`PeriodDetailPanel` の `PanelMode` に `revise` 配線。
- コミット: `feat: 納品先別販売単価 改訂ウィザード (#547)`

### Step 3-1: `computeTimelineLayout` の複数従レーン一般化（TDD）
- 対象ファイル: `src/app/(features)/_shared/timeline-layout.ts` / `timeline-layout.test.ts`、および写像元 `customer-selling-prices/.../PriceTimeline.tsx`（`secondaryBars[0]` 読み替え）
- Red: 「主＋従レーン**複数**の和集合から軸範囲を決め、各従レーンを同一軸に載せる」テストを先に書く。
- Green: `secondaryLanes: TimelinePeriod[][]` へ一般化、`secondaryBars: TimelineBar[][]` を返す（採用A）。
- Refactor: 既存の単レーン（共通・原価）・得意先別（従1本→`[commonPeriods]`）呼び出しのテストが全て GREEN であることを確認。
- コミット: `feat: タイムライン帯レイアウトを複数従レーンに一般化 (#547)`

### Step 3-2: タイムライン（納品先別＋得意先別＋共通の3レーン）
- 対象ファイル: 当該 `PriceTimeline.tsx`（3レーン化）／`page.tsx`・`PeriodDetailPanel.tsx`（得意先別・共通 DTO の取得・受け渡し）
- `page.tsx`: 共通を初回 `Promise.all` で並行取得、detail の `customerCode` で `customerSellingPriceEditQueryFactory().find()` を追加取得。両従レーンを `PeriodDetailPanel` 経由で `PriceTimeline` に渡す。
- `PriceTimeline.tsx`: 主=納品先別、従1=得意先別、従2=共通の3レーン描画（従は淡色・破線・表示専用）。上書きなしでも描画。凡例に得意先別・共通のフォールバック表示を追記。
- コミット: `feat: 納品先別販売単価 タイムライン（得意先別・共通レーン並記） (#547)`

## 検証

- `pnpm test` — `timeline-layout.test.ts`（複数従レーン一般化の red-green＋既存レーン回帰 GREEN）。
- `pnpm lint` / `pnpm build` — 型チェック（写像元 #507 の `secondaryBars[0]` 修正含む全体ビルド）。
- 実機確認（verify-frontend / playwright MCP・要ログイン）: 一覧 #548 から行クリック遷移 → 管理画面表示 → 登録/編集/適用終了/削除/改訂の一連、上書きなし状態の文言、タイムライン3レーン（納品先別・得意先別・共通）の対比表示、戻りリンクが選択済み一覧に戻ること。
- E2E テストは別イシュー（納品先別 E2E があれば別途）。本イシューにコンポーネントテスト/E2E は新設しない。
