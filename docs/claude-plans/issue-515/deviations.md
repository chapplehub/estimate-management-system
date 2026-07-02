# Issue #515 実装計画からの逸脱記録

計画: `docs/claude-plans/issue-515/set-product-price-cost-guard.md`

## 逸脱1: `ProductCategory.isSet()` を新規追加（計画未記載の前提追加）

- **元の計画**: 3ファクトリで `category.isSet()` を呼ぶ前提だったが、`isSet()` メソッドの追加自体はステップに明記されていなかった。
- **実際の実装**: `ProductCategory` VO に `isSet()`（`this._value === "SET"`）を既存の `canBe*`/`canHave*` 述語群と並べて追加し、専用テスト3件と共に独立コミット（`bf30e23`）した。
- **逸脱の理由**: 既存 VO には `canHaveComponents()`（=SET判定）はあったが、価格ガードの意図を表す命名として `isSet()` が読み手に明快。計画本文（Step 2〜4の作業内容）が `category.isSet()` を前提にしていたため、その前提を満たす最小追加として先行実装した。

## 逸脱2: コマンドテストは「スタブ注入」ではなく「実サービス＋実SET商品」

- **元の計画**: 「既存テストの constructor に非セットを返す `ProductQueryService` スタブを追加。セット商品 `productId` の登録が throw するケースを追加」。
- **実際の実装**: 既存の Register コマンドテストは実 Prisma リポジトリで実商品を insert する統合テストであるため、スタブではなく実 `PrismaProductQueryService` を注入した。セット商品ケースは `ProductCategory.SET` の実商品を別コードで insert して検証する。あわせて「存在しない商品ID → `ValidationError`」ケース（計画の category 取得タイミング節に記載の `findById === null` 分岐）もテスト追加した。
- **逸脱の理由**: 既存テストの統合スタイルにスタブを混ぜると二重管理になり、`findById` の実クエリ経路も検証できない。実サービス＋実データの方が既存慣行と一貫し、ガードの実挙動をエンドツーエンドで確認できる。

## 逸脱3: `create` シグネチャ変更に伴うテストフィクスチャの一括改修（波及範囲）

- **元の計画**: Step 2〜4の対象ファイルとして各集約の「domain / command テスト2ファイル」のみを列挙。
- **実際の実装**: `CostPrice.create` / `CommonSellingPrice.create` / `CustomerSellingPrice.create` の引数に `category` を必須追加したため、当該集約を組む**全テストフィクスチャ**（infra repository / query / list / edit テスト、他コマンドの Revise/Edit/EndDate/Delete テスト、`ResolveSellingPriceQuery` など横断テスト）の生成呼び出しに `ProductCategory.INDIVIDUAL` を補った（各集約コミットに同梱）。
- **逸脱の理由**: 生成入口の構造的不変条件として `category` を必須引数にする設計（計画採用の案①）を選ぶと、コンパイル維持のため全生成箇所の更新が不可避。これらは非セット商品のフィクスチャであり `ProductCategory.INDIVIDUAL` 補完で意味的にも正しい。計画のファイル列挙が生成入口の呼び出し側までは網羅していなかったための機械的追補。

## 逸脱4: 各ドメインテストに「消耗品でも生成できる」ケースを追加

- **元の計画**: ドメインテストは「セット商品区分で `create` が throw / 非セットで成功」。
- **実際の実装**: 非セット成功ケースを個別商品（INDIVIDUAL）に加え消耗品（CONSUMABLE）でも明示。
- **逸脱の理由**: #514 グロッサリの「価格保守対象商品＝個別商品・消耗品」を明文化し、ガードが SET のみを弾き CONSUMABLE を通すことをテストで固定するため。
