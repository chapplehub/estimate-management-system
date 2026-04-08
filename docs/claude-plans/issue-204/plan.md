# Issue #204: 商品マスタのバックエンド実装 — 実装計画

## 概要

商品(Product)サブドメインのDDDバックエンド実装。Prismaスキーマ、ドメイン層（値オブジェクト、エンティティ、リポジトリインターフェース、ドメインサービス）、アプリケーション層（コマンド、クエリ）、インフラストラクチャ層（Prismaリポジトリ、マッパー、クエリサービス）をTDD方式で実装する。

商品区分（個別商品 / 消耗品 / セット商品）ごとの制約、周辺商品設定、セット商品構成管理、商品無効化時の入れ替え機能を含む。

## 設計判断

### ProductRelation / SetProductComponent のモデリング
- A. Product集約ルートの内部コレクション（値オブジェクトの配列）として埋め込む
- B. 独立したEntityとして別リポジトリで管理する
- 推奨: A（設計書でProduct集約ルートの内部コレクションとして設計されている。saveで一括永続化、reconstruct時に一緒にロードする）

### ProductCategory / ProductUnit の表現
- A. TypeScript enum + ValueObjectラップ（振る舞いメソッド付き）
- B. 文字列リテラルユニオン型のみ
- 推奨: A（設計書にcanHaveRelatedProducts()等のビジネスロジックメソッドが定義されている。振る舞いを持たせるにはVOラップが必要）

### ドメインサービスの重複チェック: excludeId パラメータ
- A. 既存パターン通りbooleanのみ返す（excludeIdなし）— 更新時はCommand側でIDを比較
- B. excludeIdを受け取り、自身を除外してチェックする
- 推奨: B（設計書に明記。更新時にコード・名前変更が可能なため、自分自身を重複として誤検出しないためにexcludeIdが必要）

### existsInEstimateOrOrder の実装
- EstimateモデルがまだPrismaスキーマに存在しない
- 推奨: リポジトリインターフェースには定義し、インフラ実装では常にfalseを返すスタブとする。Estimate実装時に更新

### replaceInRelationsAndComponents のトランザクション管理
- A. リポジトリ内でPrisma.$transactionを使用
- B. アプリケーション層でトランザクションを管理
- 推奨: A（リポジトリ内で$transactionを使用。設計書にも「トランザクション内で一括実行」と記載）

### ProductRelation / SetProductComponent VOのcategory保持
- A. reconstruct時にProductテーブルをJOINしてcategoryを取得し、VOフィールドとして保持
- B. VOにcategoryを持たせず、設定時のバリデーションのみ
- 決定: A（エンティティ内でカテゴリ制約を常に参照可能にする）

### SET商品のcostPrice処理
- A. create()/changeCostPrice()時にcategory=SETなら強制的にCostPrice(0)を設定
- B. 0以外が渡された場合はエラー
- 決定: A（引数を無視して常に0を維持。changeCostPrice()もSETなら無視）

### ProductReplacementDomainServiceの責務分離
- A. ドメインサービスは妥当性検証(B013-B015)のみ、実際の入れ替えはCommand→Repository
- B. ドメインサービスが検証+実行を両方担当
- 決定: A（DSはバリデーションに専念、Commandがdeactivate + replaceをオーケストレーション）

## ステップ

### Step 1: Prismaスキーマ追加 + マイグレーション
- 対象ファイル:
  - `prisma/schema.prisma`
- 作業内容:
  - `ProductCategory` enum を追加（INDIVIDUAL, CONSUMABLE, SET）
  - `ProductUnit` enum を追加（UNIT, PIECE, ROLL, BOX, SHEET, SET）
  - `Product` model を追加（id, code, name, category, description, note, unit, costPrice, isActive, timestamps）
  - `ProductRelation` model を追加（productId, relatedProductId, quantity, 複合PK）
  - `SetProductComponent` model を追加（setProductId, componentProductId, quantity, 複合PK）
  - マイグレーション実行 + クライアント再生成
- コミットメッセージ: `feat: 商品マスタのPrismaスキーマ追加 (#204)`

### Step 2: 基本Value Objects（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/domain/values/__tests__/ProductCode.test.ts`
  - `src/server/subdomains/product/domain/values/__tests__/ProductName.test.ts`
  - `src/server/subdomains/product/domain/values/__tests__/CostPrice.test.ts`
  - `src/server/subdomains/product/domain/values/__tests__/ComponentQuantity.test.ts`
  - `src/server/subdomains/product/domain/values/ProductId.ts`
  - `src/server/subdomains/product/domain/values/ProductCode.ts`
  - `src/server/subdomains/product/domain/values/ProductName.ts`
  - `src/server/subdomains/product/domain/values/ProductDescription.ts`
  - `src/server/subdomains/product/domain/values/ProductNote.ts`
  - `src/server/subdomains/product/domain/values/CostPrice.ts`
  - `src/server/subdomains/product/domain/values/ComponentQuantity.ts`
- 作業内容:
  - テスト先行: ProductCode（英数字のみ、max50、大文字変換+trim、V001-V003）、ProductName（max100、trim、V004-V005）、CostPrice（0以上、小数2桁）、ComponentQuantity（正整数、V008）
  - 実装: ProductId（EntityId継承）、ProductCode（StringValueObject、REGEX=/^[A-Z0-9]+$/）、ProductName（StringValueObject）、ProductDescription/ProductNote（任意フィールド、テスト不要）、CostPrice（ValueObject<number>）、ComponentQuantity（ValueObject<number>）
- コミットメッセージ: `feat: 商品ドメインの基本Value Objects実装 (TDD) (#204)`

### Step 3: Enum Value Objects（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/domain/values/__tests__/ProductCategory.test.ts`
  - `src/server/subdomains/product/domain/values/ProductCategory.ts`
  - `src/server/subdomains/product/domain/values/ProductUnit.ts`
- 作業内容:
  - テスト先行: ProductCategory — INDIVIDUAL/CONSUMABLE/SET生成、canHaveRelatedProducts()（INDIVIDUALのみtrue）、canHaveComponents()（SETのみtrue）、canBeRelatedProduct()（SET以外true）、canBeComponent()（SET以外true）、不正値エラー
  - 実装: ProductCategory（ValueObject<string>、静的インスタンス、from()ファクトリ、ビジネスロジックメソッド4つ）、ProductUnit（ValueObject<string>、静的インスタンス、from()ファクトリ、label()で日本語ラベル）
  - ProductUnitのテストは任意（ロジックが薄い）
- コミットメッセージ: `feat: 商品区分・単位のEnum Value Objects実装 (TDD) (#204)`

### Step 4: コレクションValue Objects + Productエンティティ（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/domain/values/ProductRelation.ts`
  - `src/server/subdomains/product/domain/values/SetProductComponent.ts`
  - `src/server/subdomains/product/domain/entities/__tests__/Product.test.ts`
  - `src/server/subdomains/product/domain/entities/Product.ts`
- 作業内容:
  - ProductRelation VO: relatedProductId, relatedProductCategory, quantity。カテゴリ制約チェック（SET不可 — B004）
  - SetProductComponent VO: componentProductId, componentProductCategory, quantity。カテゴリ制約チェック（SET不可 — B007）
  - テスト先行: Product エンティティ — create()、reconstruct()、SET商品はcostPrice常に0、changeName/Code/Unit/CostPrice/Description/Note、activate()/deactivate()（B009/B010）、setRelatedProducts()（B003/B005/重複）、setComponents()（B006/重複）
  - 実装: Product エンティティ — private constructor、create()/reconstruct()、ENTITY_NAME="商品"、全ゲッター、全mutationメソッド
- コミットメッセージ: `feat: Productエンティティ + コレクションValue Objects実装 (TDD) (#204)`

### Step 5: リポジトリインターフェース + インフラストラクチャ層
- 対象ファイル:
  - `src/server/subdomains/product/domain/repositories/ProductRepository.ts`
  - `src/server/subdomains/product/infrastructure/mappers/ProductMapper.ts`
  - `src/server/subdomains/product/infrastructure/prisma/PrismaProductRepository.ts`
- 作業内容:
  - ProductRepository インターフェース定義: save, delete, findById, findByCode, findByName, existsInEstimateOrOrder, findReferencingProducts, replaceInRelationsAndComponents
  - ProductMapper: toDomain()（Prisma → Entity、relations/components含む）、toPrismaCreate()、toPrismaUpdate()
  - PrismaProductRepository: 全メソッド実装。save()はupsert + relations/componentsの削除+再作成（$transaction）。existsInEstimateOrOrderは常にfalse（スタブ）。replaceInRelationsAndComponentsは$transaction内で一括置換
  - テスト不要（既存プロジェクトのインフラ層テスト方針に従う）
- コミットメッセージ: `feat: 商品リポジトリインターフェース + インフラストラクチャ層実装 (#204)`

### Step 6: ドメインサービス（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/domain/services/__tests__/ProductCodeDuplicationCheckDomainService.test.ts`
  - `src/server/subdomains/product/domain/services/__tests__/ProductNameDuplicationCheckDomainService.test.ts`
  - `src/server/subdomains/product/domain/services/__tests__/ProductReplacementDomainService.test.ts`
  - `src/server/subdomains/product/domain/services/ProductCodeDuplicationCheckDomainService.ts`
  - `src/server/subdomains/product/domain/services/ProductNameDuplicationCheckDomainService.ts`
  - `src/server/subdomains/product/domain/services/ProductDeletionCheckDomainService.ts`
  - `src/server/subdomains/product/domain/services/ProductReplacementDomainService.ts`
- 作業内容:
  - テスト先行（実DB + PrismaProductRepository使用、既存パターン踏襲）:
    - ProductCodeDuplicationCheck: 重複なしfalse、重複ありtrue、excludeId指定時の自己除外
    - ProductNameDuplicationCheck: 重複なしfalse、重複ありtrue、excludeId指定時の自己除外
    - ProductReplacementDomainService: 正常入れ替え、無効商品エラー(B013)、SET商品エラー(B014)、重複エラー(B015)
    - ProductDeletionCheck: テスト不要（Estimate未実装のため常にtrue）
  - 実装:
    - ProductCodeDuplicationCheck: `execute(code, excludeId?)` — findByCodeして存在確認、excludeIdと一致なら除外
    - ProductNameDuplicationCheck: `execute(name, excludeId?)` — findByNameして存在確認
    - ProductDeletionCheck: `execute(id)` — existsInEstimateOrOrder呼び出し
    - ProductReplacementDomainService: `validate(replacement, referencingProducts)` — 有効チェック、SET不可チェック、重複チェック
- コミットメッセージ: `feat: 商品ドメインサービス実装 (TDD) (#204)`

### Step 7: 基本コマンド — Create / Update / Delete（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/application/commands/__tests__/CreateProductCommand.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/UpdateProductCommand.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/DeleteProductCommand.test.ts`
  - `src/server/subdomains/product/application/commands/CreateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/UpdateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/DeleteProductCommand.ts`
- 作業内容:
  - テスト先行（実DB使用）:
    - Create: 必須のみ、全項目、コード重複(B001)、名前重複(B002)、SET商品costPrice=0確認
    - Update: 正常更新、存在しない商品エラー(NotFoundEntityError)、区分変更不可(B011)、コード/名前重複チェック
    - Delete: 正常削除、存在しない商品エラー、見積使用中エラー(B008、現時点では常に削除可)
  - 実装:
    - Create: input → VO生成 → 重複チェック → Entity.create → save
    - Update: findById → 存在チェック → カテゴリ変更不可チェック → 重複チェック(excludeId) → mutation → save
    - Delete: findById → 存在チェック → canDelete → delete
- コミットメッセージ: `feat: 商品CRUD基本コマンド実装 (Create/Update/Delete, TDD) (#204)`

### Step 8: 有効化/無効化コマンド（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/application/commands/__tests__/ActivateProductCommand.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/DeactivateProductCommand.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/DeactivateProductWithReplacementCommand.test.ts`
  - `src/server/subdomains/product/application/commands/ActivateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/DeactivateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/DeactivateProductWithReplacementCommand.ts`
- 作業内容:
  - テスト先行:
    - Activate: 正常有効化、存在しないエラー、すでに有効(B009)
    - Deactivate: 正常無効化、存在しないエラー、すでに無効(B010)
    - DeactivateWithReplacement: 正常(無効化+入れ替え)、入れ替え先がSET(B014)、入れ替え先が無効(B013)、重複(B015)
  - 実装:
    - Activate: findById → activate() → save
    - Deactivate: findById → deactivate() → save
    - DeactivateWithReplacement: findById(対象) → findByCode(入れ替え先) → findReferencingProducts → validate → deactivate → replaceInRelationsAndComponents → save
- コミットメッセージ: `feat: 商品有効化/無効化コマンド実装 (TDD) (#204)`

### Step 9: 周辺商品/セット構成設定コマンド（TDD）
- 対象ファイル:
  - `src/server/subdomains/product/application/commands/__tests__/SetProductRelationsCommand.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/SetProductComponentsCommand.test.ts`
  - `src/server/subdomains/product/application/commands/SetProductRelationsCommand.ts`
  - `src/server/subdomains/product/application/commands/SetProductComponentsCommand.ts`
- 作業内容:
  - テスト先行:
    - SetProductRelations: 正常設定、個別商品以外エラー(B003)、SET商品指定エラー(B004)、自己参照エラー(B005)、存在しない商品エラー
    - SetProductComponents: 正常設定、SET以外エラー(B006)、SET商品指定エラー(B007)、存在しない商品エラー
  - 実装:
    - SetProductRelations: findById(設定元) → 各relatedProductのfindById → Entity.setRelatedProducts → save
    - SetProductComponents: findById(セット) → 各componentのfindById → Entity.setComponents → save
- コミットメッセージ: `feat: 周辺商品/セット構成設定コマンド実装 (TDD) (#204)`

### Step 10: クエリ層 + ファクトリ
- 対象ファイル:
  - `src/server/subdomains/product/application/queries/dto/ProductDTO.ts`
  - `src/server/subdomains/product/application/queries/dto/ProductSearchCriteria.ts`
  - `src/server/subdomains/product/application/queries/ProductQueryService.ts`（インターフェース）
  - `src/server/subdomains/product/application/queries/GetProductByIdQuery.ts`
  - `src/server/subdomains/product/application/queries/SearchProductsQuery.ts`
  - `src/server/subdomains/product/application/queries/__tests__/GetProductByIdQuery.test.ts`
  - `src/server/subdomains/product/application/queries/__tests__/SearchProductsQuery.test.ts`
  - `src/server/subdomains/product/infrastructure/queries/PrismaProductQueryService.ts`
  - `src/server/subdomains/product/application/factories/*.ts`（全コマンド/クエリのファクトリ + index.ts）
- 作業内容:
  - DTO定義: ProductDTO（id, code, name, category, description, note, unit, costPrice, isActive, relatedProducts, setComponents, timestamps）、ProductSearchCriteria（code部分一致、name部分一致、category、isActive）、ListOptions
  - ProductQueryServiceインターフェース: findById, search
  - テスト先行（実DB）: GetProductByIdQuery（取得、存在しない場合null）、SearchProductsQuery（各フィルタ、ページネーション）
  - PrismaProductQueryService実装: findById（relations/components含む）、search（where句構築、ソート、ページネーション）
  - 全ファクトリ関数: Composition Rootパターン（PrismaRepository + DomainService → Command/Query生成）
- コミットメッセージ: `feat: 商品クエリ層 + ファクトリ実装 (TDD) (#204)`

## 検証方法

各ステップ完了時:
- `pnpm test` で全テストパス確認
- `pnpm lint` でエラーなし確認

最終確認:
- `pnpm db:generate` でエラーなし
- `pnpm db:migrate` で正常にマイグレーション適用
- `pnpm test` で全テストパス
- `pnpm lint` でエラーなし
- DDD レイヤリングルール違反なし（Domain層がInfraに依存しない）
