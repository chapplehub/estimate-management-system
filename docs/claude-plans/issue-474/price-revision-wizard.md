# Issue #474: 共通売単価 保守画面の単価改定（ガイド付き）— 実装計画

## 概要

共通売単価 保守画面（#429・#473で実BE接続済み）に、現在有効な単価をある日（改定日）から新単価へ切り替える**ガイド付き単価改定**を追加する。改定は新操作ではなく、既存の原子操作「現在有効行の適用終了（終了日＝改定日）」＋「改定日開始の新規期間追加」を1フォームに束ねた**合成糖衣**。アプリ層の単一コマンドが1ロードした集約に両操作を順適用し1セーブすることで、単一集約 version によりアトミック性（部分適用なし）を担保する。

プロトタイプの迂回バグ（`saveRevise` が改定日を「今日」でなく「現行行の開始日」と比較し、過去日改定＝既発行見積の時点解決値の遡及改竄を許していた）は、本物の温度ガードを持つ原子操作（`endDatePeriod`＝終了日>今日／`addPeriod`＝開始≥今日）を合成することで構造的に閉じる。

正準語は **改定（単価改定）**。`改訂`（訂）は得意先改訂専用の予約語のため使わない（CONTEXT.md に `単価改定` 項を追加済み）。

## 設計判断

### 合成（アトミック性・version）の置き場所
- A. UI層で2 Server Action逐次（不採用）— ロード/セーブ2回でversionが2度上がり2回目が必ず ConflictError、適用終了だけ成功で空白期間が残る部分適用リスク。Issue が指摘した迂回バグの構造。
- B. アプリ層の単一コマンド `ReviseCommonSellingPricePeriodCommand`（採用）— 1ロード→`endDatePeriod`→`addPeriod`→1セーブ。version突合・bumpは1回でアトミック。新ドメインメソッドを追加せず「改定は新操作ではない」方針に一致。
- C. 集約に新ドメインメソッド `revise()`（不採用）— 「新操作ではない」方針と矛盾し不変条件ロジックを重複。
- 推奨: B。1トランザクション＝単一versionでアトミック性とversion整合が同時に解ける。
- 補足: 1コマンドで集約ミューテータを複数回呼ぶのはこのリポジトリの定石（`UpdateEstimateCommand` 8回・`AdjustRevisedVariationCommand` 3回等）であり surprising でないため**ADRは起票しない**。温度ガード継承は既存 ADR-86b（過去不変＋参照日注入）の管掌。

### 現在有効行の特定方法
- A. サーバー側で特定（採用）— 集約に薄いクエリメソッド `currentValidPeriod(referenceDate)` を追加し、`period.contains(referenceDate)` の行を引く。フォームは `{改定日, 新価格, version}` のみ送り periodId を載せない（改竄面を消す・Issue の入力定義に一致）。クエリ追加は mutation でないので「新操作を作らない」方針に反しない。
- B. フォームが periodId を送る（不採用）— 改竄・stale periodId のリスク。
- 推奨: A。

### 改定の前提条件
- 現在有効行（`priceStatus=active`）が存在することを必須とする。
- unset / lapsed の商品ではコマンドが `BusinessRuleViolationError` で拒否し、UI も改定ボタンを非表示（active行にのみ表示）。これらは新規登録系の導線へ誘導。
- 改定日開始の新期間が既存の将来行と重複するケースは `addPeriod` の既存重複不変条件にそのまま委ね、#474では特別扱いせず明示エラーを出す（「将来行がある状態での改定」は別issue送り）。

### 改定日の検証層
- zod = 改定日が実在日・新価格が0以上整数の単項目検証のみ（既存スキーマ＝round2決定6を踏襲）。
- 温度判定（改定日>今日・現在有効行であること）は集約の不変条件が最終判定（`endDatePeriod` の `endDate <= referenceDate` 等）。
- エラーはサブ操作のメッセージをそのまま surface（改定日＝適用終了日＝適用開始日ゆえ文言は技術的に正確）。フォームに「改定日は明日以降」のヘルパーテキストを置く。改定専用のメッセージ変換層は設けない。

### UXスコープ
- ガイド付き単一フォームのみ実装する。
- 手動2ステップのトグル/専用導線は作らない（手動経路は既存の適用終了・新規追加フォームに委ねる。連続実行する導線は非アトミックで危険なため温存しない）。

### UI配置・フォーム部品
- active行の行内ボタン「改定」＋新パネルモード `revise`（`適用終了`の隣。打ち切り vs 切り替えを並置）。
- 専用 `ReviseForm` コンポーネント（`PeriodForm` に revise モードは足さない）。改定固有の現単価表示・方向ラベル・単一日付セマンティクスを独立した最小入力契約で表現するため。

### 補助表示（値上げ/値下げ）
- 新価格−現単価の方向ラベル（値上げ/値下げ/据え置き）を client 側で算出表示（現単価は props で渡す。hidden フィールド・zod交差検証は不要）。
- 据え置き（新価格＝現単価）はフォーム・サーバーいずれでも拒否せず**許容**する。

## ステップ

### Step 1: 集約クエリメソッド `currentValidPeriod` の追加
- 対象ファイル: `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`, `src/server/subdomains/pricing/domain/entities/__tests__/CommonSellingPrice.test.ts`
- 作業内容:
  - `currentValidPeriod(referenceDate: string): CommonSellingPricePeriod | undefined` を追加（`period.contains(referenceDate)` の行を返す。無ければ undefined）。「現在有効」述語をドメインに集約。
  - ユニットテスト: active行を返す／active行が無ければ undefined。
- コミットメッセージ: `feat: 共通売単価集約に現在有効行クエリ currentValidPeriod を追加 (#474)`

### Step 2: 単価改定コマンド `ReviseCommonSellingPricePeriodCommand` の実装
- 対象ファイル: `src/server/subdomains/pricing/application/commands/ReviseCommonSellingPricePeriodCommand.ts`, `.../factories/reviseCommonSellingPricePeriodCommandFactory.ts`, `.../commands/__tests__/ReviseCommonSellingPricePeriodCommand.test.ts`
- 作業内容:
  - 入力 `{ productId, revisionDate, price, referenceDate, expectedVersion }`。`loadCommonSellingPriceOrThrow` → `currentValidPeriod(referenceDate)` で現在有効行を特定（無ければ `BusinessRuleViolationError`）→ `endDatePeriod(id, revisionDate, referenceDate)` → `addPeriod([revisionDate, null), price, referenceDate)` → `update(aggregate, expectedVersion)`。
  - Factory は既存の `endDate...Factory` と同形。
  - コマンド統合テスト（実Prismaリポジトリ・既存コマンドテストと同形）: ①改定成功＝旧行が改定日で終了＋新行が連続（重複なし）＋versionが1回だけbump、②現在有効行なし→`BusinessRuleViolationError`、③改定日≤今日→エラー（サブ操作由来）、④据え置き（同価格）→成功、⑤`expectedVersion`不一致→`ConflictError`、⑥将来行と重複→`BusinessRuleViolationError`。
- コミットメッセージ: `feat: 単価改定コマンド ReviseCommonSellingPricePeriodCommand を実装 (#474)`
  - ボディ: 改定はアプリ層単一コマンドで適用終了＋新規追加を合成。理由: 1ロード/1セーブ＝単一versionでアトミック性を担保し、本物の温度ガードを持つ原子操作の合成でプロトタイプの遡及改竄（迂回）を構造的に閉じるため。

### Step 3: Server Action / zod スキーマの追加
- 対象ファイル: `src/app/(features)/common-selling-prices/[productCd]/actions.ts`, `.../[productCd]/schema.ts`
- 作業内容:
  - `revisePeriodSchema`（`version`＋`revisionDate`＝実在日＋`price`＝0以上整数。periodId は持たない）。
  - `revisePeriodAction(productId, productCode, _prevState, formData)`（`verifyAdmin` → parse → `reviseCommonSellingPricePeriodCommandFactory().execute({..., referenceDate: toJstCalendarDay(new Date())})` → `handleCommandError` catch → 詳細＋一覧 revalidate）。既存4 actions と同形の薄いガワ。
- コミットメッセージ: `feat: 単価改定の Server Action と zod スキーマを追加 (#474)`

### Step 4: `ReviseForm` と詳細パネルへの配線
- 対象ファイル: `src/app/(features)/common-selling-prices/[productCd]/ReviseForm.tsx`（新規）, `.../[productCd]/PeriodDetailPanel.tsx`
- 作業内容:
  - `ReviseForm`: 現単価を読み取り表示、入力は改定日＋新価格、hidden は version。「改定日は明日以降」ヘルパーテキスト。値上げ/値下げ/据え置きの方向ラベルを新価格入力に応じて client 算出表示。成功で `onSuccess`（パネルを閉じる）。
  - `PeriodDetailPanel`: `PanelMode` に `{ kind: "revise"; periodId }` を追加。active行（`auth` 判定）に「改定」ボタンを置き、下部パネルに `ReviseForm` を描画。現単価は active 行の `sellingPrice` を渡す。
- コミットメッセージ: `feat: 単価改定のガイド付きフォームと改定導線を配線 (#474)`

### Step 5: E2E（ガイド付き改定シナリオ）
- 対象ファイル: `src/app/(features)/common-selling-prices/common-selling-prices-crud.e2e.ts`
- 作業内容:
  - 改定ボタン経由のガイド付き改定を新規 serial chain として追加（create-e2e-test 規約・ADR-0012/0017/0020 準拠）。改定実行→旧行が改定日で終了＋改定日開始の新行が連続（重複エラーなし）＋一覧の現在有効単価が新価格に更新、を検証。
  - 既存の手動「改定として新規追加」ステップは手動経路として残す。
- コミットメッセージ: `test: 共通売単価 ガイド付き単価改定の E2E を追加 (#474)`
