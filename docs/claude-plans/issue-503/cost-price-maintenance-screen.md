# Issue #503: 原価 保守画面（詳細・期間CRUD・単価改定・タイムライン） — 実装計画

## 概要

原価の保守画面 `src/app/(features)/cost-prices/[productCd]/` を実装する。詳細表示・期間CRUD・単価改定フォーム・タイムライン表示を含む。共通売単価の保守画面（#473 / #484 / #489 / #490）の同型ミラー。

- 読みモデルは #500 の `costPriceEditQueryFactory()`（`CostPriceEditDTO`）、書き込みは #502 のコマンド5本（Register / Edit / EndDate / Revise / Delete の各 `*CostPricePeriodCommandFactory`）を消費する。BE は完成済みで、本 issue は FE のみ。
- #501 の一覧画面が `/cost-prices/[productCd]` へ先行リンク済み（意図的なデッドリンク）。PR1 でこのリンクが生きる。導線の追加作業は不要。
- **PR は2本**: PR1（period-rules 昇格＋詳細＋期間CRUD）→ PR2（単価改定＋timeline-layout 昇格＋タイムライン）。
- **/tdd で実装する**。テスト対象は純粋ロジック（period-rules / timeline-layout の `_shared` 昇格分）で、各昇格ステップは「テストを先に `_shared` へ移して中立型で書き直す（Red）→ 実装を移動・中立型化（Green）→ import 差し替え（Refactor）」の順で進める。UI コンポーネント・Server Actions の E2E は #504 が担うため本 issue では書かない。

### 用語（CONTEXT.md 準拠）

issue 本文の「改訂ウィザード」という語は使わない。CONTEXT.md「単価改定 (Price Revision)」の _Avoid_ が「改訂」を見積系の予約語として禁止しているため、UI 文言・コミット・PR はすべて「**単価改定**」で統一する（出荷済み `ReviseForm.tsx` と同じ）。コンポーネント名 `ReviseForm` は模倣元を踏襲する。

## 設計判断

### period-rules / timeline-layout の再利用方針（issue 未決事項）
- A. 原価配下へ複製（ADR-20260627-a5c のミラー方針に整合）
- B. `(features)/_shared` へ昇格し、入力を集約 DTO ではなく中立の構造型にジェネリック化。共通売単価側の import も差し替え
- 採用: **B**。a5c の複製規約は DTO **型**の集約間独立性を守るもので、これらは #501 で `formatYen` を昇格させたのと同じ「集約非依存の表示用純関数」に分類される。複製すると型ではなくロジック本体＋テスト約280行の重複になる。#513（得意先別販売単価の保守画面）が3例目として控えており rule of three が先に見えている。出荷済みコードの差し替えは #351 の方針（部品・ロジックの原子で統一）に整合。純関数のため、集約間で操作権限ルールが将来分岐したら、その時点でフォークすれば十分（可逆）。ADR は不要（#501 の判断枠の適用であり、驚きがない）
- 中立型の方向: 共通の親 DTO 型を作るのではなく、`PeriodStatus`（`"future" | "active" | "expired"`）と `{ periodId, start, end, status, price }` 形の構造型を `_shared` 側に定義し、各集約 DTO は structural typing でそのまま渡せるようにする（集約 DTO 同士の結合を生まない）

### 粗利率の可視化（issue 未決事項）
- スコープ外とし **#522 に分離起票済み**。原価と共通販売単価は独立した適用期間を持ち別々に改定されるため、「どの参照日・どの期間の組み合わせで粗利率を出すか」自体が独立した設計議論に値する

### PR の刻み方（issue 未決事項）
- issue は「詳細＋CRUD → 改定 → タイムライン」の3段階を示唆していたが、**PR1: 詳細＋期間CRUD / PR2: 単価改定＋タイムライン の2本**に確定（ユーザー判断）
- 昇格リファクタは「それを最初に消費する PR の先頭コミット」に置く（#501 が formatYen 昇格を同居させた前例に従う。昇格だけの宙に浮いた PR を作らない）

### E2E テストの扱い
- 本 issue には**含めない**。#504（両画面完成後に一覧・詳細・CRUD・単価改定・タイムラインを一括作成、seed-e2e への原価帯追加含む）が担う。E2E は画面横断の導線で書くため後置きが手戻りが少ない（共通売単価 #481 で実証済み）

### actions.ts / schema.ts の形
- 判断不要（共通売単価 `common-selling-prices/[productCd]/actions.ts` の同形ミラー）: `.bind()` による宛先キー（productId / productCode）の改竄防止、価格の10進文字列運搬（ADR-0022）、参照日のサーバー生成（ADR-20260627-86b）、parse → コマンド → `handleCommandError` → `revalidatePath` の薄いガワ
- conform は空文字を undefined 化するため、必須でない string フィールドは `.optional()` にする（既知の落とし穴）

### role 出し分け
- 判断不要（#484 と同型）: page で `verifySession()` → `isAdmin()` を判定し `PeriodDetailPanel` へ渡す。一般ユーザーには編集系ボタン（登録・編集・適用終了・単価改定・削除）を表示しない

## ステップ

### PR1: `feat/issue-503` — 詳細＋期間CRUD

### Step 1: period-rules を (features)/_shared へ昇格（TDD: テスト先行）
- 対象ファイル:
  - `src/app/(features)/_shared/period-rules.test.ts`（先に移動・中立型で書き直し → Red）
  - `src/app/(features)/_shared/period-rules.ts`（実装を移動し `PeriodStatus` 中立型に → Green）
  - `src/app/(features)/common-selling-prices/_data/period-rules.ts` / `period-rules.test.ts`（削除）
  - 共通売単価側の import 差し替え（`PeriodDetailPanel.tsx` ほか参照元）
- 作業内容:
  - `PeriodStatus = "future" | "active" | "expired"` を `_shared` 側に定義し、`authorityFor` の入力型を集約 DTO 依存から切り離す
  - `pnpm test` で既存テストが回帰ガードとして通ることを確認
- コミットメッセージ: `refactor: period-rules を (features)/_shared へ昇格し中立型化`

### Step 2: schema.ts と Server Actions（登録・編集・適用終了・削除）
- 対象ファイル:
  - `src/app/(features)/cost-prices/[productCd]/schema.ts`
  - `src/app/(features)/cost-prices/[productCd]/actions.ts`
- 作業内容:
  - 共通売単価の同名ファイルをミラーし、`register / edit / endDate / delete` の4 Server Actions を実装（単価改定は PR2）
  - コマンドは `registerCostPricePeriodCommandFactory` ほか #502 の factory を使用
  - `.bind()` で productId / productCode を運び、価格は10進文字列、参照日はサーバー生成、`handleCommandError` → `revalidatePath`
- コミットメッセージ: `feat: 原価 保守画面の Server Actions とスキーマ（登録・編集・適用終了・削除）`

### Step 3: 詳細ページと期間CRUD コンポーネント
- 対象ファイル:
  - `src/app/(features)/cost-prices/[productCd]/page.tsx`
  - `src/app/(features)/cost-prices/[productCd]/PeriodDetailPanel.tsx`
  - `src/app/(features)/cost-prices/[productCd]/PeriodForm.tsx`
  - `src/app/(features)/cost-prices/[productCd]/PeriodDeleteConfirm.tsx`
- 作業内容:
  - `costPriceEditQueryFactory().find({ productCode, referenceDate })` で読みモデル取得。商品不存在は `notFound()`、`version: null` は新規登録モード（#473 と同構成）
  - 参照日は page で一度だけ `toJstCalendarDay(new Date())` で求め、status 算出と共有
  - role 出し分け（`isAdmin` を panel へ渡す）、行の操作可否は昇格済み `authorityFor` で判定
  - `pnpm lint` / `pnpm build` / dev server での実機確認（/verify-frontend）
- コミットメッセージ: `feat: 原価 保守画面（詳細表示・期間CRUD）`

### PR2: 単価改定＋タイムライン

### Step 4: 単価改定フォーム
- 対象ファイル:
  - `src/app/(features)/cost-prices/[productCd]/schema.ts`（改定スキーマ追記）
  - `src/app/(features)/cost-prices/[productCd]/actions.ts`（revise action 追記）
  - `src/app/(features)/cost-prices/[productCd]/ReviseForm.tsx`
  - `src/app/(features)/cost-prices/[productCd]/PeriodDetailPanel.tsx`（導線追加）
- 作業内容:
  - `reviseCostPricePeriodCommandFactory` に接続。改定日＋新単価の最小入力契約、改定方向（値上げ/値下げ/据え置き）の表示は模倣元を踏襲
  - UI 文言は「単価改定」「改定日」で統一（「改訂」は使わない）
- コミットメッセージ: `feat: 原価 単価改定フォーム（適用終了＋新規追加の合成コマンド接続）`

### Step 5: timeline-layout を (features)/_shared へ昇格（TDD: テスト先行）
- 対象ファイル:
  - `src/app/(features)/_shared/timeline-layout.test.ts`（先に移動・中立構造型で書き直し → Red）
  - `src/app/(features)/_shared/timeline-layout.ts`（実装を移動しジェネリック化 → Green）
  - `src/app/(features)/common-selling-prices/_data/timeline-layout.ts` / `timeline-layout.test.ts`（削除）
  - `src/app/(features)/common-selling-prices/[productCd]/PriceTimeline.tsx`（import・呼び出し差し替え）
- 作業内容:
  - 入力を `{ periodId, start, end, status, price }` の中立構造型にし、`sellingPrice` フィールド名依存を除去（`priceLabel` 生成は price フィールドの引数化 or 呼び出し側整形のいずれか実装時に判断し、逸脱があれば deviations.md に記録）
  - `pnpm test` で既存テストが回帰ガードとして通ることを確認
- コミットメッセージ: `refactor: timeline-layout を (features)/_shared へ昇格し中立構造型化`

### Step 6: 原価タイムライン表示
- 対象ファイル:
  - `src/app/(features)/cost-prices/[productCd]/PriceTimeline.tsx`
  - `src/app/(features)/cost-prices/[productCd]/PeriodDetailPanel.tsx`（組み込み）
- 作業内容:
  - 昇格済み `computeTimelineLayout` を消費し、参照日は page 由来の同一基準日を使う（client で `new Date()` を再計算しない）
  - dev server での実機確認（/verify-frontend）
- コミットメッセージ: `feat: 原価 保守画面にタイムライン表示を追加`
