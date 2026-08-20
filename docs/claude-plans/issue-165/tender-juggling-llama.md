# Plan: Department シードデータの ID を CUID 化し departmentCd パターンに統一

## Context

#160 で Position / Role のシードデータを `id(CUID) + xxxCd` パターンに統一済み。
しかし Department は依然として `id: "dept-001"` のようにハードコード文字列 ID を使用しており、一貫性がない。
本対応で Department も同じパターンに統一し、テストコードからもハードコード Department ID を排除する。

## 変更対象ファイル一覧

- `prisma/seed.ts`
- テスト 13 ファイル（後述）

## Step 1: `prisma/seed.ts` — DEPARTMENTS 定数の `id` フィールド削除

`DEPARTMENTS` 配列（L146-177）から `id` フィールドを削除。`departmentCd` をキーとして使用する。

```typescript
// Before
{ id: "dept-001", departmentCd: "DEPT001", name: "営業部", abbreviation: "営業" },

// After
{ departmentCd: "DEPT001", name: "営業部", abbreviation: "営業" },
```

## Step 2: `prisma/seed.ts` — `departmentIdMap` の作成と部署作成ロジック変更

部署作成ループ（L1015-1026）を `positionIdMap` / `roleIdMap` と同じパターンに変更。

```typescript
const departmentIdMap = new Map<string, string>(); // departmentCd → CUID
for (const dept of DEPARTMENTS) {
  const id = createId();
  departmentIdMap.set(dept.departmentCd, id);
  await prisma.department.create({
    data: {
      id,
      departmentCd: dept.departmentCd,
      name: dept.name,
      abbreviation: dept.abbreviation,
      isActive: true,
    },
  });
}
```

## Step 3: `prisma/seed.ts` — `ROLE_EMPLOYEE_CONFIGS` を `departmentCd` 参照に変更

`departmentId: "dept-001"` → `departmentCd: "DEPT001"` に変更（L241-257）。

## Step 4: `prisma/seed.ts` — `DEPARTMENT_SUPERIOR_ROLE_CDS` のキーを `departmentCd` に変更

Map のキーを `"dept-001"` → `"DEPT001"` に変更（L260-266）。

## Step 5: `prisma/seed.ts` — `generateSeedUsers` 関数の修正

- 引数に `departmentIdMap: Map<string, string>` を追加（L824）
- 役割従業員ブランチ（L839）: `config.departmentId` → `departmentIdMap.get(config.departmentCd)!`
- 一般従業員ブランチ（L845）: `randomChoice(DEPARTMENTS).id` → `departmentIdMap` 経由で CUID 取得
- `DEPARTMENT_SUPERIOR_ROLE_CDS.get(departmentId)` → `.get(dept.departmentCd)` に変更
- 呼び出し元（L1078）に `departmentIdMap` を渡す

**Commit 1**: Steps 1-5 を1コミット（seed.ts の変更）

## Step 6: Integration テスト 12 ファイルのハードコード Department ID 排除

対象（`upsert({ where: { id: "dept-001" } })` パターン）:

| # | ファイル |
|---|---------|
| 1 | `infrastructure/prisma/__tests__/PrismaEmployeeRepository.test.ts` |
| 2 | `application/commands/__tests__/CreateEmployeeCommand.test.ts` |
| 3 | `application/commands/__tests__/UpdateEmployeeCommand.test.ts` |
| 4 | `application/commands/__tests__/DeleteEmployeeCommand.test.ts` |
| 5 | `application/queries/__tests__/GetEmployeeByIdQuery.test.ts` |
| 6 | `application/queries/__tests__/GetEmployeeByEmailQuery.test.ts` |
| 7 | `application/queries/__tests__/GetEmployeeByEmployeeCdQuery.test.ts` |
| 8 | `application/queries/__tests__/GetAllEmployeesQuery.test.ts` |
| 9 | `application/queries/__tests__/SearchEmployeesQuery.test.ts` |
| 10 | `application/queries/__tests__/CountEmployeesQuery.test.ts` |
| 11 | `domain/services/__tests__/EmployeeCdDuplicationCheckDomainService.test.ts` |
| 12 | `domain/services/__tests__/MailAddressDuplicationCheckDomainService.test.ts` |

全ファイル共通ベースパス: `src/server/subdomains/employee/`

### 変更パターン

各ファイルで以下の機械的変換を適用:

1. `createId()` の import を追加（未importの場合）
2. describe スコープに `const TEST_DEPT_ID = createId();` を定義（既存の場合は値を変更）
3. `upsert` を `departmentCd` ベースに変更:
   ```typescript
   await prisma.department.upsert({
     where: { departmentCd: "TEST_DEPT" },
     update: {},
     create: {
       id: TEST_DEPT_ID,
       departmentCd: "TEST_DEPT",
       name: "テスト部署",
       abbreviation: "テスト",
       isActive: true,
     },
   });
   ```
4. ヘルパー関数のデフォルト値 `"dept-001"` → `TEST_DEPT_ID` に変更
5. その他の `"dept-001"` リテラル参照を `TEST_DEPT_ID` に置換

**Commit 2**: Step 6（Integration テストの変更）

## Step 7: Domain テスト `Employee.test.ts` のハードコード Department ID 排除

ファイル: `src/server/subdomains/employee/domain/entities/__tests__/Employee.test.ts`

- `import { createId } from "@paralleldrive/cuid2";` を追加
- `departmentId = "dept-001"` → `departmentId = createId()`
- `const newDepartmentId = "dept-002"` → `const newDepartmentId = createId()`
- `.toBe("dept-001")` → `.toBe(departmentId)`
- `.toBe("dept-002")` → `.toBe(newDepartmentId)`

**Commit 3**: Step 7（Domain テストの変更）

## Verification

- [ ] `pnpm test` — 全テスト通過
- [ ] `pnpm build` — 型エラーなし
- [ ] コードベース全体で `dept-00` のハードコード参照が残っていないことを grep で確認
