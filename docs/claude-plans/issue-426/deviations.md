# Issue #426 実装での計画からの逸脱

計画ファイル `common-selling-price-aggregate-vertical-slice.md` に対する実装中の逸脱を記録する。

## 1. Repository: `save(aggregate, expectedVersion)` → `insert` / `update` 分割

- **元の計画**: Step 6/7 で `findByProductId` / `save(aggregate, expectedVersion)` の2メソッド。
- **実際の実装**: `findByProductId` / `insert(aggregate)` / `update(aggregate, expectedVersion)` の3メソッド。
- **理由**: ADR-0039 が楽観ロックを「リポジトリ insert/update 分割」で横断適用すると定めており、既存の全リポジトリ（Product・DeliveryLocation 等）もこの規約。`save` 単一だと新規/既存の判定をリポジトリが担うことになり既存規約と不整合。新規/編集の判定はユースケース側が持つ。

## 2. 範囲型文字列パーサの自作を回避（lower()/upper() 展開）

- **元の計画**: ADR-0067・計画 Step 7 で「範囲型文字列 `[2025-07-01,)` のパーサ自作」を想定。
- **実際の実装**: 読み出しを `lower(applicable_period)::text` / `upper(applicable_period)::text` の別カラムに展開し、合成文字列パーサを書かなかった（上端 unbounded は `upper()` が NULL を返すのでそのまま `end=null`）。
- **理由**: 合成文字列パース（境界記号・empty・上端/下端 unbounded のエッジ）を自前で持つより、PostgreSQL の `lower`/`upper` 関数に展開を委ねる方が単純で誤りが入りにくい。書き込み側は計画どおり `daterange($from,$to,'[)')` を生成。

## 3. 期間行の差分 upsert → append-only 同期（ON CONFLICT DO NOTHING）

- **元の計画**: Step 7「差分 upsert（ADR-0032・identity 保存）」。
- **当初の実装**: `update` 時、トランザクション内で当該商品の期間行を `deleteMany` で全削除し、ドメインが保持する `CommonSellingPricePeriodId` を再利用して全挿入していた。
- **最終的な実装（PR #449 レビュー #4 対応）**: `deleteMany` を撤去し、`writePeriods` の `INSERT` を `ON CONFLICT (id) DO NOTHING` にして、既存行は no-op・新規 id のみ挿入する append-only 同期へ簡約した。
- **理由**: ドメインの変更操作は `addPeriod`（追加）のみで、子 `CommonSellingPricePeriod` はセッターを持たず id 単位で内容不変。`reconstruct` が DB 全行を集約に載せ `addPeriod` は足すだけなので、集約は常に DB の id を包含し「DB にあって集約に無い id（=削除）」は発生しえず、DELETE 分岐・in-place UPDATE は到達不能な死にコードだった。全削除→全挿入は未変更行の `updated_at` までリセットしてしまうが、価格行の `updated_at` は監査的意味を持つため動かしたくない（レビュー #4）。append-only なら既存行に一切触れず `updated_at` を保持できる。EXCLUDE の瞬間衝突は、既存行を触らず追加行が最終集合に対し非重複（ドメイン保証）のため起きず、deferrable 化も不要（migration 変更なし）。DELETE 分岐は #429 が `removePeriod` を実装するときにテスト付きで追加する。

## 5. insert のエラー契約 — P2002 のみ ConflictError へ翻訳（PR #449 レビュー #1）

- **元の計画**: 明示なし（insert は単純作成）。
- **実際の実装**: `insert` を try/catch し、親 `common_selling_prices` の PK（`product_id`）衝突 P2002 を `ConflictError` へ翻訳する（既存 `translateInsertConflict` と同型）。期間行の EXCLUDE 違反（23P01）は翻訳しない。
- **理由**: `update` は version 不一致で `ConflictError` を返すのに insert は生の `PrismaClientKnownRequestError` を伝播しており契約が非対称だった。アプリ層の存在チェックをすり抜けた二重作成レースは親 PK 衝突として表面化するため翻訳する。一方 EXCLUDE は、insert が親 PK・update が version 条件付き updateMany で同一商品の並行書き込みを直列化するため公開 API からは到達不能で、トリガーするテストが書けず死にコードになる（通貨ガード省略と同じ YAGNI 判断軸）。DB 側の最後の砦として残す。

## 6. Money 読み出しの精度 — `Money.fromDecimalString` 新設・読み出しのみ修正（PR #449 レビュー #3）

- **元の計画**: 明示なし（`::text` で受けた `selling_price` を `SellingUnitPrice.fromMajorUnits(Number(...))` で復元）。
- **実際の実装**: `Money.fromDecimalString(value, currency)` を新設し、Mapper の読み出しを `SellingUnitPrice.fromMoney(Money.fromDecimalString(row.sellingPrice))` に変更。書き込みの `money.majorUnits.toFixed(scale)` は現状維持。
- **理由**: `Number("...")` は値域上限帯（約100億円弱の単価）で `fromMajorUnits` の厳密ガード（`|minor-round| > 1e-6`）に引っかかり再構成が `InvalidArgumentError` で失敗しうる（実測。データ破壊はなく loud fail）。`::text` の精度保持意図を `Number()` が打ち消していたため、文字列を float 非経由で最小単位整数へ分解する厳密ファクトリを `Money` に集約した。書き込みは整数 minorUnits 由来で `toFixed` が厳密なため触らない（過剰回避）。

## 7. 価格 VO は常に `Money` を引数に取る — `SellingUnitPrice.fromMajorUnits` 削除（レビュー派生）

- **元の計画**: 明示なし。
- **実際の実装**: `SellingUnitPrice.fromMajorUnits(number)` を削除し、生成口を `fromMoney(Money)` のみにした。
- **理由**: #6 修正後は production の唯一の呼び出し元（Mapper）が `fromMoney` 経由になり production 呼び出しがゼロになった。`fromMajorUnits` は `Money` の number ドアを VO 層で二重に開けるだけなので、number↔金額の変換と精度ガードは `Money`（`fromMajorUnits`/`fromDecimalString`）に集約し、価格 VO は受け取った `Money` に「非負」不変条件だけを課す。横断原則として `learning/price-value-objects-take-money.md` に記録し、同じ罠を踏む `CostPrice` の是正を #447 へ引き継いだ。

## 4. SellingUnitPrice の通貨ガードを設けない

- **元の計画**: 「Money（JPY）ベース」。
- **実際の実装**: `fromMoney` で非負ガードのみ。JPY 以外を弾くガードは設けていない。
- **理由**: `Currency` はコンストラクタ private で `JPY` のみ定義された単一通貨システム。JPY 以外の Money を生成する手段が無く、通貨ガードはテスト不能な死にコードになるため（YAGNI）。
