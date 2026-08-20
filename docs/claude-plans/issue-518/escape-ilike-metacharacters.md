# Issue #518: 一覧検索の ILIKE で LIKE メタ文字 (% _) が未エスケープ (pricing 4箇所) — 実装計画

## 概要

pricing の一覧検索 QueryService 2本（`PrismaCostPriceListQueryService` / `PrismaCommonSellingPriceListQueryService`）で、生 ILIKE のパターン `%${input.code}%` に含まれるユーザー入力の LIKE メタ文字 `%` `_` が未エスケープのまま渡り、意図しない広範囲がヒットする実バグを修正する（2ファイル×2列=4箇所）。

他の一覧検索（customer/product/employee など）は Prisma の `contains:` を使い値が自動エスケープされるため無傷。この2本だけが `daterange @>` 演算子の都合で `$queryRaw` + 生 ILIKE を使わざるを得ず、手動エスケープが必要になっている。

共有インフラ util としてエスケープ関数を新設し、両 QueryService に適用する。`/tdd`（red-green-refactor）で、各ステップともテスト先行で進める。

## 設計判断

### エスケープ機構
- `\` `%` `_` の3文字を `\` でエスケープし、SQL 側に明示的な `ESCAPE '\'` 句を付与する。
- 理由: `input.code = "50%"` → `50\%` → パターン `%50\%%` でリテラル `50%` にマッチ（正しい挙動）。デフォルトのエスケープ文字が `\` なので `ESCAPE '\'` は省略しても動くが、明示することで意図がクエリ上に残り `standard_conforming_strings` 等の設定に依存しなくなる。
- `$queryRaw` はテンプレート変数をバインドパラメータとして渡すため、SQL文字列リテラルのエスケープ問題は絡まず、純粋にパターン文字列としての3文字だけを扱えばよい。

### エスケープ関数の配置レイヤーと共通化
- `src/server/shared/infrastructure/escapeLikePattern.ts` に共有 util として置く（`dateRange.ts` と同レイヤ）。
- 理由: LIKE エスケープはドメイン知識ではなく ILIKE という技術詳細への対処なので domain 層ではなく infrastructure 層。呼び出し箇所が確実に2ファイル4箇所あり DRY の実益がある。pricing 固有の関心ではなく他サブドメインも再利用しうる純粋な技術関数のため pricing ローカルではなく shared。
- 対立案（各ファイルにインライン複製 / pricing ローカル）は、同一ロジックの二重管理・関心の閉じ込めすぎのため退けた。

### 関数の責務分割（プリミティブ + コンポジット）
- `escapeLikePattern(s: string): string` — プリミティブ。`\` `%` `_` を `\` でエスケープのみ。
- `containsPattern(s: string): string` — コンポジット。内部で `escapeLikePattern` を呼び、`` `%…%` `` で囲んで返す。
- 呼び出し側: `` ILIKE ${containsPattern(input.code)} ESCAPE '\\' ``。
- 理由: 関心を階層化することで、プリミティブは前方一致など別パターンでも再利用でき単体テストをエスケープ規則そのものに集中できる。コンポジットは「囲みが付くこと」だけ確認すればよく、呼び出し側から `%...%` の文字列連結が消えて囲み忘れ等の別バグの余地がなくなる。`ESCAPE` 句は SQL 構文要素なので SQL テンプレート側に残すのが正しい配置。
- 実装メモ: エスケープは単一の正規表現1パス `s.replace(/[\\%_]/g, m => "\\" + m)` で書き、順序依存の二重エスケープ事故を原理的に回避する。

### テスト方針（二層）
- 単体テスト（網羅担当・DB不要の純関数）: `escapeLikePattern` / `containsPattern`。`%`→`\%`、`_`→`\_`、`\`→`\\`、複合（`a\_b`→`a\\\_b`）、メタ文字なし素通し、`containsPattern` の前後 `%` 付与。
- 統合テスト（結線担当・実DB）: 各 QueryService テストに1ケース。`%`/`_` を含む実データを用意し、`%` 等を検索語に入れたとき「リテラルとしてマッチする1件のみ返り、全件マッチしない」ことを確認。エスケープ済みパターンが ILIKE に正しく届き `ESCAPE '\'` 句が効いていることのエンドツーエンド保証。
- 理由: 単体だけだと SQL への結線（`ESCAPE` 句付与漏れ等）を捕捉できず、統合だけだとエスケープ規則の網羅コストが高い。網羅は単体に寄せ、統合は各ファイル1ケースに留める。

### ドキュメント
- ADR: 作らない。覆すコストが低く、非対称の理由（`daterange` は Prisma typed で扱えず `$queryRaw`）は既に両ファイルのヘッダコメントに明記済みで、素直な既定選択のため3条件を満たさない。
- CONTEXT.md: 更新しない。用語集（ドメイン言語）であり `containsPattern`/LIKEエスケープは実装語彙のため対象外。
- deviations.md: 逸脱発生時のみ記録。事前作成不要。

## ステップ

### Step 1: エスケープ関数 `escapeLikePattern` / `containsPattern` の実装（TDD）
- 対象ファイル:
  - `src/server/shared/infrastructure/__tests__/escapeLikePattern.test.ts`（新規）
  - `src/server/shared/infrastructure/escapeLikePattern.ts`（新規）
- 作業内容:
  - RED: 純関数の単体テストを先に書く（`%`→`\%`、`_`→`\_`、`\`→`\\`、複合 `a\_b`→`a\\\_b`、メタ文字なし素通し、`containsPattern` の前後 `%` 付与）。
  - GREEN: `escapeLikePattern`（正規表現1パス `s.replace(/[\\%_]/g, m => "\\" + m)`）と、それを内部利用する `containsPattern` を実装してテストを通す。
- コミットメッセージ: `fix: LIKEメタ文字エスケープ用の共有util(escapeLikePattern/containsPattern)を追加 #518`

### Step 2: `PrismaCostPriceListQueryService` への適用（TDD）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCostPriceListQueryService.test.ts`
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCostPriceListQueryService.ts`
- 作業内容:
  - RED: `%`/`_` を含む実データで「リテラルマッチ1件のみ／全件マッチしない」ことを検証する統合テスト1ケースを追加（現状は失敗する）。
  - GREEN: `%${input.code}%` / `%${input.name}%` を `containsPattern(...)` に置換し、ILIKE 句に `ESCAPE '\\'` を付与して通す。
- コミットメッセージ: `fix: 原価一覧検索のILIKEメタ文字を未エスケープから修正 #518`

### Step 3: `PrismaCommonSellingPriceListQueryService` への適用（TDD）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/queries/__tests__/PrismaCommonSellingPriceListQueryService.test.ts`
  - `src/server/subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceListQueryService.ts`
- 作業内容:
  - RED: 同型の統合テスト1ケースを追加（現状は失敗する）。
  - GREEN: 同様に `containsPattern(...)` + `ESCAPE '\\'` へ置換して通す。
- コミットメッセージ: `fix: 共通売価一覧検索のILIKEメタ文字を未エスケープから修正 #518`
