# Issue #487: 共通販売単価 未設定の有効商品に対する設定アナウンス（ソフト誘導） — 実装計画

## Context

「有効な商品は共通販売単価を最低1期間持つ」という設計上の期待を、跨集約のハード強制（#476・grill の結果 **不採用**）ではなく **ソフトな誘導（アナウンス）** で担保する。

- 正確性の安全弁（`PriceResolutionPolicy` の throw）・可視化（保守画面の三状態バッジ #473）は実装済みで、サイレントな破損は起きない。
- 残る唯一のギャップは「**有効化したが共通販売単価が未設定の商品が、見積時まで気づかれにくい**」という UX。
- 本 Issue はこのギャップを、操作をブロックしない **商品側起点のアナウンス** で埋める。

### ユーザー確定事項（grill 済み）

- **表示面**: ① 商品詳細画面の常設インラインバナー ＋ ② 商品作成完了後のトースト（有効化後トーストは含めない）
- **対象状態**: 現在有効な単価が無い ＝ `priceStatus` が `unset`（未設定）または `lapsed`（失効中）。`active` は誘導しない。
- **表現形式（詳細画面）**: 常設インラインバナー ＋ 共通販売単価 設定画面（`/common-selling-prices/[productCd]`）への設定リンク。

## スコープ

**含む**
- 商品詳細画面（`page.tsx`）に、価格を持ちうる商品で現在有効な単価が無い場合の警告バナー＋設定リンクを常設表示。
- 商品作成完了後のトーストを、価格を持ちうる商品では「未設定を促す」文面に分岐。

**含まない**（Issue 明記）
- 跨集約のハード強制（#476 不採用・再検討しない）。
- 価格決定の安全弁の変更。
- 保守画面側の可視化（#473 で実装済み・重複回避のため商品側起点に絞る）。

## 設計判断

### 判断1: 跨集約 read（商品詳細から共通販売単価の状態を引く手段）— ✅確定=B
商品詳細ページ（product サブドメイン文脈）から、単一商品の三状態 `priceStatus`（active/lapsed/unset）を取得する。

- **決定: pricing 応用層に単一商品用 `priceStatus` read を新設**（一覧クエリの SQL を単一商品にミラー）。
  - 理由: #473 で確立した「**三状態は業務要件として BE が直接返す**」規約に整合させ、FE への業務ルール漏出を避ける。
  - 実装: interface＋DTO＋Prisma 実装＋`pricingQueryFactory` 配線＋`__tests__`。
- 参考（不採用）: 既存 `CommonSellingPriceEditQueryService.find` の `periods[]` から FE 導出する案は BE 新規コードゼロだが、三状態規約と衝突するため不採用。

### 判断2: 詳細バナーの表示条件 — ✅確定=有効商品のみ
- **決定: `isActive === true` かつ `canHavePrice` かつ `priceStatus !== "active"` の場合のみ表示**。
- 理由: Issue の主旨は「**有効化したが**未設定」であり、無効商品は見積で使われず緊急性がない。無効商品への表示は雑音になる（「無効商品にも単価設定は可能」という既存仕様はバナー非表示でも阻害しない）。

### 判断3: 作成トーストの分岐方式
- 商品作成アクション（`products/new/actions.ts`）は `submission.value.category` を保持。新規商品は常に `isActive=true`・単価未設定で作成されるため、**`canHavePrice`（SET 以外）だけで分岐**できる。
- 新 `REDIRECT_REASON.PRODUCT_CREATED_PRICE_UNSET`（`FLASH_MESSAGE_TYPE.INFO`）を追加し、価格を持ちうる区分では従来の `PRODUCT_CREATED` の代わりにこれを使う。SET は従来どおり `PRODUCT_CREATED`。
- トーストは一覧（`/products`）で表示されるため特定商品へのリンクは持てない。文面で「商品詳細から設定してください」と誘導（詳細バナーが受け皿になる）。
- 区分→`canHavePrice` の判定は presentation 層に業務判断を持ち込まないため、`ProductCategory.canHavePrice()` を参照できる形（application 層の command 結果 or 小さな共有判定）に寄せる。実装時に既存 command 戻り値/factory の形を確認して最小構成を選ぶ。

## ステップ

### Step 1: pricing 応用層に単一商品 priceStatus read を新設（判断1=B）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/` に単一商品 `priceStatus` read の interface＋DTO
  - `src/server/subdomains/pricing/infrastructure/queries/` に Prisma 実装（一覧クエリの三状態算出 SQL を単一商品にミラー）
  - `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts` に factory 追加
  - `.../infrastructure/queries/__tests__/` に unset/lapsed/active＋参照日境界のテスト
- 作業内容:
  - `productCode`（または `productId`）＋ `referenceDate` を受け、`active`/`lapsed`/`unset` を返す。参照日は既存同様 `toJstCalendarDay` でアプリ層が注入（`CURRENT_DATE` 不使用・ADR-20260627-86b）
- コミットメッセージ: `feat: 商品単位の共通販売単価 priceStatus を返す read を追加 (#487)`

### Step 2: 詳細画面の常設バナー表示
- 対象ファイル:
  - `src/app/(features)/products/[productCd]/page.tsx`（Server Component から Step 1 の read を呼ぶ）
  - バナーは小コンポーネントとして切り出し（例: 同ディレクトリに `CommonSellingPriceUnsetBanner.tsx`）
- 作業内容:
  - `product.isActive` かつ `canHavePrice`（`product.category` から判定）かつ `priceStatus !== "active"` のとき、警告色バナー＋`/common-selling-prices/${product.code}` への設定リンクを表示
  - 文面は `unset`/`lapsed` で出し分け（例: 未設定=「共通販売単価が未設定です」／失効中=「有効な共通販売単価がありません（失効中）」）
- コミットメッセージ: `feat: 商品詳細に共通販売単価 未設定/失効の設定誘導バナーを追加 (#487)`

### Step 3: 作成完了トーストの分岐
- 対象ファイル:
  - `src/server/shared/constants/redirect-reasons.ts`（`PRODUCT_CREATED_PRICE_UNSET` 追加）
  - `src/app/_components/redirect-reason-toast.tsx`（`INFO` メッセージ登録）
  - `src/app/(features)/products/new/actions.ts`（`canHavePrice` 区分で reason 分岐）
- 作業内容:
  - 価格を持ちうる区分での作成時に、未設定を促す INFO トーストへ分岐。SET は従来の SUCCESS トースト維持
- コミットメッセージ: `feat: 単価対象商品の作成後に共通販売単価 設定を促すトーストを表示 (#487)`

### Step 4: 逸脱記録（計画と実装が乖離した場合のみ）
- 対象ファイル: `docs/claude-plans/issue-487/deviations.md`
- 作業内容: 判断1/2 の最終選択や実装中の乖離を記録（CLAUDE.md ルール）

## 検証

- **単体/結合テスト**:
  - 判断1=B なら新設 read の QueryService テスト（unset/lapsed/active の3ケース・参照日境界）を追加。既存 `PrismaCommonSellingPrice*QueryService.test.ts` の規約に倣う。
  - トースト分岐は action の分岐を軽く確認（既存 action テストの有無に合わせる）。
- **E2E / 実機確認**（`verify-frontend` スキル＋playwright MCP）:
  - 単価未設定の有効な個別商品の詳細を開き、バナー＋設定リンクが出ること／リンク先が `/common-selling-prices/{code}` であること
  - 単価設定済み（active）商品ではバナーが出ないこと、SET 商品では出ないこと
  - 個別/消耗品を新規作成 → 一覧で「設定を促す」INFO トーストが出ること。SET 作成では従来の成功トーストであること
- **静的チェック**: `pnpm lint` / `pnpm test`
