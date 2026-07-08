# Issue #574: 見積申請詳細画面 表示（FE） — 実装計画

## 概要

見積申請詳細画面（`/estimate-applications/[estimateNumber]/[variationNumber]`）の**表示部分**を実装する。承認・差戻・取下の操作系は後続 issue とし、本 issue は表示のみに閉じる。

BE の参照クエリ（#573・`GetEstimateApplicationDetailQuery`）が既に完成しており、本画面はその読み取り DTO（`EstimateApplicationDetailDTO`）を **直 type-import で消費するだけ**の薄い RSC 構成になる（ADR-0069）。DTO は判別ユニオン（`APPLICATIONS` / `EXEMPTED`）で分岐を畳み込み済みで、FE 側に新しい型・新しい用語は生まれない。

表示ブロック（概要設計 §3.1）:
1. バリエーション要約ヘッダ（見積詳細へのリンク・申請状態バッジ）
2. 最新申請の承認チェーン
3. 過去の申請履歴（承認チェーン込み）
4. 免除バリエーションの場合は免除記録

TDD で進める（`/tdd`）。表示ロジックのうち純粋関数（`code→tone` 写像）は単体テスト先行、画面全体の配線は E2E で担保する（導出の全網羅は BE 単体テストに委ねる・ADR-0012）。

## 設計判断

### クエリ呼び出しと `operatorEmployeeId` の供給
- `execute` は表示スコープ外の `operations` 合成のために `operatorEmployeeId: string`（非 null）を必須とする
- 判断: `page.tsx`（RSC）で `session.user.employeeId` を渡す。`null` は「このシステムに存在しない前提」として `throw`（fail-fast、error 境界へ）
- `operations`（承認可否）は本 issue では**描画しない**（操作 UI は後続 issue）
- 理由: 既存 `resolveApplicationContext`（Server Action 側）と同じ「employeeId null は操作不可」の思想を RSC に踏襲。BE クエリを operator optional に変える案は、表示 issue のスコープを BE に広げるため不採用

### NotFound の扱い
- 判断: クエリが `null`（見積番号なし／バリエーション番号なし／申請も免除も無い）なら `notFound()`
- 理由: 既存 `estimates/[estimateNumber]/page.tsx` と同一パターン

### コンポーネント分割（全て RSC）
- 判断: `page.tsx` で取得・notFound・`kind` 分岐。presentational は `ApplicationDetailSummary` / `ApplicationCard` / `ApprovalStepList` / `ExemptionRecord`
- `ApplicationCard` は `latest` と `past[]` の各要素で**共用**（BE が両者を同型 `ApplicationView` にした意図に従う）
- 理由: 操作 UI が無いため client 化の必然が無く、全 RSC にしておけば後続の操作 issue が「操作 UI だけを client island として足す」形で拡張できる

### 状態バッジ（3種の状態を別扱い）
- 画面に出る状態は3種: バリエーション申請状態（6値・要約ヘッダ）／申請状態（4値・申請カード）／承認ステップ状態（4値・チェーン各段）
- 判断: 共通 tone 層（既存 `shared/variationApplicationStateBadge` の tone 語彙＋`tone→className`）を再利用し、`code→tone` 写像だけを状態 VO ごとに専用関数として持つ
  - `VariationApplicationState` = 既存 `badgeToneOf` を流用
  - `ApplicationStatus` / `ApprovalStepStatus` = 本画面 `_components` に新規（`never` ガードで網羅強制）
- 理由: 3状態は別概念なので写像も別関数（VO に値が増えたら該当 switch だけ型エラー）。一方「緑=承認済」の色語彙は3重定義を避け tone 層で単一ソース化。新規2つは本画面専用のため shared へ昇格しない（labels.ts と同じ「機能固有は昇格しない」方針）

### 承認ステップの表示形式
- 判断: **テーブル6列**（順序 / 役割 / 状態バッジ / 承認者・差戻者 / 発生日時 / 差戻コメント）
- 理由: `ApprovalStepView` の JSDoc が「均一テーブル UI に合わせ承認者/差戻者を `actorName` に畳み込み」と明記。DTO がテーブル前提で flat 化されている。ステッパーは畳み込みと齟齬。進行感は状態バッジの色で補える

### 過去申請履歴の見せ方
- 判断: 折りたたみ無し・attempt 降順（DTO が既にソート済み）で全件展開・`past` 空なら履歴ブロックごと非表示
- 理由: §3.2 が「折りたたみ等の UI 詳細は後続 issue で決める」と明示委譲。折りたたみは client 状態を要し全 RSC 構成を崩す

### 免除ブロックのレイアウト
- 判断: 3行定義リスト（理由 label / 実施者 / 日時）。理由はテキスト（状態バッジは付けない）
- 理由: 承認チェーンが無い枝で定義リストが情報形状に合う。免除の状態表現は要約ヘッダの「承認不要」バッジに一本化（同一の免除事実に表示を割らない・CONTEXT.md「承認免除」）

### 整形ヘルパの配置
- 判断: `formatDateTime` / `formatYen` / `SUBMISSION_TYPE_LABELS` を一覧・詳細で共有できる位置へ寄せる
- 理由: 現在 `estimate-applications/_components/labels.ts` にあり、詳細でも使うため共有化

### E2E とシード
- 判断: 詳細画面用にリッチフィクスチャ `N9905015`（attempt2 多段チェーン＝課長承認済→部長承認待ち／attempt1 差戻コメント付き）を `seed-estimate-applications.ts` に追加
- 理由: 既存シードは全て attempt1・単段チェーンで `past` が常に空。§3.2 が置く画面主目的（過去履歴・差戻コメントの参照）を E2E で検証できないため。リッチ1件で最新チェーンの複数ステップ状態・過去履歴ブロック・差戻コメント・actorName を一度に配線検証できる

### ドキュメント更新
- CONTEXT.md / ADR: **新規更新なし**（新用語なし・配色確定は ADR-0069 が FE issue へ委譲済み・operator 必須のねじれは ADR-20260707-ae2 が説明済み・残りは可逆でトレードオフ小）

## ステップ

### Step 1: 状態バッジの `code→tone` 写像（TDD・純粋関数）
- 対象ファイル:
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/_components/applicationStatusBadge.ts`（新規）
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/_components/approvalStepStatusBadge.ts`（新規）
  - 各 `.test.ts`
- 作業内容:
  - Red: `ApplicationStatus`（PENDING/APPROVED/REJECTED/WITHDRAWN）・`ApprovalStepStatus`（NOT_STARTED/AWAITING/APPROVED/REJECTED）の全 code → tone 期待をテスト化
  - Green: 既存 `variationApplicationStateBadge` の `tone`/`tone→className` を import 再利用しつつ、`code→tone` を `never` ガード網羅 switch で実装
  - Refactor: tone 語彙・className の重複が出れば shared 側の再利用に寄せる
- コミットメッセージ: `feat: 見積申請詳細 状態バッジの code→tone 写像（申請状態・承認ステップ状態）`

### Step 2: 整形ヘルパの共有化
- 対象ファイル:
  - `estimate-applications/_components/labels.ts`（移動元）
  - 共有位置（`estimate-applications/_lib/labels.ts` 等・詳細と一覧の共通親）
  - 一覧 `columns.tsx` の import 追随
- 作業内容:
  - `formatDateTime` / `formatYen` / `SUBMISSION_TYPE_LABELS` を共有位置へ移設
  - 一覧側の import を更新し、既存 E2E がグリーンのままを確認
- コミットメッセージ: `refactor: 見積申請の整形ヘルパを一覧・詳細で共有化`

### Step 3: presentational コンポーネント（RSC）
- 対象ファイル（`[estimateNumber]/[variationNumber]/_components/` 配下）:
  - `ApplicationDetailSummary.tsx`（要約ヘッダ・見積詳細リンク・申請状態バッジ）
  - `ApprovalStepList.tsx`（テーブル6列）
  - `ApplicationCard.tsx`（`ApplicationView` を承認チェーン込みで・latest/past 共用）
  - `ExemptionRecord.tsx`（3行定義リスト）
- 作業内容:
  - DTO の各 View 型を直 type-import して各ブロックを描画（ミラー型を作らない）
  - null フィールド（`actorName`/`decidedAt`/`rejectionComment` 等）は空表示
- コミットメッセージ: `feat: 見積申請詳細の表示コンポーネント（要約・承認チェーン・免除記録）`

### Step 4: page.tsx（RSC・データ取得と分岐）
- 対象ファイル:
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/page.tsx`（新規）
- 作業内容:
  - `params` の `variationNumber` を数値パース、`verifySession()` + `employeeId` null ガード（throw）
  - `getEstimateApplicationDetailQueryFactory().execute(...)` 実行、`null` は `notFound()`
  - `summary` は常に `ApplicationDetailSummary` へ。`kind` で APPLICATIONS（latest + past）/ EXEMPTED（exemption）を出し分け
  - 過去履歴は attempt 降順で全件展開・`past` 空なら履歴ブロック非表示
- コミットメッセージ: `feat: 見積申請詳細画面のページ（取得・notFound・kind 分岐）`

### Step 5: E2E 用リッチフィクスチャの追加
- 対象ファイル:
  - `prisma/seed-estimate-applications.ts`
- 作業内容:
  - `N9905015`: attempt1 = 差戻（REJECTED・差戻コメント付き）、attempt2 = 多段チェーン（課長承認済→部長承認待ち）を追加
  - 既知従業員（承認者/差戻者/申請者）で actorName を弁別可能にする
- コミットメッセージ: `test: 見積申請詳細 E2E 用のリッチフィクスチャ（差戻→再申請＋多段チェーン）を追加`

### Step 6: E2E（4シナリオ）
- 対象ファイル:
  - `src/app/(features)/estimate-applications/[estimateNumber]/[variationNumber]/estimate-application-detail.e2e.ts`（新規）
- 作業内容:
  - ① APPLICATIONS（`N9905015`）: 要約ヘッダ・見積詳細リンク href・最新チェーンのステップ状態・過去履歴の差戻コメント
  - ② EXEMPTED（`N9905013`）: 免除記録（理由/実施者/日時）＋要約ヘッダ「承認不要」バッジ
  - ③ NotFound: 申請も免除も無いバリエーション（または存在しない自然キー）→ 404
  - ④ 一覧→詳細: 一覧行の見積番号リンクを実クリックして詳細へ着地
  - read-only のため非 serial
- コミットメッセージ: `test: 見積申請詳細画面の表示 E2E（APPLICATIONS/EXEMPTED/NotFound/一覧遷移）`
