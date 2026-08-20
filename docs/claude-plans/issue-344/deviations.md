# Issue #344 実装計画からの逸脱記録

実装計画: `search-estimates-query.md`

## 逸脱 1: 件数上限の指定方法（`take`）

- **元の計画内容**: Step 3 で `take: LIST_FETCH_LIMIT`（infra 実装内で件数上限を直接指定）。
- **実際の実装内容**: `take: options?.limit` とし、件数上限 `LIST_FETCH_LIMIT` は呼び出し側
  （presentation）が `options.limit` として渡す（`PrismaProductQueryService.search` と対称）。
- **逸脱の理由**: `LIST_FETCH_LIMIT` は `src/app/_lib/searchParams.ts`（presentation 層）の定数で、
  サーバ層から import している箇所は 0 件だった。infra から presentation 定数を import すると
  DDD レイヤリングが逆転する（CLAUDE.md「Domain/infra MUST NOT depend on presentation」）。
  既存の一覧クエリ（商品・従業員・取引先など）は一律「呼び出し側が `LIST_FETCH_LIMIT` を options に
  詰めて渡す」規約のため、それに揃えた。

## 逸脱 2: コミット構造（Step 2 と Step 3 の統合）

- **元の計画内容**: Step 2（アプリ層: interface 拡張＋`SearchEstimatesQuery`）と
  Step 3（Prisma 実装）を別コミットにする。
- **実際の実装内容**: Step 2 と Step 3 を 1 コミットに統合した
  （`feat: 見積一覧取得クエリ（アプリ層＋Prisma 実装）を追加`）。
- **逸脱の理由**: `EstimateQueryService` interface に `search` を足した時点で、
  唯一の実装者 `PrismaEstimateQueryService` が `implements` を満たさず型が壊れる。
  「実装者のいない interface メソッドを main に残さない」ため、interface とその実装を同梱した。
  ファクトリ（Step 4）・テスト（Step 5）は計画どおり個別コミット。
