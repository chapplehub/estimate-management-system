# Issue #345: 見積一覧画面（フロントエンド）を実装する — 実装計画

## 概要

`/estimates` 見積一覧画面（presentation）を実装する。商品一覧（`products/page.tsx`）のパターンを写経し、`searchEstimatesQueryFactory()`（#344）と #354 で実装済みの検索フィルタ（`EstimateSearchCriteria` 4項目）を利用する。

本 issue は presentation 中心だが、一覧に「納品先」列を出すため `EstimateSummaryDTO` に `deliveryLocationName` を additive 拡張する小さな BE 作業（Q1-b）を含む。「#345＝純フロント」の前提は破棄する。

依存関係:
- #344（CLOSED）: `EstimateSummaryDTO` / `searchEstimatesQueryFactory()` を提供済み。
- #354（マージ＆rebase 取り込み済み・commit ff74a48）: `EstimateSearchCriteria` を実フィルタ4項目（`estimateNumber`/`customerName` 部分一致・`estimateType`/`activeStatus` 等値/some-none）へ拡張済み。
- #351（予定）: 見積作成画面 `/estimates/new`。本 issue では新規登録ボタンのリンク先として参照のみ（現状 dead link）。
- #348（別 issue）: `displayStatus`（表示ステータス）列。本 issue では出さない。

スコープ外: 検索フィルタの BE 実装（#354 で完了済み）、作成画面（#351）、表示ステータス列（#348）、列ヘッダのクリックソート。

## 設計判断

### Q1: 表示列セット（8列・左→右）
- 見積番号(Link)／区分(Badge)／得意先／納品先／作成者／締切(formatDate)／金額(formatYen)／有効・無効(Badge)
- 列順は得意先 → 納品先 → 作成者（得意先と納品先を隣接）
- 見積日（estimateDate）・得意先コード（customerCode）は出さない
- 理由: 一覧で必要な識別・判断に足る最小列。コード類は一覧では冗長。

### Q1-b: 納品先のスコープと DTO 拡張
- A. この PR で BE も拡張する（採用）
- B. 純フロントに留め納品先を出さない
- 採用理由: 一覧に納品先名を出すため。表示は名前のみ。
- DTO に足すフィールド: `deliveryLocationName` のみ（`deliveryLocationCode` は足さない）
  - 理由: Q1 で得意先コードを出さない方針と一貫。表示しない値を凍結契約に増やさない（YAGNI）。既存 customerCode/creatorCode が code を持つのは別文脈の名残で、機械的に揃える必要はない。
- 名前解決は ADR-0013 の既存パターン（リレーション越しの名前解決）に従う。

### Q2: 「状態」列の意味と見出し
- 列見出しは曖昧語「状態」を避け「有効/無効」とする
- 理由: CONTEXT.md は「状態」を表示ステータス／バリエーション状態の両義で `_Avoid_`。本 issue で非 null に出せるのは `activeStatus`（代表の有効/無効）のみ。
- `displayStatus`（表示ステータス）列は今回出さない（#348。依存 #275 共通申請テーブル・受注実装が未着手のため常に null）。

### Q3: SearchForm を出すか
- 検索を出す（4項目）。初期はデフォルト絞り込み無し（全件表示）。
- フィールド: text `estimateNumber`（部分一致）／ text `customerName`（部分一致）／ select `estimateType`（新規/修理/事後）／ select `activeStatus`（有効/無効）
- 理由: #354 で BE フィルタ4項目が実装済み。商品 page.tsx と完全対称に組める。初期に activeStatus を「有効のみ」にしない理由は ADR-0051 の「一覧で全無効見積を識別できる」意義と商品一覧の初期フィルタ無し挙動に合わせるため。
- 空文字は criteria に渡さない（`getStringParam` が undefined 化、`buildWhereClause` が未指定スキップ）。

### Q4: page から渡す orderBy
- A. orderBy を渡さず BE 既定 `[deadline asc, createdAt asc, estimateNumber asc]`（締切昇順）に委ねる（採用）
- B. estimateNumber 昇順を明示指定
- C. 新着順（estimateDate/createdAt desc）を明示指定
- 採用理由: `DataTable` はクリックソート無し（`getSortedRowModel` 不在）＝サーバが返す順で固定。締切列を出すので締切昇順は自己説明的かつ業務優先軸（締切が近い順）。第2・3キーで決定的（E2E 安定）。最小コード。

### Q5: 新規登録ボタン ＋ ダッシュボード導線
- (A) 新規登録ボタンを置く。`href="/estimates/new"`（#351 予定・現状 dead link だが開発中ゆえ可）
  - 表示条件: `isAdmin` ゲート無し＝認証済みユーザー全員に表示
  - 理由: 見積はトランザクションデータで担当者の日常業務。マスタ系の `isAdmin` ゲートを機械適用しない。#351 の認可確定時に再調整。
- (B) ダッシュボード `navigationItems` の先頭に「見積管理」(`/estimates`・説明「見積の一覧表示・閲覧を行います。」) を追加
  - 理由: 共通ヘッダに機能ナビが無く、ダッシュボードが唯一の入口。追加しないと一覧が到達不能。

### Q6: 代表が INACTIVE（全無効見積）の行の見た目
- 行のグレーアウトはしない。有効/無効バッジのみで識別（商品一覧と同一）
- 理由: ADR-0051 の「全無効見積を識別できる」要件はバッジで達成済み。二重符号化のノイズ回避。全無効でも見積番号リンクから詳細は開けるため、行を暗くするのは実挙動と矛盾し誤読を招く。

### Q7: E2E `estimates-list.e2e.ts` の範囲
- 商品 E2E を写経（一覧表示／検索4種／クリア）＋見積固有を追加
- 見積固有: (1) 新規登録ボタンは admin・一般ユーザー両方で可視（商品の「一般には見えない」を反転＝Q5 の回帰防止）、(2) 代表選択（ADR-0051）の end-to-end 検証（`N9905001` は V1=ACTIVE 代表→有効＋金額、`N9905002` は全 INACTIVE→無効、`activeStatus` フィルタで出し分け）、(3) 納品先列の表示
- read-only のため `serial` 不要（商品 list と同じ非直列）。テスト内で Prisma 直接利用しない（ADR-0012）。

### ドキュメント方針
- CONTEXT.md: 追記不要（`代表バリエーション`/`バリエーション状態`/`表示ステータス` は定義済みで、本決定はその用語法を遵守）。
- ADR: 新規不要（納品先追加は ADR-0013 既存パターン、代表選択は ADR-0051、displayStatus は #348。不可逆性・驚き・真のトレードオフの3条件を満たさない）。
- deviations.md: Q1-b（純フロント前提を破棄し BE 契約を additive 拡張）を実装完了時に記録。

## ステップ

### Step 1: 一覧 read model に納品先名を追加（Q1-b）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/dto/EstimateSummaryDTO.ts`
  - `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts`
  - `src/server/subdomains/estimate/application/queries/__tests__/SearchEstimatesQuery.test.ts`
- 作業内容:
  - `EstimateSummaryDTO` に `deliveryLocationName: string` を追加（name のみ・code は足さない）
  - `ESTIMATE_SUMMARY_INCLUDE` に `deliveryLocation: { select: { name: true } }` を追加
  - `toSummaryDTO` で `e.deliveryLocation.name` を解決（ADR-0013）
  - 単体テストに納品先名解決のアサーションを追加
- コミットメッセージ: `feat: 見積一覧 read model に納品先名を追加する`
  - body: 凍結契約 `EstimateSummaryDTO` を additive 拡張。表示は名前のみのため code は足さない（Q1 の得意先コード非表示方針と一貫・YAGNI）。名前解決は ADR-0013 の既存パターン。

### Step 2: 見積一覧の列定義
- 対象ファイル: `src/app/(features)/estimates/_components/columns.tsx`（新規）
- 作業内容:
  - `EstimateRow` 型と8列の `ColumnDef` を定義（商品 columns.tsx を写経）
  - 見積番号は `/estimates/[estimateNumber]` への青リンク、区分は Badge＋`ESTIMATE_TYPE_LABELS`、有効/無効は Badge（default/secondary）、締切は `formatDate`、金額は `formatYen`
  - ラベル/整形は `estimates/_shared/labels.ts` を再利用
- コミットメッセージ: `feat: 見積一覧の列定義（8列）を実装する`

### Step 3: 見積一覧ページ
- 対象ファイル: `src/app/(features)/estimates/page.tsx`（新規）
- 作業内容:
  - `verifySession()` で認証、`searchParams` から `getStringParam` ×4 で `EstimateSearchCriteria` を組み立て（空文字は渡さない）
  - `searchEstimatesQueryFactory().execute(criteria, { limit: LIST_FETCH_LIMIT })`（orderBy は渡さず BE 既定）
  - `SearchForm`（4フィールド・初期デフォルト絞り込み無し）＋ `DataTable`
  - 新規登録ボタン（`/estimates/new`・`isAdmin` ゲート無しで全員表示）
- コミットメッセージ: `feat: 見積一覧ページ（検索・一覧・新規登録導線）を実装する`
  - body: 新規登録ボタンは isAdmin ゲートを付けず全員表示。理由: 見積はトランザクションデータで担当者の日常業務のため（#351 の認可確定時に再調整）。orderBy は渡さず BE 既定（締切昇順）に委ねる（DataTable はクリックソート無し）。

### Step 4: ダッシュボードに見積管理導線を追加
- 対象ファイル: `src/app/(features)/dashboard/page.tsx`
- 作業内容:
  - `navigationItems` の先頭に `{ href: "/estimates", title: "見積管理", description: "見積の一覧表示・閲覧を行います。" }` を追加
- コミットメッセージ: `feat: ダッシュボードに見積管理導線を追加する`

### Step 5: 見積一覧 E2E テスト
- 対象ファイル: `src/app/(features)/estimates/estimates-list.e2e.ts`（新規）
- 作業内容:
  - 商品 E2E を写経（一覧表示／検索4種＝見積番号・得意先名・区分・有効無効／クリア）
  - 見積固有: 新規登録ボタンが admin・一般ユーザー両方で可視／代表選択 ADR-0051 検証（`N9905001`→有効＋金額、`N9905002`→無効、activeStatus フィルタで出し分け）／納品先列の表示
  - 非直列（read-only）。Prisma 直接利用しない（ADR-0012）。シードは `prisma/seed-estimates.ts`（`N9905001`〜`004`/`R9905001`）に対しアサーション。実値（金額・納品先名）は実装時にシードで確認。
- コミットメッセージ: `test: 見積一覧画面の E2E テストを追加する`

### Step 6: 逸脱記録（deviations.md）
- 対象ファイル: `docs/claude-plans/issue-345/deviations.md`（新規）
- 作業内容:
  - Q1-b（「#345＝純フロント」前提を破棄し `EstimateSummaryDTO` を additive 拡張した）の{元の計画}/{実際の実装}/{逸脱理由}を記録
- コミットメッセージ: `docs: 見積一覧実装の計画逸脱（DTO 契約拡張）を記録する`
