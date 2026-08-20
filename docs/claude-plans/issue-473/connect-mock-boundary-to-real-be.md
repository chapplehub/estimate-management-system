# 計画: 共通売単価 保守画面のモック境界を #472 実BEへ接続（#473）

## Context（なぜやるか）

共通売単価 保守画面（#429）は、BE基盤未完のあいだ `_data/mock-store.ts` をスタンドインに
FE（一覧・詳細の読み／登録・編集・適用終了・削除の書き）を先行実装していた。#472 が
develop にマージされ実BE（QueryService / Command）が揃ったため、この**モック境界を実BEへ
差し替える**スライス。

調査の結果、FE先行スタブ（`_data/types.ts`）と #472 実DTOには複数の構造差がある。
方針として **「両側を凍結するための翻訳（アダプタ）層は作らない。BE読みモデルを保守画面の形へ
拡張し、FEは実DTOを素描画する」** を採用する（ユーザー合意。FEでの全件取得→絞り込みや
二重取得といった重い処理を避け、BE側で1クエリ・1読みモデルに寄せる）。

## 設計判断（合意済み）

- **BE改修中心**: 一覧読みモデルに `priceStatus` と検索条件（code/name/priceStatus）を追加。
  編集読みモデルを **productCode キー**化し、商品identity（code/name/isActive）と
  `version: number|null` を同梱。未設定（単価集約なし）でも商品が在れば identity＋空periodsを返す。
- **三状態は業務要件として維持**: 一覧は `active` / `lapsed` / `unset` を `priceStatus` でBEが直接返す。
  これは **ADR-20260627-86b の「未設定の内訳は持たず null に畳む」判断を更新（supersede）する**。
  実装コミットのボディにその旨を記録し、**ADRファイルの改訂起票はユーザー判断**に委ねる（Claudeは勝手に作らない）。
- **FEは素描画**: BEの enum（`active/future/expired`）をそのまま採用（リネームのみ・変換なし）。
  価格は decimal 文字列のまま受け、**表示の円整形のみ** Server Component 側で行う（`Money` は server 専用）。
- **モック撤去**: `_data/mock-store.ts` / `_data/types.ts` / `_data/queries.ts` を廃止。
  `_data/period-rules.ts` は presentation ヘルパ `authorityFor` のみ残置し BE status 型へ。
- **キー/ルート**: route は `[productCd]` 維持。詳細ページは編集読みモデルが返す `productId` を
  コマンドへ渡す（FE側の code→id 解決クエリは不要）。
- **参照日**: `REFERENCE_DATE` 定数を廃し、page/action で `toJstCalendarDay(new Date())` を
  サーバ生成して注入（ADR-20260627-86b のアプリ層注入方式）。

## 実装ステップ（1ステップ＝1コミット）

### Step 1: BE 一覧読みモデルに priceStatus と検索条件を追加
- `application/queries/dto/CommonSellingPriceListItemDTO.ts`: `priceStatus: "active"|"lapsed"|"unset"` を追加（`currentSellingPrice`/`isActive` は維持）。
- `application/queries/CommonSellingPriceListQueryService.ts`: `list` の input に `code?`, `name?`, `priceStatus?` を追加。
- `infrastructure/queries/PrismaCommonSellingPriceListQueryService.ts`: `$queryRaw` を拡張。
  - `priceStatus` を `CASE`：`applicable_period @> 参照日`=`active` / `EXISTS(periods)` かつ非active=`lapsed` / 期間なし=`unset`。
  - `code`/`name` は `ILIKE`、`priceStatus` は WHERE で絞り込み（未指定は無条件）。
- テスト更新: `__tests__/PrismaCommonSellingPriceListQueryService.test.ts`（priceStatus 3パターン＋検索条件）。
- コミットボディに ADR-20260627-86b の該当判断を更新する旨を記録。

### Step 2: BE 編集読みモデルを productCode キー化＋商品identity同梱
- `application/queries/dto/CommonSellingPriceEditDTO.ts`: `productCode`, `productName`, `isActive` を追加し、`version: number | null`（null=未設定/新規モード）に変更。periods はそのまま。
- `application/queries/CommonSellingPriceEditQueryService.ts`: `find` の input を `{ productCode, referenceDate }` に変更。
- `infrastructure/queries/PrismaCommonSellingPriceEditQueryService.ts`:
  - `products` を code で引く（無ければ `null` ＝商品自体が存在しない→FEは notFound）。
  - `commonSellingPrice` の version を取得（無ければ `version: null`）。periods は既存 `$queryRaw`（`applicablePeriodBounds` 流用）。
  - 返却: `{ productId, productCode, productName, isActive, version, periods }`。
- テスト更新: `__tests__/PrismaCommonSellingPriceEditQueryService.test.ts`（存在/未設定/不在の3系統）。

### Step 3: BE Factory 新設（DI 配線）
- `application/factories/` に query factory（list/edit）と register/edit/endDate/delete の command factory を追加（既存 `productQueryFactory.ts` / 各 commandFactory の規約に一致）。
- 既存 `pricingQueryFactory.ts` に足すか専用ファイルを新設（既存粒度に合わせる）。

### Step 4: FE 一覧ページを実BE直結
- `page.tsx`: list factory を呼び、`searchParams` の code/name/filter＋`toJstCalendarDay(new Date())` を input に渡す。`filter=unset`→`priceStatus:"unset"`。行は DTO をほぼ素通し。
- `_components/columns.tsx`: `priceStatus` でバッジ直描画（active=単価表示 / lapsed=失効中 / unset=未設定）。decimal 文字列の円整形ヘルパを用意。`isActive=false` は「無効」バッジを任意付与。
- 一覧の status/criteria 型は BE DTO（`import type`）へ。

### Step 5: FE 詳細ページ＋パネルを実BE直結
- `[productCd]/page.tsx`: edit factory を `{ productCode, referenceDate }` で呼ぶ。`null`→`notFound()`。返却の `productCode/productName` を表示。`version===null`→新規登録モード（空period＋新規追加可）。
- `[productCd]/PeriodDetailPanel.tsx`: 編集DTOを直消費。`status`（active/future/expired）でバッジ＆`authorityFor`。価格は decimal 文字列を整形。`productId`/`version(number|null)` を子へ渡す。
- `PeriodForm.tsx` / `PeriodDeleteConfirm.tsx`: bind を `productId` に変更。`version` が null（新規）でも成立するよう調整。
- `import type` でのBE DTO 参照が境界 lint に触れる場合のみ、presentation 用の最小 type alias をローカル定義（実行時アダプタは作らない）。

### Step 6: FE actions を実コマンド直結
- `[productCd]/actions.ts`: mock-store ミューテータ呼び出しを各 Command factory 呼び出しへ置換。`productId` を bind。`price`(number)→decimal 文字列、`version`→`expectedVersion`。**登録が未設定商品なら `expectedVersion` を省略**（RegisterCommand が create+insert を吸収）。`referenceDate` は `toJstCalendarDay(new Date())` を各 action 内で生成。catch（ConflictError/BusinessRuleViolationError/ValidationError/NotFoundEntityError）は既存 `handleCommandError` を維持。
- `[productCd]/schema.ts`: 登録は新規モードで version 不在を許容（`version` を任意化し、存在時のみ expectedVersion 送出）。コメントの mock-store 言及を更新。

### Step 7: モック撤去とルール縮約
- 削除: `_data/mock-store.ts`, `_data/types.ts`, `_data/queries.ts`。
- `_data/period-rules.ts`: `authorityFor` のみ残置（BE status 型へ）。`overlaps/hasOverlap/classifyState` は BE が担うため削除。`period-rules.test.ts` を `authorityFor` のみに縮約。
- 参照の残骸（`REFERENCE_DATE` 等）が無いことを grep で確認。

## 検証（end-to-end）

- `pnpm test`: Step1/2 の Prisma QueryService テスト、既存 Command テストが green。
- `pnpm lint` / `pnpm build`: 型・境界・client/server 分離（`import type`）の健全性。
- 手動E2E（UC-1〜5・verify-frontend / playwright MCP、dev server）:
  - UC-1 一覧（検索 code/name・未設定のみ・active/lapsed/unset バッジ）。
  - UC-2 詳細（商品名表示・期間明細・状態バッジ）。
  - UC-3 登録（**未設定商品＝新規モードでの初回登録**を含む）。
  - UC-4 将来行編集・適用終了。UC-5 将来行削除。
  - 楽観ロック競合時に `ConflictError` 文言がフォームエラー表示されること。
- **seed 注意**: 共通売単価 seed は PRD001/PRD002 のみ・いずれも現在有効行のみ。
  将来行/失効行はテスト中にUIで作成して検証する（unset は PRD003 以降が該当）。

## スコープ外（Issue 記載どおり）
改訂ウィザード（別issue A）／タイムライン表示（B）／最低1期間ハード強制（C）／BE基盤の新規実装。

## 残課題（実装中に判断・逸脱は deviations.md へ）
- ADR-20260627-86b の改訂（supersede）起票はユーザー判断。
- `priceStatus` の `lapsed` を一覧フィルタ選択肢に出すかは Step4 で最小（未設定のみ）から開始し、必要なら追加。
