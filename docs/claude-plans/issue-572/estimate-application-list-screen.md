# Issue #572: 見積申請一覧画面（FE） — 実装計画

## 概要

全社台帳としての「見積申請一覧」画面（`/estimate-applications`）を RSC で実装する。行はバリエーション単位（申請または承認免除の記録を持つバリエーション＝バリエーション申請状態が NONE 以外）。既存一覧パターン（`SearchForm` + `DataTable`）を踏襲し、承認者ワークリストと申請者追跡の両用途を検索条件で兼ねる（専用画面は分けない）。

BE の検索クエリ `SearchEstimateApplicationsQuery`（#571/#577）と DTO `EstimateApplicationSummaryDTO` は実装済み。FE はこの DTO を直 type-import で消費する（ADR-0069）。本 Issue のスコープは一覧画面のみ（詳細画面 #574、承認操作系は別 Issue）。

`/tdd`（red-green-refactor）で実装する。純関数（URL パラメータ変換・日付境界構築・バッジ tone 写像）と共有部品拡張を先にユニットテストで固定し、最後に E2E で FE 配線を担保する。

## 設計判断

### 検索フォームの実装方式
- A. 共有 `SearchForm` を加法的に拡張（`multiselect`/`date`/`checkbox` を `SearchFieldDef` 判別ユニオンに追加）
- B. この画面専用のベスポークフォーム
- **採用: A**。Issue が「既存一覧画面パターン踏襲」を明言し、記憶 `feedback_unify_create_with_edit_screen`（共有部品で統一・出荷済みコード差し替えも許容）と整合。判別ユニオンは加法拡張向きで既存 text/select 利用（12画面）は非破壊。内部状態モデル（`Record<string,string>`）を配列対応に広げる必要があるのは `multiselect` の1点のみ（`date`/`checkbox` は "1キー=1文字列" のまま足せる）。

### 申請状態（5値）の複数選択UI
- A. ネイティブ チェックボックス群（状態ごとに5個）
- B. `<select multiple>`
- C. チップ/タグ式ドロップダウン（カスタム部品）
- **採用: A**。複数状態の同時絞り込みに素直、SearchForm のネイティブ input 流儀と一致、新規依存ゼロ。URL は繰り返しパラメータ `?state=PENDING&state=APPROVED`（Next.js が `string[]` で受ける→ `getArrayParam` を新設）。

### 詳細画面リンク先
- A. 既存 `/estimates/{estimateNumber}`（見積単位・無改修）に相乗り
- B. 専用ネストルート `/estimate-applications/{estimateNumber}/{variationNumber}`（#574・未実装）
- **採用: B**。行がバリエーション単位である事実と語彙的に一貫し、既存見積詳細集約・ページに一切手を入れない。#574 実装までデッドリンクだが本 Issue で配線する（DTO に `estimateNumber`/`variationNumber` があり配線可能）。

### 申請日レンジの暦日→instant 変換
- 判断不要（BE 契約からの帰結）。BE の `appliedTo` は「この日時以前（≤・inclusive）」ゆえ、to日 の **JST 当日終端 `23:59:59.999+09:00` を inclusive 上限**として構築する（半開区間ではなく BE の `≤` に合わせる）。from は既存 `fromDateInputValue`（JST 0時 inclusive）。当日終端 fn を新設。

### 矛盾組合せ（状態 vs 承認待ち役割）の扱い
- A. ガードしない（AND 空振りを正しい結果として許容）
- B. 役割 select を状態連動で非活性化
- **採用: A**（ADR-20260707-b36 が「防止は FE の関心」と punt した点）。空振りは正しい結果でユーザーに誤解を与えず、共有 SearchForm にフィールド間依存という新概念を持ち込まない。親切さは後付け可能。

### 共有ヘルパーの配置
- A. app 直下へ昇格（日付→`_lib/date.ts`、バッジ tone→`_components/shared/`）＋ estimates 詳細側 import 張り替え
- B. estimates 配下から横断 import
- **採用: A**。消費者が2画面になった今こそ単一ソース化の適期。ADR-0069（code→tone/label 単一ソース）・記憶 `feedback_unify_create_with_edit_screen` に整合。当日終端 fn も `_lib/date.ts` に同居し分裂しない。

### E2E テストデータの粒度
- A. 代表フィクスチャ（FE 配線の検証に集中）
- B. 全5状態＋INACTIVE フルマトリクス
- **採用: A**。5値状態の導出網羅は単体（`SearchEstimateApplicationsQuery.test.ts`）で既済で、E2E の役割は画面観測範囲＝FE 配線の担保（ADR-0012）。機構は Factory+Mapper+seed client（記憶 `seed-uses-own-prisma-client`・repository も UI も使えない）、`appliedAt` は today 相対（ADR 20260629-3x5）。代表数状態（PENDING＋EXEMPTED＋APPROVED または WITHDRAWN）＋INACTIVE1件。

### ページネーション
- 判断不要。`DataTable` のクライアント側ページング（`LIST_PAGE_SIZE=100`／サーバ `LIST_FETCH_LIMIT=1000`）を既存踏襲。

### ADR / CONTEXT.md
- **ADR 起票なし**：上記 A/B は実トレードオフだが、いずれも既存パターン・ADR-0069/0012・記憶方針の素直な適用で「文脈なしに驚く」決定ではない（起票3条件を満たさない）。※最終判断はユーザー。
- **CONTEXT.md 更新なし**：新用語は出ず、既存語彙（最新申請・承認待ち役割・バリエーション申請状態）を一貫使用。

## ステップ

### Step 1: 共有ヘルパーの app 直下昇格
- 対象ファイル:
  - `src/app/_lib/date.ts`（新設・`estimates/_shared/date.ts` から `fromDateInputValue`/`toDateInputValue` を移設）
  - `src/app/_components/shared/variationApplicationStateBadge.ts`（`estimates/[estimateNumber]/` から移設）
  - estimates 詳細側の import 張り替え（`page.tsx`・`VariationPanel.tsx`・関連テスト）
- 作業内容:
  - 既存の日付・バッジヘルパーを app 直下の共有場所へ移動し、estimates 側の import を張り替える（挙動は不変。既存テストが green のままであることで担保）
- コミットメッセージ: `refactor: 日付・申請状態バッジヘルパーを app 直下の共有場所へ昇格`

### Step 2: URL パラメータ・日付境界の純関数（TDD）
- 対象ファイル:
  - `src/app/_lib/searchParams.ts`（`getArrayParam` を追加）
  - `src/app/_lib/date.ts`（当日終端 instant fn を追加）
  - 各 `*.test.ts`
- 作業内容:
  - red: 繰り返しパラメータ→`string[]` 変換、暦日文字列→JST 当日終端 inclusive instant のテストを先に書く
  - green: `getArrayParam`・当日終端 fn を実装
  - refactor: 既存 `getStringParam`/`fromDateInputValue` との一貫性を整える
- コミットメッセージ: `feat: 一覧検索の配列パラメータ取得とJST当日終端境界の純関数を追加`

### Step 3: 共有 SearchForm の加法拡張（TDD）
- 対象ファイル:
  - `src/app/_components/shared/SearchForm.tsx`（`multiselect`/`date`/`checkbox` フィールド型追加・内部状態を配列対応へ）
  - `src/app/_components/shared/SearchForm.test.tsx`
- 作業内容:
  - red: 新フィールド型のレンダリング・値変更・URL 直列化（multiselect＝繰り返しパラメータ、checkbox＝真偽、date＝文字列）と、既存 text/select が非破壊であることのテスト
  - green: 判別ユニオンに3型を追加し、`handleSearch` の直列化・`handleClear` を配列対応に拡張
  - refactor: フィールド型別レンダリングの重複整理
- コミットメッセージ: `feat: 共有SearchFormにmultiselect/date/checkboxフィールド型を追加`

### Step 4: 一覧ページ本体（RSC）とカラム定義
- 対象ファイル:
  - `src/app/(features)/estimate-applications/page.tsx`（新設）
  - `src/app/(features)/estimate-applications/_components/columns.tsx`（新設・10列＋状態バッジセル＋行リンク）
- 作業内容:
  - `verifySession`→ searchParams から criteria を構築（不変事実＝文字列、state＝`getArrayParam`、appliedFrom/To＝日付境界変換、includeInactive＝checkbox）
  - `searchEstimateApplicationsQueryFactory()` と `getAllRolesQueryFactory()`（承認待ち役割 options）を並列解決
  - 10列を `columns.tsx` に定義。バッジは `badgeToneOf`＋`badgeToneClassName` 再利用。行リンクは `/estimate-applications/{estimateNumber}/{variationNumber}`
  - `SearchForm` に本画面の `searchFields`（text×4／multiselect状態／date×2／select役割／checkbox無効含む）と `defaultValues` を渡す
  - `DataTable` に `columns`/`rows`/`emptyMessage` を渡す（既存踏襲）
- コミットメッセージ: `feat: 見積申請一覧画面（/estimate-applications）を実装`

### Step 5: ナビ導線追加
- 対象ファイル: `src/app/(features)/dashboard/page.tsx`
- 作業内容: `navigationItems` に `{ href: "/estimate-applications", title: "見積申請一覧", description: "見積申請の全社横断での参照・検索を行います。" }` を見積管理の直後へ追加
- コミットメッセージ: `feat: ダッシュボードに見積申請一覧への導線を追加`

### Step 6: E2E 用シード（代表フィクスチャ）
- 対象ファイル:
  - `prisma/seed-estimates.ts`（または申請シード用の新設ファイル）
  - `EstimateApplicationFactory`/`EstimateApprovalExemptionMapper` 等の Factory+Mapper 経由で seed client へ永続化
- 作業内容:
  - 代表状態を持つバリエーションを today 相対 `appliedAt` で作り込む：PENDING（承認待ち役割既知）／EXEMPTED（免除者=申請者列）／APPROVED または WITHDRAWN、＋ INACTIVE1件
  - 得意先名・申請者名を弁別可能に、申請日を数日ずらしてレンジ検証に耐える形にする
- コミットメッセージ: `test: 見積申請一覧E2E用の代表フィクスチャをシードに追加`

### Step 7: E2E テスト（FE 配線）
- 対象ファイル: `src/app/(features)/estimate-applications/estimate-applications-list.e2e.ts`（新設）
- 作業内容:
  - 一覧表示（10列・既定ソート・状態バッジ）を観測
  - 検索：見積番号/得意先/納品先/申請者の部分一致、状態チェックボックスの弁別、承認待ち役割 select、申請日レンジ、無効含むトグル
  - 行リンク先が `/estimate-applications/{estimateNumber}/{variationNumber}` であること（デッドリンクでも href を検証）
  - 5値マトリクスの網羅は単体に委ね、ここでは画面配線の担保に集中（ADR-0012）
  - 実行は変更関連スペックのみ（記憶 `feedback_no_full_e2e_locally`）
- コミットメッセージ: `test: 見積申請一覧の表示・検索E2Eを追加`
