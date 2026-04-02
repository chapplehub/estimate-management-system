# Issue #89: 未使用Query クラスの整理（GetAll, Count, executeWithPagination等）

## Context

Employee サブドメインのフロントエンド実装実績から、実際に利用される Query パターンは `SearchXXXQuery`（一覧+検索）と `GetXXXByIdQuery` / `GetXXXByCodeQuery`（詳細取得）の2種のみであることが判明。`GetAllXxxQuery`、`CountXxxQuery`、`GetEmployeeByEmailQuery`、`GetDeliveryLocationsByCustomerIdQuery` はプロダクションコードで未使用。

さらに Issue #110 で TanStack Table を導入しフロントエンドでページネーションする方針になったため、`SearchXxxQuery.executeWithPagination()` もプロダクション未使用。連鎖的に `QueryService.count()` と共有型 `PaginatedResult.ts` も不要になる。

YAGNI 原則に基づきこれらを削除する。副次効果として `PrismaCustomerQueryService.findAll()` の `company.type` フィルタ欠落バグも解消。

## 削除対象

### A. 未使用 Query クラス（ファイルごと削除）

| # | クラス | 代替手段 |
|---|--------|----------|
| 1 | `GetAllEmployeesQuery` | `SearchEmployeesQuery` に `criteria: {}` |
| 2 | `CountEmployeesQuery` | 不要（サーバーサイド count 自体が不要） |
| 3 | `GetEmployeeByEmailQuery` | プロダクション未使用 |
| 4 | `GetAllCustomersQuery` | `SearchCustomersQuery` に `criteria: {}` |
| 5 | `GetDeliveryLocationsByCustomerIdQuery` | `SearchDeliveryLocationsQuery` に `criteria: { customerId }` |

### B. executeWithPagination / count（全4サブドメイン）

| 対象 | Employee | Customer | DeliveryLocation | Department |
|------|----------|----------|------------------|------------|
| `SearchXxxQuery.executeWithPagination` | 削除 | 削除 | 削除 | 削除 |
| `SearchXxxPaginatedInput` 型 | 削除 | 削除 | 削除 | 削除 |
| `QueryService.count()` | 削除 | 削除 | 削除 | 削除 |
| `PrismaXxxQueryService.count()` | 削除 | 削除 | 削除 | 削除 |
| テストの executeWithPagination ブロック | 削除 | 削除 | 削除 | 削除 |

### C. 共有コード

| ファイル | 理由 |
|----------|------|
| `src/server/shared/queries/PaginatedResult.ts` | 全参照消滅 |

### D. Department 特記事項

- `GetAllDepartmentsQuery` は `departments/page.tsx` で**実使用中** → **維持**
- `findAll()` も維持（`GetAllDepartmentsQuery` が使用）

## 確認済み事項

- `count()` の呼び出し元は `executeWithPagination` 内部のみ（4サブドメイン全て）
- `findAll()` の呼び出し元は `GetAllXxxQuery` のみ（Employee/Customer/DeliveryLocation は削除、Department は維持）
- `findByEmail()` は `GetEmployeeByEmailQuery` のみ使用（`MailAddressDuplicationCheckDomainService` は `EmployeeRepository.findByEmail()` を使うため別物）
- `findByCustomerId()` は `GetDeliveryLocationsByCustomerIdQuery` のみ使用
- Employee にはクエリ用 Factory ファイルなし
- queries ディレクトリに barrel export (index.ts) なし
- `PaginatedResult` / `PaginationOptions` は 4つの SearchXxxQuery.ts からのみ import

---

## 実装ステップ

### Step 1: Employee 未使用 Query 削除

**削除 (6件):**
- `src/server/subdomains/employee/application/queries/GetAllEmployeesQuery.ts`
- `src/server/subdomains/employee/application/queries/CountEmployeesQuery.ts`
- `src/server/subdomains/employee/application/queries/GetEmployeeByEmailQuery.ts`
- `src/server/subdomains/employee/application/queries/__tests__/GetAllEmployeesQuery.test.ts`
- `src/server/subdomains/employee/application/queries/__tests__/CountEmployeesQuery.test.ts`
- `src/server/subdomains/employee/application/queries/__tests__/GetEmployeeByEmailQuery.test.ts`

### Step 2: EmployeeQueryService クリーンアップ

**編集:**
- `src/server/subdomains/employee/application/queries/EmployeeQueryService.ts`
  - `findByEmail()` 宣言を削除
  - `findAll()` 宣言を削除
  - `count()` 宣言を削除
  - 残す: `findById`, `findByEmployeeCd`, `search`
- `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
  - `findByEmail()` 実装を削除
  - `findAll()` 実装を削除
  - `count()` 実装を削除
- `src/server/subdomains/employee/application/queries/SearchEmployeesQuery.ts`
  - `executeWithPagination()` メソッドを削除
  - `SearchEmployeesPaginatedInput` 型を削除
  - `PaginatedResult`, `PaginationOptions` の import を削除
- `src/server/subdomains/employee/application/queries/__tests__/SearchEmployeesQuery.test.ts`
  - `executeWithPagination` の describe ブロックを削除

### Step 3: Customer 未使用 Query 削除 + Factory 更新

**削除 (2件):**
- `src/server/subdomains/customer/application/queries/GetAllCustomersQuery.ts`
- `src/server/subdomains/customer/application/queries/__tests__/GetAllCustomersQuery.test.ts`

**編集:**
- `src/server/subdomains/customer/application/factories/customerQueryFactory.ts`
  - `GetAllCustomersQuery` import と `getAllCustomersQueryFactory()` 関数を削除
- `src/server/subdomains/customer/application/factories/index.ts`
  - export から `getAllCustomersQueryFactory` を削除

### Step 4: CustomerQueryService クリーンアップ

**編集:**
- `src/server/subdomains/customer/application/queries/CustomerQueryService.ts`
  - `findAll()` と `count()` 宣言を削除
  - 残す: `findById`, `findByCode`, `search`
- `src/server/subdomains/customer/infrastructure/queries/PrismaCustomerQueryService.ts`
  - `findAll()` と `count()` 実装を削除
- `src/server/subdomains/customer/application/queries/SearchCustomersQuery.ts`
  - `executeWithPagination()` メソッドと `SearchCustomersPaginatedInput` 型を削除
  - `PaginatedResult`, `PaginationOptions` の import を削除
- `src/server/subdomains/customer/application/queries/__tests__/SearchCustomersQuery.test.ts`
  - `executeWithPagination` の describe ブロックを削除

### Step 5: DeliveryLocation 未使用 Query 削除 + Factory 更新

**削除 (2件):**
- `src/server/subdomains/delivery-location/application/queries/GetDeliveryLocationsByCustomerIdQuery.ts`
- `src/server/subdomains/delivery-location/application/queries/__tests__/GetDeliveryLocationsByCustomerIdQuery.test.ts`

**編集:**
- `src/server/subdomains/delivery-location/application/factories/deliveryLocationQueryFactory.ts`
  - `GetDeliveryLocationsByCustomerIdQuery` import と factory 関数を削除
- `src/server/subdomains/delivery-location/application/factories/index.ts`
  - export から `getDeliveryLocationsByCustomerIdQueryFactory` を削除

### Step 6: DeliveryLocationQueryService クリーンアップ

**編集:**
- `src/server/subdomains/delivery-location/application/queries/DeliveryLocationQueryService.ts`
  - `findByCustomerId()`, `findAll()`, `count()` 宣言を削除
  - 残す: `findById`, `findByCode`, `search`
- `src/server/subdomains/delivery-location/infrastructure/queries/PrismaDeliveryLocationQueryService.ts`
  - `findByCustomerId()`, `findAll()`, `count()` 実装を削除
- `src/server/subdomains/delivery-location/application/queries/SearchDeliveryLocationsQuery.ts`
  - `executeWithPagination()` メソッドと `SearchDeliveryLocationsPaginatedInput` 型を削除
  - `PaginatedResult`, `PaginationOptions` の import を削除
- `src/server/subdomains/delivery-location/application/queries/__tests__/SearchDeliveryLocationsQuery.test.ts`
  - `executeWithPagination` の describe ブロックを削除

### Step 7: Department の count / executeWithPagination 削除

**編集:**
- `src/server/subdomains/department/application/queries/DepartmentQueryService.ts`
  - `count()` 宣言を削除 (L76-81)
  - 残す: `findById`, `findByDepartmentCd`, `search`, `findAll`, `findActive`, `findChildren`, `findRootDepartments`, `getTree`
- `src/server/subdomains/department/infrastructure/queries/PrismaDepartmentQueryService.ts`
  - `count()` 実装を削除 (L124-127)
- `src/server/subdomains/department/application/queries/SearchDepartmentsQuery.ts`
  - `executeWithPagination()` メソッドと `SearchDepartmentsPaginatedInput` 型を削除
  - `PaginatedResult`, `PaginationOptions` の import を削除
- `src/server/subdomains/department/application/queries/__tests__/SearchDepartmentsQuery.test.ts`
  - `executeWithPagination` の describe ブロックを削除

### Step 8: 共有コード PaginatedResult.ts 削除

**削除:**
- `src/server/shared/queries/PaginatedResult.ts`

**確認:** 他に `src/server/shared/queries/` 内のファイルが残っているか確認し、ディレクトリが空になる場合はそのままで OK（Git が自動管理）

### Step 9: 検証

```bash
pnpm lint    # TypeScript エラー・未使用 import がないこと
pnpm build   # Next.js ビルド成功
pnpm test    # 残存テスト全 pass
```

---

## 変更サマリ

| 操作 | ファイル数 |
|------|-----------|
| 削除 | 11 (Query 5 + テスト 5 + PaginatedResult.ts 1) |
| 編集 | 18 (Interface 4 + Prisma実装 4 + SearchQuery 4 + SearchQueryテスト 4 + Factory 1 + Factory index 2) |
| **合計** | **29ファイル** |
