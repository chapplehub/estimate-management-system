# Issue #189: UUIDv7 ID Value Object の導入による型安全なエンティティID — 実装計画

## 概要

全エンティティのIDを生の `string` 型から型付き Value Object（`EmployeeId`, `CustomerId`, `DepartmentId` 等）に置き換え、型安全性を確保する。既存の `StringValueObject` を継承した `EntityId` 基底クラスを作成し、UUIDv7フォーマットバリデーション付きのIDクラスを各サブドメインに導入する。

## 設計判断

### CompanyIdの配置場所
- A. customer サブドメインに配置
- B. shared/domain/values に配置（Customer と DeliveryLocation の両方が使用するため）
- 推奨: B（CompanyCode, CompanyName と同様に共有値オブジェクトとして扱う）

### CustomerIdの配置場所
- A. customer サブドメインのみに配置
- B. shared/domain/values に配置（DeliveryLocation が外部キーとして参照するため）
- 推奨: A（DDDではIDによるサブドメイン間参照は許容。DeliveryLocationからcustomerサブドメインのCustomerIdをimport）

### EntityId.generate() のUUIDv7生成方式
- A. EntityId内で直接 uuid ライブラリを使用
- B. 既存の generateId() を内部で呼び出す
- 推奨: B（既存パターンを踏襲し、変更箇所を最小化）

## ステップ

### Step 1: EntityId基底クラス + 全ID Value Object + テスト作成
- 対象ファイル:
  - `src/server/shared/domain/values/EntityId.ts`（新規）
  - `src/server/shared/domain/values/CompanyId.ts`（新規）
  - `src/server/subdomains/employee/domain/values/EmployeeId.ts`（新規）
  - `src/server/subdomains/customer/domain/values/CustomerId.ts`（新規）
  - `src/server/subdomains/department/domain/values/DepartmentId.ts`（新規）
  - `src/server/subdomains/delivery-location/domain/values/DeliveryLocationId.ts`（新規）
  - `src/server/subdomains/position/domain/values/PositionId.ts`（新規）
  - `src/server/subdomains/role/domain/values/RoleId.ts`（新規）
  - `src/server/shared/domain/values/__tests__/EntityId.test.ts`（新規）
- 作業内容:
  - StringValueObject を継承した EntityId 抽象クラス（UUIDv7正規表現バリデーション）を作成
  - 各サブドメインに具体的なID Value Objectを作成（各クラスに generate() 静的メソッド）
  - EntityId のバリデーション・generate・equals のユニットテスト作成
- コミットメッセージ: feat: EntityId基底クラスと全ID Value Objectを作成

### Step 2: Employee サブドメインの全レイヤー更新
- 対象ファイル:
  - `src/server/subdomains/employee/domain/entities/Employee.ts`
  - `src/server/subdomains/employee/domain/repositories/EmployeeRepository.ts`
  - `src/server/subdomains/employee/infrastructure/mappers/EmployeeMapper.ts`
  - `src/server/subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository.ts`
  - `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
  - `src/server/subdomains/employee/application/commands/*.ts`
  - `src/server/subdomains/employee/application/queries/*.ts`
  - 関連テストファイル
- 作業内容:
  - Employee の _id を EmployeeId、_departmentId を DepartmentId に変更
  - create() で EmployeeId.generate() を使用
  - Repository インターフェースの引数型を更新
  - Mapper, PrismaRepository, QueryService の ID 変換を更新
  - Commands/Queries の入力型と処理を更新
  - テストの更新
- コミットメッセージ: feat: Employeeサブドメインの型安全なID Value Object適用

### Step 3: Department サブドメインの全レイヤー更新
- 対象ファイル:
  - `src/server/subdomains/department/domain/entities/Department.ts`
  - `src/server/subdomains/department/domain/repositories/DepartmentRepository.ts`
  - `src/server/subdomains/department/infrastructure/mappers/DepartmentMapper.ts`
  - `src/server/subdomains/department/infrastructure/prisma/PrismaDepartmentRepository.ts`
  - `src/server/subdomains/department/application/commands/*.ts`
  - `src/server/subdomains/department/application/queries/*.ts`
  - 関連テストファイル
- 作業内容:
  - Department の _id, _parentId を DepartmentId に変更
  - Repository インターフェースとインフラ層の更新
  - Commands/Queries の更新
  - テストの更新
- コミットメッセージ: feat: Departmentサブドメインの型安全なID Value Object適用

### Step 4: Customer サブドメインの全レイヤー更新
- 対象ファイル:
  - `src/server/subdomains/customer/domain/entities/Customer.ts`
  - `src/server/subdomains/customer/domain/repositories/CustomerRepository.ts`
  - `src/server/subdomains/customer/infrastructure/mappers/CustomerMapper.ts`
  - `src/server/subdomains/customer/infrastructure/prisma/PrismaCustomerRepository.ts`
  - `src/server/subdomains/customer/infrastructure/queries/PrismaCustomerQueryService.ts`
  - `src/server/subdomains/customer/application/commands/*.ts`
  - `src/server/subdomains/customer/application/queries/*.ts`
  - 関連テストファイル
- 作業内容:
  - Customer の _id を CustomerId、_companyId を CompanyId に変更
  - Repository インターフェースとインフラ層の更新
  - Commands/Queries の更新
  - テストの更新
- コミットメッセージ: feat: Customerサブドメインの型安全なID Value Object適用

### Step 5: DeliveryLocation サブドメインの全レイヤー更新
- 対象ファイル:
  - `src/server/subdomains/delivery-location/domain/entities/DeliveryLocation.ts`
  - `src/server/subdomains/delivery-location/domain/repositories/DeliveryLocationRepository.ts`
  - `src/server/subdomains/delivery-location/infrastructure/mappers/DeliveryLocationMapper.ts`
  - `src/server/subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository.ts`
  - `src/server/subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService.ts`
  - `src/server/subdomains/delivery-location/application/commands/*.ts`
  - `src/server/subdomains/delivery-location/application/queries/*.ts`
  - 関連テストファイル
- 作業内容:
  - DeliveryLocation の _id を DeliveryLocationId、_companyId を CompanyId、_customerId を CustomerId に変更
  - Repository インターフェースとインフラ層の更新
  - Commands/Queries の更新
  - テストの更新
- コミットメッセージ: feat: DeliveryLocationサブドメインの型安全なID Value Object適用

### Step 6: Position + Role サブドメインの全レイヤー更新
- 対象ファイル:
  - `src/server/subdomains/position/domain/entities/Position.ts`
  - `src/server/subdomains/position/domain/repositories/PositionRepository.ts`
  - `src/server/subdomains/position/infrastructure/mappers/PositionMapper.ts`
  - `src/server/subdomains/position/infrastructure/prisma/PrismaPositionRepository.ts`
  - `src/server/subdomains/role/domain/entities/Role.ts`
  - `src/server/subdomains/role/domain/repositories/RoleRepository.ts`
  - `src/server/subdomains/role/infrastructure/mappers/RoleMapper.ts`
  - `src/server/subdomains/role/infrastructure/prisma/PrismaRoleRepository.ts`
  - `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts`
  - `src/server/subdomains/role/application/commands/*.ts`
  - `src/server/subdomains/role/application/queries/*.ts`
  - 関連テストファイル
- 作業内容:
  - Position の _id, _superiorPositionId を PositionId に変更
  - Role の _id を RoleId、_positionId を PositionId、_superiorRoleId を RoleId に変更
  - Repository インターフェースとインフラ層の更新
  - Commands/Queries の更新
  - テストの更新
- コミットメッセージ: feat: Position+Roleサブドメインの型安全なID Value Object適用

### Step 7: 最終検証
- 対象ファイル: なし（検証のみ）
- 作業内容:
  - pnpm lint 実行
  - pnpm test 実行
  - 問題があれば修正
- コミットメッセージ: （修正があれば）fix: lint/test修正
