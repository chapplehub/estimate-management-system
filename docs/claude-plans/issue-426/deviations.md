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

## 3. 期間行の差分 upsert → 全削除＋identity 再利用の全挿入

- **元の計画**: Step 7「差分 upsert（ADR-0032・identity 保存）」。
- **実際の実装**: `update` 時、トランザクション内で当該商品の期間行を `deleteMany` で全削除し、ドメインが保持する `CommonSellingPricePeriodId` を再利用して全挿入する。
- **理由**: 期間を改定すると区間が動き、行を in-place 更新すると EXCLUDE 制約の瞬間衝突（中間状態での重複）が起こりうる。全削除→全挿入なら中間状態で重複が生じない。ドメインの id を再利用するため行 identity は保たれる（既存の Estimate 集約の子コレクション同期と同型）。`created_at` は再挿入で更新されるが期間行の `created_at` はドメイン的に無意味なため許容。

## 4. SellingUnitPrice の通貨ガードを設けない

- **元の計画**: 「Money（JPY）ベース」。
- **実際の実装**: `fromMoney` で非負ガードのみ。JPY 以外を弾くガードは設けていない。
- **理由**: `Currency` はコンストラクタ private で `JPY` のみ定義された単一通貨システム。JPY 以外の Money を生成する手段が無く、通貨ガードはテスト不能な死にコードになるため（YAGNI）。
