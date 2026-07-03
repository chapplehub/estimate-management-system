# Issue #506: 得意先別販売単価の読みモデル（一覧 / 編集 QueryService + DTO） — 実装計画

## 概要

得意先別販売単価の保守画面（一覧・編集）が使う読みモデルを、共通販売単価・原価の List/Edit 読みモデルと同型ミラーで追加する（BE 読み側のみ。書き込みは #510 済み、FE は対象外）。

- 編集用: `CustomerSellingPriceEditQueryService` + Prisma 実装 + Edit DTO（version 付き・期間行と status を同梱）
- 一覧用: `CustomerSellingPriceListQueryService` + Prisma 実装 + List DTO（封筒型: 得意先 identity + 商品行）
- 得意先候補クエリ: **実装なし**（既存 `SearchCustomersQuery` 流用可と判断。Server Action ラッパは FE イシューの関心）

ミラー元との構造差は identity が複合キー（`customerId × productId`）である点のみで、本計画の設計判断はすべてその波及。

前提: ブランチは origin/develop に rebase 済み（#512 空集約シェル解消・#514 母集合の価格保守対象商品限定・を取り込み済み）。CONTEXT.md への用語追加（「上書きなし」・「価格保守対象商品」の適用範囲拡張）はコミット済み（`34f22df`）。

## 設計判断

（/grill-with-docs セッションで合意済み）

### 一覧の母集合
- A. 得意先必須 × 価格保守対象商品ベース（`ProductCategory.priceableValues()` を単一源に注入。セット商品除外）
- B. 得意先別単価の行が存在する商品のみ
- 採用: A。共通販売単価・原価一覧（#514 後）と同型になり、上書きが無い商品への新規登録動線が一覧から立つ。「得意先未選択時は返さない」は BE 仕様ではなく FE がクエリを発行しないだけ

### priceStatus の三状態と第三状態の名前
- A. `"active" | "lapsed" | "unset"`（共通販売単価の字面ミラー）
- B. `"active" | "lapsed" | "none"`（第三状態を改名）
- 採用: B。CONTEXT.md の「未設定 (Unset)」は共通層専用の予約語（異常状態・保守アクション要求の含意）であり、上書きレイヤーで行が無いのは正常な既定状態のため流用しない。正準語「上書きなし (None / No Override)」を CONTEXT.md に追加済み。型は `CustomerSellingPricePriceStatus` として独立複製（ADR-20260627-a5c: 型は集約ごとに複製し共有しない）

### 共通販売単価へのフォールバック表示
- A. 得意先別のみ表示
- B. 共通単価を独立カラム（`currentCommonSellingPrice`）で並記。COALESCE しない
- C. 実効単価をフォールバック解決（COALESCE）して返す
- 採用: B。画面の業務価値は「この得意先はいくら優遇されているか」の比較にある。C はフォールバック規則が Resolve 系（価格決定）と読みモデルの2箇所に住む再実装になるため不採用。読みモデルは事実の並記に徹する。共通側の三状態は載せない（共通販売単価画面の関心。null で「共通も無い」は読み取れる）

### 得意先候補クエリの帰属
- A. 本イシューで新規 BE クエリを作る
- B. 既存 `SearchCustomersQuery`（customer サブドメイン）流用可と判断のみ記録し、実装しない
- 採用: B。Server Action ラッパは presentation 層の入口で FE イシューの関心（見積画面の `searchCustomersForSelection` が先行事例）。BE に汎用候補クエリを新設すると既存と重複する

### Edit クエリの引数と not-found の意味論
- 採用: `find({ customerCode, productCode, referenceDate })` の複合自然キー
  - 得意先または商品が不在 → `null`（FE は `notFound()`。どちらが不在かは区別しない——共通販売単価も区別していない）
  - 両方在るが集約なし（＝上書きなし） → identity + `version: null` + 空 `periods` ＝新規登録モード（Register コマンドと1:1対応）
  - 集約あり → identity + `version: number` + 期間行（`future/active/expired`、`lower(applicable_period)` 昇順）
- `version: null ⇔ 新規登録モード` の安全性は #512 の解決（最終期間削除で集約ルートごと削除→「集約が存在する ⇔ 期間行が1件以上」の不変条件）に依拠する。#512 未取り込みのコードベースではこの設計は成立しない点に注意

### Edit DTO の identity 命名
- 採用: 両マスタ identity 同梱 + `customerIsActive` / `productIsActive` の接頭辞命名（裸の `isActive` を残さない）。エンティティが2つ載る DTO の自己記述性を、ミラー元との字面一致より優先

```typescript
interface CustomerSellingPriceEditDTO {
  customerId: string;        // コマンド宛先キー（フォームが往復）
  customerCode: string;
  customerName: string;
  customerIsActive: boolean; // 無効得意先の編集時バッジ表示用
  productId: string;         // コマンド宛先キー（フォームが往復）
  productCode: string;
  productName: string;
  productIsActive: boolean;  // 無効商品の編集時バッジ表示用
  version: number | null;    // 楽観ロックトークン。上書きなし（集約なし＝新規登録モード）なら null
  periods: CustomerSellingPriceEditPeriodDTO[];
}

interface CustomerSellingPriceEditPeriodDTO {
  periodId: string;
  start: string;
  end: string | null;
  sellingPrice: string;      // 10進文字列（消費側で Money.fromDecimalString）
  status: CustomerSellingPricePeriodStatus; // "future" | "active" | "expired"（独立複製）
}
```

### 一覧クエリの入力と「存在しない得意先」の扱い
- A. `list({ customerId, ... })` で裸配列（共通販売単価の字面ミラー）
- B. `find({ customerCode, referenceDate, code?, name?, priceStatus? })` → 封筒型 DTO `| null`
- 採用: B。A は存在しない customerId でも LEFT JOIN が静かに空振りし「全商品が上書きなし」に見える契約事故がある。得意先不在→ `null` で構造的に排除。customerCode 自然キーで Edit の URL 体系（`[customerCd]/[productCd]`）と揃え、封筒に得意先 identity を同梱して FE ヘッダ描画の二重取得を不要にする（#473 素描画方針）。共通販売単価の裸配列から形が割れるのは、母集合に必須キー（得意先）が増えたことの構造的帰結として正当

```typescript
interface CustomerSellingPriceListDTO {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerIsActive: boolean;
  items: CustomerSellingPriceListItemDTO[]; // productCode 昇順
}

interface CustomerSellingPriceListItemDTO {
  productId: string;
  productCode: string;
  productName: string;
  isActive: boolean;                       // 商品マスタ有効フラグ（行＝商品なので裸で曖昧さなし）
  currentSellingPrice: string | null;      // 得意先別・参照日有効
  currentPeriodStart: string | null;       // #514 後の共通販売単価一覧と同様
  currentPeriodEnd: string | null;
  currentCommonSellingPrice: string | null; // 共通・参照日有効（並記。COALESCE しない）
  priceStatus: CustomerSellingPricePriceStatus; // "active" | "lapsed" | "none"
}
```

### ADR
- 起票しない（「変更困難・トレードオフ」の基準を満たす決定なし）。用語は CONTEXT.md、判断理由は本計画とコミット本文に残す

## ステップ

/tdd（red-green-refactor）で進める。テスト方式は既存の Prisma QueryService 統合テスト規約に従う: 実 DB に対し repository でフィクスチャ構築、テストファイル専用の予約コード（例: `CSPED01`〜 / `CSPLS01`〜）で他ファイルとの並列実行衝突を防ぎ（#517: `products.name` は code 接尾で一意化）、`beforeEach`/`afterEach` で cleanup。

### Step 1: 編集用読みモデル（Edit DTO + QueryService IF + Prisma 実装）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/dto/CustomerSellingPriceEditDTO.ts`（新規）
  - `src/server/subdomains/pricing/application/queries/CustomerSellingPriceEditQueryService.ts`（新規）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCustomerSellingPriceEditQueryService.ts`（新規）
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCustomerSellingPriceEditQueryService.test.ts`（新規）
- 作業内容:
  - DTO・IF を定義（設計判断どおり。JSDoc に #512 依拠の不変条件と version の運び方を明記）
  - **Red**: `PrismaCommonSellingPriceEditQueryService.test.ts` をひな型に統合テストを先に書く。ケース: 集約あり（期間行の昇順・`future/active/expired` の3状態・version 非 null）／上書きなし＝新規登録モード（`version: null`・空 periods）／得意先不在→ null／商品不在→ null／無効得意先・無効商品のフラグ反映
  - **Green**: Prisma 実装。得意先・商品の identity 解決（code→findUnique）→ 集約 version の typed 取得（複合キー `findUnique`）→ 期間行は `$queryRaw` で `lower(applicable_period)` 昇順 + 時点状態 CASE（共通販売単価実装のミラー）
  - **Refactor**: ミラー元との差分が複合キー起因のみであることを確認
- コミットメッセージ: `feat: 得意先別販売単価の編集用読みモデル（EditQueryService + DTO + Prisma実装）`（本文に設計判断: 複合自然キー find・version:null=新規登録モードが #512 の不変条件に依拠する旨・isActive 接頭辞命名の理由）

### Step 2: 一覧用読みモデル（List DTO + QueryService IF + Prisma 実装）
- 対象ファイル:
  - `src/server/subdomains/pricing/application/queries/dto/CustomerSellingPriceListDTO.ts`（新規）
  - `src/server/subdomains/pricing/application/queries/CustomerSellingPriceListQueryService.ts`（新規）
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCustomerSellingPriceListQueryService.ts`（新規）
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCustomerSellingPriceListQueryService.test.ts`（新規）
- 作業内容:
  - DTO（封筒型 + 行）・IF を定義（`CustomerSellingPricePriceStatus = "active" | "lapsed" | "none"`。JSDoc に「上書きなし」の語彙と unset を使わない理由を明記）
  - **Red**: 統合テストを先に書く。ケース: 三状態（active／lapsed＝期間行ありだが参照日区間外／none＝期間行皆無）／`currentCommonSellingPrice` の並記（共通あり・なし両方）／セット商品が母集合に含まれない／得意先不在→ null／商品コード・商品名の部分一致絞り込み／priceStatus 絞り込み／productCode 昇順／他得意先の行が混入しない
  - **Green**: Prisma 実装。得意先 identity 解決 → `$queryRaw` で `products`（`category IN priceableValues()`）を左表に、得意先別期間行（`customer_id` 固定 + `@> 参照日`）と共通期間行をそれぞれ LEFT JOIN。priceStatus CASE は `EXISTS` の相関条件に `customer_id` を含める。検索条件は派生テーブル外側の WHERE（共通販売単価実装のミラー）
  - **Refactor**: 同上
- コミットメッセージ: `feat: 得意先別販売単価の一覧用読みモデル（ListQueryService + 封筒型DTO + Prisma実装）`（本文に設計判断: 封筒型 `| null` による「存在しない得意先が全行上書きなしに化ける」契約事故の排除・priceStatus 第三状態 "none" の語彙・共通単価並記で COALESCE しない理由）

### Step 3: ファクトリ配線
- 対象ファイル:
  - `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts`（追記）
- 作業内容:
  - `customerSellingPriceEditQueryServiceFactory()` / `customerSellingPriceListQueryServiceFactory()` を追加。既存規約どおり読みモデルは Query ラッパを介さず QueryService IF を直接返す
  - 既存テスト・lint の全体確認（`pnpm test` / `pnpm lint`）
- コミットメッセージ: `feat: 得意先別販売単価 読みモデルのファクトリ配線`

### 備考
- 得意先候補クエリは実装しない（設計判断どおり）。FE イシューへの申し送り: 既存 `searchCustomersQueryFactory()` + `searchCustomersForSelection`（見積画面）のパターンを流用すること
- 計画と異なる対応をした場合は `docs/claude-plans/issue-506/deviations.md` に記録する
