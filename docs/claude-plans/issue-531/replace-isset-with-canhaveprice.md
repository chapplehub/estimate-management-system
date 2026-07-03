# Issue #531: refactor: ProductCategoryのisSetをcanHavePriceに置き換える — 実装計画

## 背景・目的（Context）

#515 で価格集約（共通売単価・原価・得意先別）の `create` 生成ガードに `category.isSet()` を使い、セット商品への価格登録を拒否している。しかしこのガードの**本当の責務は「その商品が価格（単価・原価）を持てるか」の判別**であり、「セット商品かどうか」という種別判定は責務の代理にすぎない。#514 で既に `canHavePrice()`（`PRICEABLE_VALUES` = INDIVIDUAL/CONSUMABLE を単一の真実源として参照）が実装済みなので、こちらに置き換えるのが的を射ている。

現行3区分では `isSet()` と `!canHavePrice()` は動作同値だが、将来「価格を持てない新区分」が増えたとき、生成ガードとして正しく拒否できるのは `canHavePrice()` 側。真実源の一元化と責務表現の是正を目的とする、振る舞いを変えないリファクタリング。

あわせて、#515 で「4集約横断」と謳いつつ生成ガードが未実装だった **納品先別販売単価（DeliveryLocationSellingPrice）にもガードを追加**し、4集約を対称化する（ユーザー確認済み方針）。

## 設計判断

### `isSet()` メソッドの扱い
- 置き換え後 `isSet()` の実使用は消える。**メソッド本体・テスト（3ケース）とも削除**する（ユーザー確認済み）。真実源を `canHavePrice()` / `PRICEABLE_VALUES` に一元化する。

### 生成ガードのエラーメッセージ
- 現状「セット商品には{ENTITY}を登録できません」を**維持**する（ユーザー確認済み）。現行区分では拒否対象がSETのみのため文言は正確。よって既存ガードテスト（3集約分）はアサーション変更なしで通過する。

### 納品先別のガード追加の実効範囲
- `DeliveryLocationSellingPrice.create()` に `category: ProductCategory` を必須引数として追加し、他3集約と対称化する。ただし**納品先別には Register コマンド（アプリ層の登録経路）が未実装**のため、本番コードに `create()` の呼び出し元は存在しない。したがって本Issueでの追加は「create署名＋ガード＋ドメイン/インフラテストの更新」に留まり、実効的な保護経路は将来 DL Register 実装時に有効化される（予防的な対称化）。

### DDDレイヤリング
- 変更は Domain 層（ProductCategory VO と4集約エンティティ）に閉じる。区分は集約越えの事実のためアプリ層がライブ取得してドメインへ引数で渡す既存方式（ADR-0030）を踏襲。新規のレイヤ違反なし。

## ステップ

### Step 1: 既存3集約の生成ガードを canHavePrice ベースに置き換え
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`（L39）
  - `src/server/subdomains/pricing/domain/entities/CostPrice.ts`（L40）
  - `src/server/subdomains/pricing/domain/entities/CustomerSellingPrice.ts`（L46）
- 作業内容:
  - 各 `create()` 内の `if (category.isSet())` を `if (!category.canHavePrice())` に置換
  - エラーメッセージは現状維持
  - JSDoc コメントの「#515」参照・文言を責務ベース（価格を持てない商品を生成入口で拒否）に微修正（意味は維持）
  - 3集約のテストがガード挙動（SET拒否・非SET許可）を担保していることを確認（アサーション変更不要の想定）
- コミットメッセージ: `refactor: 価格3集約の生成ガードを isSet から canHavePrice に置換 (#531)`

### Step 2: 納品先別販売単価にも canHavePrice ガードを追加
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/DeliveryLocationSellingPrice.ts`
  - テスト呼び出し側（`create` にcategory引数追加のため更新）:
    - `.../domain/entities/__tests__/DeliveryLocationSellingPrice.test.ts`
    - `.../infrastructure/prisma/__tests__/PrismaDeliveryLocationSellingPriceRepository.test.ts`
    - `.../infrastructure/queries/__tests__/PrismaDeliveryLocationSellingPriceQueryService.test.ts`
    - `.../application/queries/__tests__/ResolveSellingPriceQuery.test.ts`
    - `.../application/queries/__tests__/ResolveDeliveryLocationSellingPriceQuery.test.ts`
- 作業内容:
  - `create(deliveryLocationId, productId)` → `create(deliveryLocationId, productId, category: ProductCategory)` に変更し、`if (!category.canHavePrice())` ガードを追加（他3集約と同型のJSDoc・エラーメッセージ「セット商品には納品先別販売単価を登録できません」）
  - 既存の全 `create` 呼び出しに `ProductCategory.INDIVIDUAL` 等の非セット区分を渡すよう更新
  - DL集約テストに「SET拒否・非SET許可」ケースを追加
- コミットメッセージ: `feat: 納品先別販売単価の生成ガードを追加し価格4集約を対称化 (#531)`

### Step 3: ProductCategory の isSet メソッドとテストを削除
- 対象ファイル:
  - `src/server/subdomains/product/domain/values/ProductCategory.ts`（L93-96）
  - `src/server/subdomains/product/domain/values/__tests__/ProductCategory.test.ts`（L120-134 の isSet 3ケース）
- 作業内容:
  - 未使用になった `isSet()` メソッド定義を削除
  - 対応する isSet テスト3ケースを削除
  - `canHavePrice()` / `priceableValues()` のテストが引き続き責務を担保していることを確認
- コミットメッセージ: `refactor: 未使用になった ProductCategory.isSet を削除 (#531)`

## 検証（Verification）

- `pnpm test` — 変更した4集約・ProductCategory・関連アプリ/インフラテストが全て通過すること
  - 特に3集約の既存ガードテスト（SET拒否）がアサーション変更なしで緑であること（＝振る舞い不変の確認）
  - DL集約に追加したガードテスト（SET拒否・非SET許可）が通過すること
- `pnpm lint` — 型エラー・未使用importなし
- `grep -rn "isSet" src` — 参照が完全に消えていること（メソッド・テスト・コメント）
- （任意）`grep -rn "canHavePrice" src` — 4集約すべてがガードに `canHavePrice` を使う状態に揃っていること
