# DDDにおけるMapperパターンの必要性

## 概要

DDDプロジェクトでは、**ドメインモデル（エンティティ）とデータモデル（Prisma/ORMのモデル）の間を変換するMapperが必須**である。

## Mapperとは

**Mapper（マッパー）** は、異なる層の間でデータ構造を変換する責務を持つクラス。

```typescript
export class EmployeeMapper {
  // Prismaモデル → ドメインエンティティ
  static toDomain(prismaEmployee: PrismaEmployee): Employee { ... }

  // ドメインエンティティ → Prisma作成用データ
  static toPrismaCreate(employee: Employee) { ... }

  // ドメインエンティティ → Prisma更新用データ
  static toPrismaUpdate(employee: Employee) { ... }
}
```

## なぜMapperが必須なのか

### 1. ドメインモデルとデータモデルは別物

**ドメインモデルの特徴:**
- 値オブジェクト（Value Object）を使用
- ビジネスルールを持つ
- 不変性を保証
- バリデーションロジックを内包

```typescript
// ドメイン層のEmployee
export class Employee {
  private readonly _employeeCd: EmployeeCd;      // 値オブジェクト
  private readonly _email: MailAddress;          // 値オブジェクト

  // ビジネスロジック
  isAccountLocked(): boolean { ... }
  recordFailedLogin(): void { ... }
  unlockAccount(): void { ... }
}
```

**データモデルの特徴:**
- プリミティブ型のみ
- ビジネスロジックなし
- 単なるデータ構造（DTO）
- DBのテーブル構造を反映

```typescript
// Prismaのスキーマ
model Employee {
  id            String
  employeeCd    String    // プリミティブ型
  email         String    // プリミティブ型
  name          String
  passwordHash  String
  // ... ロジックは一切ない
}
```

この**構造の違いを吸収するのがMapperの役割**。

### 2. 依存の方向を守る（DDDの核心原則）

DDDでは、依存の方向が厳格に定義されている：

```
┌─────────────────────────────────┐
│   Domain Layer                  │  ← 純粋なビジネスロジック
│   (Employee, EmployeeCd, etc.)  │     外部に依存しない
└─────────────────────────────────┘
          ↑
          │ Mapperで変換
          │
┌─────────────────────────────────┐
│   Infrastructure Layer          │  ← 技術的な実装
│   (PrismaEmployeeRepository)    │     ドメインに依存
└─────────────────────────────────┘
```

**Mapperがない場合の問題:**
```typescript
// ❌ ドメイン層でPrismaの型を使ってしまう（DDD違反）
import { Employee as PrismaEmployee } from "@prisma/client";

export class Employee {
  constructor(private data: PrismaEmployee) {}
  // ドメイン層がインフラ層に依存している！
}
```

**Mapperがある場合:**
```typescript
// ✅ ドメイン層は純粋なまま
export class Employee {
  constructor(
    private readonly _employeeCd: EmployeeCd,
    private readonly _email: MailAddress
  ) {}
  // Prismaを一切知らない
}

// Infrastructure層でMapperを使って変換
export class PrismaEmployeeRepository {
  async find(employeeCd: EmployeeCd): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique(...);
    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
    // Prismaのデータをドメインエンティティに変換
  }
}
```

### 3. 値オブジェクトとプリミティブ型の変換

DDDでは、重要な概念は値オブジェクトで表現する。しかしDBには**プリミティブ型**しか保存できない。

**変換の具体例:**

```typescript
// Prisma (DB) → Domain
{
  employeeCd: "EMP000001",        // string
  email: "test@example.com",      // string
  role: "USER"                     // string
}
        ↓ EmployeeMapper.toDomain()
{
  employeeCd: new EmployeeCd("EMP000001"),        // Value Object
  email: new MailAddress("test@example.com"),     // Value Object
  role: Role.USER                                  // Enum
}

// Domain → Prisma (DB)
{
  employeeCd: EmployeeCd("EMP000001"),   // Value Object
  email: MailAddress("test@example.com") // Value Object
}
        ↓ EmployeeMapper.toPrismaCreate()
{
  employeeCd: "EMP000001",               // string
  email: "test@example.com"              // string
}
```

値オブジェクトは**コンストラクタでバリデーション**するため、不正なデータがドメイン層に入らない：

```typescript
export class MailAddress {
  constructor(value: string) {
    if (!this.isValidEmail(value)) {
      throw new ValidationError("不正なメールアドレス");
    }
    this._value = value.toLowerCase().trim();
  }
}

// Mapperで変換時にバリデーションが実行される
const email = new MailAddress(prismaEmployee.email);
// 不正なデータなら例外が投げられる
```

### 4. ORMの変更に強い

Mapperを使うことで、**ORMを変更してもドメイン層は影響を受けない**。

```
Prisma → TypeORM に変更する場合:

✅ Mapperあり:
  - EmployeeMapperだけ修正
  - Employeeエンティティは無修正
  - ユースケースも無修正

❌ Mapperなし:
  - Employeeエンティティを修正
  - 全てのユースケースを修正
  - テストも全て修正
```

## Mapperの実装パターン

### このプロジェクトでの実装

```typescript
// Infrastructure/mappers/EmployeeMapper.ts
export class EmployeeMapper {
  /**
   * Prismaモデル → ドメインエンティティ
   */
  static toDomain(prismaEmployee: PrismaEmployee): Employee {
    const employeeCd = new EmployeeCd(prismaEmployee.employeeCd);
    const email = new MailAddress(prismaEmployee.email);

    return Employee.reconstruct(
      prismaEmployee.id,
      employeeCd,
      email,
      prismaEmployee.name,
      prismaEmployee.passwordHash,
      prismaEmployee.role as Role,
      prismaEmployee.failedLoginAttempts,
      prismaEmployee.lockedUntil,
      prismaEmployee.lastLoginAt,
      prismaEmployee.createdAt,
      prismaEmployee.updatedAt
    );
  }

  /**
   * ドメインエンティティ → Prisma作成用データ
   */
  static toPrismaCreate(employee: Employee) {
    return {
      employeeCd: employee.employeeCd.value,      // Value Object → string
      email: employee.email.value,                // Value Object → string
      name: employee.name,
      passwordHash: employee.passwordHash,
      role: employee.role,
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      lastLoginAt: employee.lastLoginAt,
    };
  }

  /**
   * ドメインエンティティ → Prisma更新用データ
   */
  static toPrismaUpdate(employee: Employee) {
    return {
      email: employee.email.value,
      name: employee.name,
      passwordHash: employee.passwordHash,
      role: employee.role,
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      lastLoginAt: employee.lastLoginAt,
      updatedAt: employee.updatedAt,
    };
  }
}
```

### リポジトリでの使用例

```typescript
// Infrastructure/repositories/PrismaEmployeeRepository.ts
export class PrismaEmployeeRepository implements IEmployeeRepository {
  async save(employee: Employee): Promise<void> {
    const data = EmployeeMapper.toPrismaCreate(employee);
    await prisma.employee.create({ data });
  }

  async find(employeeCd: EmployeeCd): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { employeeCd: employeeCd.value },
    });

    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }

  async update(employee: Employee): Promise<void> {
    const data = EmployeeMapper.toPrismaUpdate(employee);
    await prisma.employee.update({
      where: { id: employee.id },
      data,
    });
  }
}
```

## Mapperが不要なケース

以下の場合はMapperなしでも動作するが、**DDDとは呼べない**：

### ❌ アンチパターン1: プリミティブ型のみのドメインモデル

```typescript
export class Employee {
  constructor(
    private employeeCd: string,  // 値オブジェクトではない
    private email: string         // バリデーションなし
  ) {}

  // ビジネスロジックもない
}
```

問題点：
- 不正なデータも受け入れてしまう
- ビジネスルールを表現できない
- ただのデータ構造（ドメインモデルではない）

### ❌ アンチパターン2: ドメイン層でORMの型を直接使用

```typescript
import { Employee as PrismaEmployee } from "@prisma/client";

export class EmployeeService {
  async getEmployee(id: string): Promise<PrismaEmployee> {
    return await prisma.employee.findUnique({ where: { id } });
  }
}
```

問題点：
- ドメイン層がインフラ層に依存（依存の方向が逆）
- ORMを変更すると全体が壊れる
- テストでDBが必須になる

## Mapperを使うメリット・デメリット

### メリット

| 項目 | 説明 |
|------|------|
| **ドメインの純粋性** | ドメイン層が外部技術に依存しない |
| **値オブジェクトの活用** | バリデーション・ビジネスルールを集約 |
| **テスト容易性** | ドメイン層だけを単体テスト可能 |
| **変更容易性** | ORMの変更がドメインに影響しない |
| **型安全性** | プリミティブ型の誤用を防ぐ |

### デメリット

| 項目 | 説明 | 対策 |
|------|------|------|
| **コード量増加** | Mapperクラスの実装が必要 | 複雑なビジネスロジックには投資価値あり |
| **学習コスト** | DDDの理解が必要 | チームで学習する |
| **パフォーマンス** | 変換処理のオーバーヘッド | 実用上は無視できるレベル |

## いつMapperを使うべきか

### ✅ Mapperを使うべきケース

- 値オブジェクトを使う（メールアドレス、社員コード等）
- ビジネスロジックが複雑
- 長期運用するシステム
- 複数人で開発
- テスト重視

### ⚠ Mapperが不要なケース

- 単純なCRUDのみ
- プロトタイプ・PoC
- 短期間で使い捨て
- ビジネスルールがほぼない

## まとめ

1. **DDDではMapperは必須**
   - ドメインモデルとデータモデルは構造が異なる
   - 値オブジェクトとプリミティブ型の変換が必要

2. **依存の方向を守るため**
   - ドメイン層は純粋なビジネスロジックのみ
   - インフラ層（Prisma）への依存を排除

3. **長期的なメリットが大きい**
   - ORMの変更に強い
   - テストしやすい
   - ビジネスルールが集約される

4. **このプロジェクトでは正しい選択**
   - 値オブジェクト（EmployeeCd、MailAddress）を使用
   - 複雑なビジネスルール（アカウントロック等）
   - 学習目的でDDDを実践

**結論:** Mapperは手間がかかるが、DDDの恩恵を受けるための**必要不可欠な投資**である。
