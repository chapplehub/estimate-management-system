# Issue #465 原価移設 A — 実装中の計画逸脱記録

計画ファイル: `cost-price-aggregate-and-backfill.md`（ADR-20260627-a5c 準拠）。
TDD（red-green-refactor）で実装。計画と異なる対応をした点を記録する。

## 1. Repository インターフェースは `save` ではなく `insert`/`update` 分割

- **元の計画**: Step 4 で「`findByProductId`/`save` に限定」。
- **実際の実装**: ミラー元 `CommonSellingPriceRepository` が楽観ロック（ADR-0039）のため
  `findByProductId`/`insert`/`update(aggregate, expectedVersion)` の3メソッドだった。実体に
  忠実にこれをミラーした。
- **逸脱の理由**: 計画の「save」は概念的な略記で、実コードは insert/update 分割。版管理の
  ガード（version 条件付き UPDATE の影響行数判定）を持つ既存パターンに揃えるのが正。

## 2. Mapper の専用テストはミラー元に存在しなかった（新規に先行作成）

- **元の計画**: Step 6 で「`CommonSellingPriceMapper` をミラー、テスト先行」。
- **実際の実装**: ミラー元 `CommonSellingPriceMapper` には専用ユニットテストが無く、
  Repository 往復統合テストで間接被覆されていた。計画の「テスト先行」方針に従い、
  `CostPriceMapper` には純粋関数（`toDomain`/`toPeriodWriteRows`）の往復ユニットテストを
  新規作成した（DB 非依存・銭精度・上端 unbounded）。
- **逸脱の理由**: 計画が明示的に Mapper テストを求めており、純粋関数で安価にテストできる。
  ミラー元のテスト欠落（ギャップ）を引き継がず、計画の意図を満たす方を採った。

## 3. 共有ヘルパ `appendPeriodRows` を値列名でパラメータ化（リファクタ）

- **元の計画**: Step 7 で「共有ヘルパ（`sellingPricePeriodPersistence` 周辺）を再利用」。
- **実際の実装**: 共有ヘルパ `appendPeriodRows` と `PeriodWriteRow` が金額列を
  `selling_price`／`sellingPrice` でハードコードしていた。原価は列が `cost_price` のため
  そのままでは再利用できず、`PeriodTableConfig.valueColumn` を追加し `PeriodWriteRow.sellingPrice`
  を `value` に一般化した。販売単価3層（共通・得意先別・納品先別）の呼び出しを
  `valueColumn: "selling_price"` に追従させ、統合テストで無回帰を確認。
- **逸脱の理由**: 「再利用」を実現するための必要なリファクタ。原価が4つ目の利用者として
  ヘルパを共有でき、生 SQL の染み出しを増やさない。3層の統合テストで安全網を確保した。

## 4. 解決結果 DTO は売単価共有 DTO を流用せず新設

- **元の計画**: Step 8 で「`ResolveCommonSellingPriceQuery`/`PrismaCommonSellingPriceQueryService`
  をミラー」。DTO の扱いは明記なし。
- **実際の実装**: 売単価3層共有の `SellingPriceResolutionDTO`（`sellingPrice`）を流用せず、
  `CostPriceResolutionDTO`（`costPrice`）を新設した。
- **逸脱の理由**: 原価は売単価と別概念・別列で、粗利＝売単価 − 原価の被減数として消費される。
  畳むと意味がぼやけるため、値の意味で型を分けた。

## 5. バックフィルのサロゲート id は UUIDv7（移行内一時関数で生成）

- **元の計画**: Step 9 で「PG バージョンを実装時に確認し `uuidv7()`／uuidv7 SQL 関数／
  `gen_random_uuid()` を選ぶ」と未確定。
- **当初の実装（誤り）**: `gen_random_uuid()`（v4）を採用し「時系列性不要だから v4 許容」と
  論拠付けた。
- **是正後の実装**: 移行セッション内に一時関数 `pg_temp.gen_uuid_v7()`（Unix epoch ミリ秒を
  先頭48bitに置き version/variant ビットを立てる純 SQL レシピ）を定義し、UUIDv7 を生成する。
  PG16 にネイティブ `uuidv7()` が無いため自前生成。セッション終了で自動破棄しスキーマを汚さない。
- **是正の理由（v4 が誤りだった点）**: `CostPricePeriodId` の基底 `EntityId` は version ニブル
  まで正規表現 `…-7[0-9a-f]{3}-[89ab]…` で UUIDv7 を**形式として強制**する。サロゲートに
  時系列性は不要でも、`CostPriceMapper.toDomain()` → `new CostPricePeriodId(row.id)` のロード
  経路で v4 は「不正なUUIDv7形式です」で弾かれる。テスト（`insert`）と seed（`generateId()`）は
  常に v7 を生むため緑を通過し、v4 を生むのは本番バックフィル SQL のみ＝本番デプロイ後の
  Issue B 読み出しで初めて顕在化する経路非カバーバグだった（PR #469 レビューで指摘）。
- **再発防止**: `PrismaCostPriceRepository.test.ts` に「バックフィル機構（v7生成）で投入した
  期間行をリポジトリでロードできる」回帰テストを追加。v4 に退行させると当該 ValidationError で
  赤になることを確認済み。
