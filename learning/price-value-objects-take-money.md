# 価格/金額の値オブジェクトは常に Money を引数に取る

作成日: 2026-06-24

## 概要

価格・金額を表す値オブジェクト（VO）の生成口は、`number` ではなく `Money` を引数に取るべき。
`number` を受け取る生成口（例: `SellingUnitPrice.fromMajorUnits(number)`）は `Money` が既に
持つ「number↔金額の変換と精度ガード」を VO 層で二重に開けるだけで、float 誤差の侵入経路を増やす。
共通販売単価集約（#426）の PR #449 レビューで `Money` 読み出し精度の指摘（#3）を直す過程で確立した原則。

## 詳細

### なぜ Money に集約するか

`Money`（ADR-0022）は内部表現が「整数の最小単位（銭）」で、生成口ごとに精度ガードを持つ。

- `Money.fromMinorUnits(int)`: 整数チェック。永続化境界からの厳密復元。
- `Money.fromMajorUnits(number)`: `|minor - round| > 1e-6` でスケール超過を弾く。
- `Money.fromDecimalString(string)`: 文字列を整数部・小数部に分解しスケールへ桁合わせ。**float 非経由**。

価格 VO が `number` 引数の生成口を持つと、この精度ガードを VO ごとに再実装するか、`Money` に
委譲しても結局 `number` ドアを公開してしまう。生成口を `fromMoney(Money)` のみにすれば、
VO は受け取った `Money` に「非負」などのドメイン不変条件だけを課せばよく、精度の責務は `Money` に一元化される。

### float 経由が壊す具体例（#3）

DB の `DECIMAL(12,2)` を `::text` で受けても、`Number("9999999999.97")` を経由すると主単位が
float64 になり、値域上限帯（約100億円弱の単価）で銭への換算が丸め誤差を持つ。`fromMajorUnits` の
厳密ガードに引っかかり再構成が `InvalidArgumentError` で失敗しうる（データ破壊はなく loud fail だが、
`::text` で精度を保持してきた意図を `Number()` が最後に打ち消している）。`fromDecimalString` で
文字列のまま厳密変換すればこの経路を断てる。

### #447 へ引き継ぐ発見（CostPrice の同型の罠・さらに悪い）

原価 `CostPrice` は **Money ですらなく** `ValueObject<number>` で、`ProductMapper` が
`new CostPrice(Number(prismaProduct.costPrice))` と同じ `Number(Decimal)` 罠を踏み、
非負・小数2桁を自前 float 検証している（`value.toString().split(".")[1]` で桁数判定など float-fragile）。
本原則に従い、#447 で `CostPrice` を `Money` ベースへ移行し、Mapper も `Money.fromDecimalString` 経由にすべき。

## 参考

- 関連ファイル:
  - `src/server/shared/domain/values/Money.ts`（`fromDecimalString` 新設）
  - `src/server/subdomains/pricing/domain/values/SellingUnitPrice.ts`（`fromMoney` のみ）
  - `src/server/subdomains/pricing/infrastructure/mappers/CommonSellingPriceMapper.ts`（読み出しを float 非経由化）
  - `src/server/subdomains/product/domain/values/CostPrice.ts` / `ProductMapper.ts`（#447 で是正する同型の罠）
- ADR-0022（Money パターン）
- PR #449 レビュー #3、issue #447
