# Issue #427 実装計画からの逸脱記録

計画ファイル: [override-selling-price-aggregates.md](./override-selling-price-aggregates.md)

実装中に計画と異なる技術的対応をした点を記録する（CLAUDE.md「Record deviations from plan」）。
いずれも設計判断（ADR-20260624-8tg）の変更ではなく、実装段階で判明した技術制約への適応。

## 1. 集約取得を `findUnique`（複合キー）ではなく `findFirst`（スカラー条件）で実装

- **元の計画**: Step 4/7 の Repository は共通販売単価のミラーとして親を取得する。共通は
  `prisma.commonSellingPrice.findUnique({ where: { productId } })` を使う。複合自然キーの
  得意先別・納品先別も素直には複合 `findUnique`（`where: { customerId_productId: {...} }`）になる。
- **実際の実装**: `prisma.customerSellingPrice.findFirst({ where: { customerId, productId } })`
  （納品先別も同様）。複合PKは一意なので結果は `findUnique` と同値（0/1行）。
- **逸脱の理由**: Prisma の複合 `findUnique` 連結キー名（`customerId_productId` /
  `deliveryLocationId_productId`）がプロジェクトの `@typescript-eslint/naming-convention`
  （camelCase/UPPER_CASE）に抵触し、pre-commit の eslint --fix で commit が失敗した。本番コードに
  複合キー `findUnique` の前例も `eslint-disable` の前例も無いため、規約を緩める（穴を開ける）より
  呼び出し側を規約に合わせる選択をした。複合PKインデックスを使う点・結果は同値。

## 2. schema.prisma の納品先別子テーブルに `map:` を追記（インデックス名・FK名）

- **元の計画**: Step 6 は得意先別（Step 3）と同型で `delivery_location_selling_prices` ＋
  `delivery_location_selling_price_periods` を定義し、手書き SQL でマイグレーションする。schema 側の
  追加注釈は想定していなかった。
- **実際の実装**: 子モデル `DeliveryLocationSellingPricePeriod` の `@@index([deliveryLocationId,
  productId])` と 子→親 `@relation(...)` に `map:` を付与し、マイグレーション SQL 側で略記した名前
  （`delivery_location_selling_price_periods_dl_id_product_id_idx` /
  `..._dl_id_product_id_fkey`）と一致させた。
- **逸脱の理由**: 子テーブルは名前が長く、`@@index` と子→親 FK のデフォルト名が PostgreSQL の
  識別子63文字制限を超える。手書きマイグレーション SQL では `dl_id` と略記したが、schema 側へ
  `map:` で同名を明示しないと `prisma migrate dev` がデフォルト名（truncate 後）との差分をドリフトと
  誤検出し、修正用マイグレーションを作ろうとした。`map:` で schema とマイグレーションの名前を一致させ
  「Already in sync」を確認した。得意先別（Step 3/4）は名前が63文字以内に収まりデフォルト名と一致した
  ため、この対応は納品先別のみで必要だった。

## 補足: 共有 dev DB のドリフトとマイグレーション適用の運用

- マイグレーション適用（`prisma migrate dev`）は全 worktree 共有の dev DB への変更のため `!` 委譲で
  実行した（計画 Step 備考のとおり）。
- 上記2の初回適用時、ドリフト検出でマイグレーション名の入力待ちになったプロセスを Ctrl+C せず放置すると
  PostgreSQL の advisory lock を握り続け、次の `migrate` が P1002（lock timeout）になる。停止プロセスを
  終了してロックを解放する必要があった。
