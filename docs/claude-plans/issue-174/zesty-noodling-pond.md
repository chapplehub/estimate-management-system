# Plan: 役割・役職管理バックエンド実装 (Issue #174)

## Context

役割（Role）のCRUD機能と役職（Position）の読み取り機能のバックエンド実装。承認フローの基盤となる役割階層を正しく管理するため、DDDレイヤリングルールに従ってDomain/Application/Infrastructure層を実装する。

Departmentサブドメインの実装パターンを踏襲し、一貫したアーキテクチャを維持する。

**前提**: Issue #179により、Role/Positionモデルに`createdAt`/`updatedAt`カラムが追加済み。

## 設計上の重要な判断

### 1. Positionサブドメインのスコープ

役職は固定4種（課長・部長・本部長・社長）のため、Create/Update/Deleteは不要。読み取り専用のQuery層のみ実装する。ただしDomain層（エンティティ・値オブジェクト・リポジトリインターフェース）は定義する（Roleドメインでの検証に必要なため）。

### 2. Cross-subdomain依存の解決

Roleの「上位役割は上位役職に属する役割のみ」バリデーションにはPositionデータが必要。Roleドメイン内に最小限の`PositionRepository`インターフェース（`findSuperiorPositionId`, `exists`の2メソッド）を定義し、Infrastructure層でPrisma実装する。Positionサブドメインとは独立を保つ。

### 3. 役割名の一意性

DBに`@unique`制約がないため、ドメインサービスで一意性を保証する。

---

## Step 1: Positionサブドメイン - Domain層（エンティティ・値オブジェクト・リポジトリ）

### Files
- `src/server/subdomains/position/domain/values/PositionCd.ts`
- `src/server/subdomains/position/domain/values/PositionName.ts`
- `src/server/subdomains/position/domain/values/__tests__/PositionCd.test.ts`
- `src/server/subdomains/position/domain/values/__tests__/PositionName.test.ts`
- `src/server/subdomains/position/domain/entities/Position.ts`
- `src/server/subdomains/position/domain/entities/__tests__/Position.test.ts`
- `src/server/subdomains/position/domain/repositories/PositionRepository.ts`

### Details
- **PositionCd**: `POS` + 3桁数字（POS001〜POS999）。`StringValueObject<"PositionCd">`
- **PositionName**: 1〜50文字。`StringValueObject<"PositionName">`
- **Positionエンティティ**: `_id`, `_positionCd`, `_name`, `_superiorPositionId`, `_createdAt`, `_updatedAt`
  - 固定4種のため`create()`は不要、`reconstruct()`のみ
  - ビジネスロジック: `isTopLevel(): boolean`（社長かどうか）
  - `static readonly ENTITY_NAME = "役職"`
- **PositionRepository**: `findById(id)`, `findByPositionCd(cd)`, `findAll()`

### Reuse
- `src/server/shared/StringValueObject.ts`
- `src/server/subdomains/department/domain/values/DepartmentCd.ts` - Cdパターン参考
- `src/server/subdomains/department/domain/entities/Department.ts` - エンティティパターン参考

---

## Step 2: Positionサブドメイン - Infrastructure層 + Application層（Query）

### Files
- `src/server/subdomains/position/infrastructure/mappers/PositionMapper.ts`
- `src/server/subdomains/position/infrastructure/prisma/PrismaPositionRepository.ts`
- `src/server/subdomains/position/application/queries/dto/PositionDTO.ts`
- `src/server/subdomains/position/application/queries/PositionQueryService.ts`
- `src/server/subdomains/position/application/queries/GetAllPositionsQuery.ts`
- `src/server/subdomains/position/application/queries/GetPositionByIdQuery.ts`
- `src/server/subdomains/position/infrastructure/queries/PrismaPositionQueryService.ts`
- `src/server/subdomains/position/application/factories/positionQueryFactory.ts`
- `src/server/subdomains/position/application/factories/index.ts`

### Details

**PositionMapper**: `toDomain(prismaPosition)` のみ（Create/Updateなし）

**PositionDTO**:
```typescript
type PositionDTO = {
  id: string;
  positionCd: string;
  name: string;
  superiorPositionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**PositionQueryService**: `findById`, `findAll`（固定4種のためsearchは不要）

### Reuse
- `src/server/subdomains/department/infrastructure/mappers/DepartmentMapper.ts`
- `src/server/subdomains/department/infrastructure/queries/PrismaDepartmentQueryService.ts`

---

## Step 3: Roleサブドメイン - Domain層 値オブジェクト（RoleCd, RoleName）

### Files
- `src/server/subdomains/role/domain/values/RoleCd.ts`
- `src/server/subdomains/role/domain/values/RoleName.ts`
- `src/server/subdomains/role/domain/values/__tests__/RoleCd.test.ts`
- `src/server/subdomains/role/domain/values/__tests__/RoleName.test.ts`

### Details
- **RoleCd**: `ROLE` + 3桁数字（ROLE001〜ROLE999）。`StringValueObject<"RoleCd">`
- **RoleName**: 1〜100文字。`StringValueObject<"RoleName">`

### Reuse
- `src/server/shared/StringValueObject.ts`
- `src/server/subdomains/department/domain/values/DepartmentCd.ts`

---

## Step 4: Roleサブドメイン - Domain層 エンティティ

### Files
- `src/server/subdomains/role/domain/entities/Role.ts`
- `src/server/subdomains/role/domain/entities/__tests__/Role.test.ts`

### Details
- Private constructor + `static create()` + `static reconstruct()`
- フィールド: `_id`, `_roleCd`, `_name`, `_positionId`, `_superiorRoleId`, `_createdAt`, `_updatedAt`
- ビジネスロジック:
  - `changeName(newName: RoleName): void` - `_updatedAt`更新
  - `changeSuperiorRole(newSuperiorRoleId: string | null): void` - 自己参照チェック + `_updatedAt`更新
- `static readonly ENTITY_NAME = "役割"`

### Reuse
- `src/server/subdomains/department/domain/entities/Department.ts`

---

## Step 5: Roleサブドメイン - Domain層 リポジトリインターフェース + ドメインサービス

### Files
- `src/server/subdomains/role/domain/repositories/RoleRepository.ts`
- `src/server/subdomains/role/domain/repositories/PositionRepository.ts`
- `src/server/subdomains/role/domain/services/RoleCdDuplicationCheckDomainService.ts`
- `src/server/subdomains/role/domain/services/RoleNameDuplicationCheckDomainService.ts`
- `src/server/subdomains/role/domain/services/SuperiorRoleValidationDomainService.ts`
- `src/server/subdomains/role/domain/services/__tests__/RoleCdDuplicationCheckDomainService.test.ts`
- `src/server/subdomains/role/domain/services/__tests__/RoleNameDuplicationCheckDomainService.test.ts`
- `src/server/subdomains/role/domain/services/__tests__/SuperiorRoleValidationDomainService.test.ts`

### Details

**RoleRepository**:
```
save(role: Role): Promise<Role>
delete(id: string): Promise<void>
findById(id: string): Promise<Role | null>
findByRoleCd(roleCd: RoleCd): Promise<Role | null>
findByName(name: string): Promise<Role | null>
findSubordinates(superiorRoleId: string): Promise<Role[]>
isInUse(roleId: string): Promise<boolean>
```

**PositionRepository**（Roleドメインが必要とする最小限）:
```
findSuperiorPositionId(positionId: string): Promise<string | null>
exists(positionId: string): Promise<boolean>
```

**SuperiorRoleValidationDomainService**:
1. `positionRepository.findSuperiorPositionId(positionId)`で上位役職IDを取得
2. 上位役職がnull（社長）→ 上位役割設定不可エラー
3. `roleRepository.findById(superiorRoleId)`で上位役割を取得
4. 上位役割の`positionId`が上位役職IDと一致するか検証

**RoleNameDuplicationCheckDomainService**: `execute(name: string, excludeId?: string)`

### Reuse
- `src/server/subdomains/department/domain/repositories/DepartmentRepository.ts`
- `src/server/subdomains/department/domain/services/DepartmentCdDuplicationCheckDomainService.ts`

---

## Step 6: Roleサブドメイン - Infrastructure層（マッパー・リポジトリ）

### Files
- `src/server/subdomains/role/infrastructure/mappers/RoleMapper.ts`
- `src/server/subdomains/role/infrastructure/prisma/PrismaRoleRepository.ts`
- `src/server/subdomains/role/infrastructure/prisma/PrismaPositionRepository.ts`

### Details

**RoleMapper**: `toDomain`, `toPrismaCreate`, `toPrismaUpdate`

**PrismaRoleRepository**: upsertパターン、`isInUse()`は`EmployeeRole`+`Employee.superiorRoleId`チェック

**PrismaPositionRepository**: Roleドメインの`PositionRepository`インターフェースを実装

### Reuse
- `src/server/subdomains/department/infrastructure/mappers/DepartmentMapper.ts`
- `src/server/subdomains/department/infrastructure/prisma/PrismaDepartmentRepository.ts`

---

## Step 7: Roleサブドメイン - Application層 Command（作成・更新・削除）

### Files
- `src/server/subdomains/role/application/commands/CreateRoleCommand.ts`
- `src/server/subdomains/role/application/commands/UpdateRoleCommand.ts`
- `src/server/subdomains/role/application/commands/DeleteRoleCommand.ts`
- `src/server/subdomains/role/application/commands/__tests__/CreateRoleCommand.test.ts`
- `src/server/subdomains/role/application/commands/__tests__/UpdateRoleCommand.test.ts`
- `src/server/subdomains/role/application/commands/__tests__/DeleteRoleCommand.test.ts`

### Details

**CreateRoleCommand**: Input `{ roleCd, name, positionId, superiorRoleId? }`
- Cd重複、名前重複、Position存在確認、上位役割バリデーション

**UpdateRoleCommand**: Input `{ id, name?, superiorRoleId? }`
- 名前重複（excludeId）、上位役割バリデーション、循環参照チェック

**DeleteRoleCommand**: Input `{ id }`
- 下位役割チェック、使用中チェック（isInUse）

### Reuse
- `src/server/subdomains/department/application/commands/UpdateDepartmentCommand.ts` - 循環参照チェック

---

## Step 8: Roleサブドメイン - Application層 Query + Infrastructure Query Service

### Files
- `src/server/subdomains/role/application/queries/dto/RoleDTO.ts`
- `src/server/subdomains/role/application/queries/dto/RoleSearchCriteria.ts`
- `src/server/subdomains/role/application/queries/RoleQueryService.ts`
- `src/server/subdomains/role/application/queries/GetRoleByIdQuery.ts`
- `src/server/subdomains/role/application/queries/GetAllRolesQuery.ts`
- `src/server/subdomains/role/application/queries/SearchRolesQuery.ts`
- `src/server/subdomains/role/application/queries/GetRolesByPositionQuery.ts`
- `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts`
- `src/server/subdomains/role/application/queries/__tests__/GetRoleByIdQuery.test.ts`
- `src/server/subdomains/role/application/queries/__tests__/GetAllRolesQuery.test.ts`
- `src/server/subdomains/role/application/queries/__tests__/SearchRolesQuery.test.ts`
- `src/server/subdomains/role/application/queries/__tests__/GetRolesByPositionQuery.test.ts`

### Details

**RoleDTO**:
```typescript
type RoleDTO = {
  id: string;
  roleCd: string;
  name: string;
  positionId: string;
  positionName: string;
  superiorRoleId: string | null;
  superiorRoleName: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**PrismaRoleQueryService**: Position, superiorRoleをJOINして`positionName`, `superiorRoleName`取得

### Reuse
- `src/server/subdomains/department/application/queries/` - 全体パターン
- `src/server/subdomains/department/infrastructure/queries/PrismaDepartmentQueryService.ts`

---

## Step 9: Roleサブドメイン - Factory

### Files
- `src/server/subdomains/role/application/factories/createRoleCommandFactory.ts`
- `src/server/subdomains/role/application/factories/updateRoleCommandFactory.ts`
- `src/server/subdomains/role/application/factories/deleteRoleCommandFactory.ts`
- `src/server/subdomains/role/application/factories/roleQueryFactory.ts`
- `src/server/subdomains/role/application/factories/index.ts`

### Reuse
- `src/server/subdomains/department/application/factories/`

---

## Verification

1. `pnpm test` - 全テストパス
2. `pnpm lint` - リントエラーなし
3. `pnpm build` - ビルド成功
4. Domain層に外部ライブラリのimportがないことを確認
5. Application層がリポジトリインターフェース経由のみでデータアクセスしていることを確認
