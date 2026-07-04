# Issue #546 実装 逸脱記録

計画（`delivery-location-selling-price-read-model.md`）からの逸脱および、計画時に確定した非自明な設計判断を記録する（CLAUDE.md「Record deviations from plan」）。

## 1. 納品先セレクタ用の候補クエリを新規実装しなかった

- **元の計画内容**: 親 Issue #544 のスコープ第4項に「納品先セレクタ用の候補クエリ」が挙がっており、pricing 側に候補クエリを新設する余地があった。
- **実際の実装内容**: 候補クエリを一切新規実装していない。既存の `SearchDeliveryLocationsQuery`（`searchDeliveryLocationsForSelection(customerId, criteria)` / `searchCustomersForSelection(criteria)`）を流用して満たすこととし、本イシューでは BE コードを追加しなかった。
- **逸脱の理由**: 納品先の検索は納品先サブドメインの責務（DDD レイヤリング）であり、pricing 側に候補クエリを置くのは責務の越境になる。既存の選択アクションが「得意先→納品先」の2段選択を両段ともカバー済みで、`DeliveryLocationSearchCriteria.customerId` はオプショナルのため横断・得意先スコープの両モードに対応する。したがって新規 BE コードは不要と明示的に判断した。実機動線は消費側 #547/#548 の FE で既存アクションを呼び出す。

## 2. 一覧封筒・編集 DTO に親得意先 identity を同梱した（計画時の設計判断）

- **元の計画内容（ミラー元の形状）**: 得意先別 #506 の `CustomerSellingPriceListDTO` / `CustomerSellingPriceEditDTO` は、指定エンティティ（得意先）＋商品の identity のみを載せる。
- **実際の実装内容**: 納品先版では、納品先自身の identity に加え**親得意先の identity（`customerId` / `customerCode` / `customerName`）** を封筒・編集 DTO の双方に同梱した。Prisma 実装は `deliveryLocation.customer` リレーションを `select` して解決する。得意先別 #506 からの唯一の実質的な形状差。
- **理由**: 納品先は親得意先の文脈が無いと保守画面ヘッダで意味を成さず（`DeliveryLocation` が既に customer リレーションをモデル化済み）、FE 側の code→id 二重取得を避ける（#473 素描画方針）。編集 DTO は3エンティティ（納品先・商品・親得意先）が載るため、有効フラグは接頭辞命名（`deliveryLocationIsActive` / `productIsActive`）で自己記述性を確保した。親得意先の有効フラグは保守判断の材料にならないため同梱しない。

## 3. 一覧の対比列は共通単価のみ併記（確定した設計判断）

- 得意先別 + 共通の両方併記や対比なしではなく、**共通単価のみ併記**（`currentCommonSellingPrice`）を採用。
- **理由**: 納品先宛の価格解決連鎖は `PriceResolutionPolicy` で **`納品先別 ?? 共通`**。得意先別は連鎖に入らない（`SellingPriceResolutionTarget` の宛先分岐で排他）。DTO を実連鎖と一致させ意味論のズレを排除する。得意先別 #506 と同型。
