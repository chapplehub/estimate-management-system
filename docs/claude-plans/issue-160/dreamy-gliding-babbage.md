# Issue #160: 役職・役割テーブルの追加および従業員テーブルへの上位役割ID追加

## Context

承認フロー実装の基盤として、役職（Position）・役割（Role）・従業員役割（EmployeeRole）テーブルを追加する。
承認チェーンは従業員の上位役割を起点に、役割の自己参照を辿って構築される（ADR-003）。
現在のスキーマにはこれらのモデルが存在しないため、スキーマ定義・マイグレーション・シードデータの投入を行う。

**スコープ**: スキーマ + マイグレーション + シードデータのみ。ドメイン層のエンティティ・リポジトリ等は承認フロー実装時に追加する。

## 設計判断

- **EmployeeRole は Employee を参照**（User ではない）。承認フローはドメインエンティティである Employee を起点とするため。
- **ドメイン層の変更は本issueのスコープ外**。Employee エンティティへの `superiorRoleId` 追加は、承認フローの実装時に行う。
- **Position/Role にタイムスタンプは不要**。静的なマスタデータのため。
- **ID は CUID を使用せず、ハードコード文字列ID**（シードデータ）。既存の Department パターン（`"dept-001"`）に合わせる。

---

## Step 1: Position モデルを schema.prisma に追加

**ファイル**: `prisma/schema.prisma`

Employee セクションの前に「役職・役割関連」セクションを追加。

```prisma
// ========================================
// 役職・役割関連
// ========================================

model Position {
  id   String @id // シードデータで固定ID
  name String @unique // 役職名（課長・部長・本部長・社長）

  // 上位役職（自己参照）：社長は NULL
  superiorPositionId String?    @map("superior_position_id")
  superiorPosition   Position?  @relation("PositionHierarchy", fields: [superiorPositionId], references: [id])
  subordinates       Position[] @relation("PositionHierarchy")

  // 逆参照
  roles Role[]

  @@map("positions")
}
```

## Step 2: Role モデルを schema.prisma に追加

```prisma
model Role {
  id   String @id // ドメイン層でCUID生成
  name String // 役割名（大阪市南課長・大阪市部長など）

  // 上位役割（自己参照）
  superiorRoleId String? @map("superior_role_id")
  superiorRole   Role?   @relation("RoleHierarchy", fields: [superiorRoleId], references: [id])
  subordinates   Role[]  @relation("RoleHierarchy")

  // 所属役職
  positionId String   @map("position_id")
  position   Position @relation(fields: [positionId], references: [id])

  // 逆参照
  employeeRoles       EmployeeRole[]
  employeesAsSuperior Employee[]     @relation("EmployeeSuperiorRole")

  @@index([positionId])
  @@map("roles")
}
```

## Step 3: EmployeeRole モデルを schema.prisma に追加

```prisma
model EmployeeRole {
  // 複合PK（従業員ID + 役割ID）
  employeeId String   @map("employee_id")
  employee   Employee @relation(fields: [employeeId], references: [id])
  roleId     String   @map("role_id")
  role       Role     @relation(fields: [roleId], references: [id])

  @@id([employeeId, roleId])
  @@map("employee_roles")
}
```

## Step 4: Employee モデルに superiorRoleId を追加

**ファイル**: `prisma/schema.prisma` の Employee モデル

```prisma
// 上位役割（承認フローの起点）
superiorRoleId String? @map("superior_role_id")
superiorRole   Role?   @relation("EmployeeSuperiorRole", fields: [superiorRoleId], references: [id])

// 従業員役割（逆参照）
employeeRoles EmployeeRole[]
```

`@@index` に `superiorRoleId` を追加:
```prisma
@@index([superiorRoleId])
```

## Step 5: マイグレーション作成・適用

```bash
pnpm db:migrate --name add_position_role_tables
pnpm db:generate
```

## Step 6: シードデータに役職マスタ4件を追加

**ファイル**: `prisma/seed.ts`

### 6a: POSITIONS 定数を追加

```typescript
const POSITIONS = [
  { id: "pos-001", name: "課長", superiorPositionId: "pos-002" },
  { id: "pos-002", name: "部長", superiorPositionId: "pos-003" },
  { id: "pos-003", name: "本部長", superiorPositionId: "pos-004" },
  { id: "pos-004", name: "社長", superiorPositionId: null },
];
```

### 6b: seedPositions() 関数を追加

FK制約を考慮して上位から作成（社長 → 本部長 → 部長 → 課長）。

```typescript
async function seedPositions() {
  // 上位から作成（FK制約を考慮）
  const ordered = [...POSITIONS].sort((a, b) => {
    if (a.superiorPositionId === null) return -1;
    if (b.superiorPositionId === null) return 1;
    return b.id.localeCompare(a.id);
  });
  for (const pos of ordered) {
    await prisma.position.create({ data: pos });
  }
}
```

### 6c: deleteMany に追加（FK制約順序を考慮）

`employee.deleteMany()` の前に以下を追加:
```typescript
await prisma.employeeRole.deleteMany();
// employee.deleteMany() は既存のまま
// employee の後に:
await prisma.role.deleteMany();
await prisma.position.deleteMany();
```

### 6d: main() で seedPositions() を呼び出し

部署作成の後、得意先・従業員作成の前に配置。

---

## 対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `prisma/schema.prisma` | Position, Role, EmployeeRole 追加、Employee 修正 |
| `prisma/seed.ts` | 役職シードデータ追加、deleteMany 順序修正 |

## 検証

1. `pnpm db:migrate` - マイグレーション正常適用
2. `pnpm db:generate` - Prisma Client 再生成
3. `pnpm db:seed` - シードデータ投入（役職4件含む）
4. `pnpm build` - ビルド成功
5. `pnpm test` - 既存テスト全パス
