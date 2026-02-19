---
name: ddd-architecture
description: DDDアーキテクチャ実装パターン。エンティティ、値オブジェクト、リポジトリ、ユースケースの実装時に使用
user-invokable: true
---

# DDD Architecture Implementation Patterns

## Layer Dependency Rules

```
Presentation Layer (Next.js App Router)
    ↓ depends on
Application Layer (Use Cases)
    ↓ depends on
Domain Layer (Entities, Value Objects, Repository Interfaces)
    ↑ implemented by
Infrastructure Layer (Prisma Repositories, Mappers)
```

**Dependency direction: outer -> inner only**

- Domain layer MUST NOT depend on any other layer
- Application layer depends on Domain layer only (uses interfaces)
- Infrastructure layer implements Domain interfaces
- Presentation layer orchestrates Application layer

## Entity Implementation Pattern

```typescript
export class Employee {
  // Private readonly fields
  private readonly _id: string;
  private _name: string;
  private _email: Email;  // Value Object
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  // Private constructor (use factory methods)
  private constructor(props: EmployeeProps) {
    this._id = props.id;
    this._name = props.name;
    this._email = props.email;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Factory: create new entity
  static create(props: CreateEmployeeProps): Employee {
    // Business rule validation
    if (props.name.length < 2) {
      throw new ValidationError([
        { field: 'name', message: 'Name must be at least 2 characters' }
      ]);
    }

    return new Employee({
      id: generateId(),
      name: props.name,
      email: props.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Factory: reconstruct from persistence
  static reconstruct(props: EmployeeProps): Employee {
    return new Employee(props);
  }

  // Getters (immutable access)
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get email(): Email { return this._email; }

  // Business logic (behavior)
  updateName(newName: string): void {
    if (newName.length < 2) {
      throw new ValidationError([
        { field: 'name', message: 'Name must be at least 2 characters' }
      ]);
    }
    this._name = newName;
    this._updatedAt = new Date();
  }

  // Entity equality (by identity)
  equals(other: Employee): boolean {
    return this._id === other._id;
  }
}
```

## Value Object Implementation Pattern

```typescript
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    // Validate invariants
    if (!this.isValid(value)) {
      throw new ValidationError([
        { field: 'email', message: 'Invalid email format' }
      ]);
    }
    // Normalize
    this._value = value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  private isValid(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  // Value equality (by value)
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  // Immutable change (returns new instance)
  changeDomain(newDomain: string): Email {
    const [localPart] = this._value.split('@');
    return new Email(`${localPart}@${newDomain}`);
  }
}
```

**Value Object principles:**
- Immutable (no setters, changes return new instances)
- Validate in constructor
- Throw `ValidationError` on invalid input
- Equality by value, not identity

## Repository Pattern

### Interface (Domain Layer)

```typescript
// domain/repositories/EmployeeRepository.ts
export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: Email): Promise<Employee | null>;
  findAll(options?: FindAllOptions): Promise<Employee[]>;
  save(employee: Employee): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Implementation (Infrastructure Layer)

```typescript
// infrastructure/repositories/PrismaEmployeeRepository.ts
export class PrismaEmployeeRepository implements EmployeeRepository {
  async findById(id: string): Promise<Employee | null> {
    try {
      const record = await prisma.employee.findUnique({ where: { id } });
      return record ? EmployeeMapper.toDomain(record) : null;
    } catch (error) {
      throw new InfrastructureError(`Failed to find employee: ${id}`, error as Error);
    }
  }

  async save(employee: Employee): Promise<void> {
    try {
      const data = EmployeeMapper.toPrisma(employee);
      await prisma.employee.upsert({
        where: { id: employee.id },
        update: data,
        create: data,
      });
    } catch (error) {
      throw new InfrastructureError('Failed to save employee', error as Error);
    }
  }
}
```

**Repository rules:**
- Interface in Domain layer (no Prisma imports!)
- Implementation in Infrastructure layer
- Wrap Prisma errors in `InfrastructureError`
- NO business logic in repository

## Mapper Pattern

```typescript
// infrastructure/mappers/EmployeeMapper.ts
export class EmployeeMapper {
  static toDomain(prismaEmployee: PrismaEmployee): Employee {
    return Employee.reconstruct({
      id: prismaEmployee.id,
      name: prismaEmployee.name,
      email: new Email(prismaEmployee.email),
      createdAt: prismaEmployee.createdAt,
      updatedAt: prismaEmployee.updatedAt,
    });
  }

  static toPrisma(employee: Employee): Prisma.EmployeeCreateInput {
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email.value,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
```

## Use Case Pattern

```typescript
// application/commands/CreateEmployeeCommand.ts
export class CreateEmployeeCommand {
  constructor(
    private readonly repository: EmployeeRepository,
    private readonly duplicationChecker: EmployeeDuplicationCheckService
  ) {}

  async execute(input: CreateEmployeeInput): Promise<CreateEmployeeOutput> {
    // 1. Create value objects (validation happens here)
    const email = new Email(input.email);

    // 2. Application-level checks
    const isDuplicated = await this.duplicationChecker.isDuplicated(email);
    if (isDuplicated) {
      throw new BusinessRuleViolationError('Employee with this email already exists');
    }

    // 3. Create entity (domain logic)
    const employee = Employee.create({
      name: input.name,
      email,
    });

    // 4. Persist
    await this.repository.save(employee);

    // 5. Return output DTO
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email.value,
    };
  }
}

// Input/Output DTOs
export type CreateEmployeeInput = {
  name: string;
  email: string;
};

export type CreateEmployeeOutput = {
  id: string;
  name: string;
  email: string;
};
```

**Use Case rules:**
- Single responsibility (one use case = one operation)
- Depends on repository interfaces, not implementations
- Orchestrates domain objects
- Handles application-level concerns (uniqueness checks, etc.)

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Entity | PascalCase singular | `Employee`, `Estimate` |
| Value Object | PascalCase | `Email`, `EmployeeCd` |
| Repository Interface | PascalCase + Repository | `EmployeeRepository` |
| Repository Implementation | Prisma + Entity + Repository | `PrismaEmployeeRepository` |
| Use Case | Verb + Noun + Command/Query | `CreateEmployeeCommand` |
| Mapper | Entity + Mapper | `EmployeeMapper` |
| Input DTO | UseCase + Input | `CreateEmployeeInput` |
| Output DTO | UseCase + Output | `CreateEmployeeOutput` |

## Aggregate (集約) Pattern

集約はDDDの中核概念の一つです。

```
┌─────────────────────────────────────┐
│  Aggregate (集約)                    │
│  ┌─────────────────┐                │
│  │ Aggregate Root  │ ← 外部からの   │
│  │ (集約ルート)     │   唯一の入口   │
│  └────────┬────────┘                │
│           │                         │
│  ┌────────┴────────┐                │
│  │  Entity/VO      │                │
│  │  (内部オブジェクト)│                │
│  └─────────────────┘                │
└─────────────────────────────────────┘
```

**集約のルール:**

1. **リポジトリは集約ルートに対してのみ定義**
   ```typescript
   // Good: 集約ルートに対するリポジトリ
   interface OrderRepository {
     findById(id: string): Promise<Order | null>;
     save(order: Order): Promise<void>;
   }

   // Bad: 集約内部のエンティティに対するリポジトリ
   interface OrderLineRepository { ... }  // NG!
   ```

2. **集約間はIDで参照**（直接参照しない）
   ```typescript
   // Good: IDで参照
   class Order {
     private readonly _customerId: string;  // ID参照
   }

   // Bad: 直接参照（集約境界を越える）
   class Order {
     private readonly _customer: Customer;  // NG!
   }
   ```

3. **トランザクション境界 = 集約境界**
   - 1つのトランザクションで1つの集約のみ更新
   - 複数集約の更新が必要な場合は結果整合性を検討

## Domain Services（ドメインサービス）

エンティティや値オブジェクトに属さないドメインロジックの置き場所。

**使用する場面:**
- 複数のエンティティ/集約にまたがる操作
- エンティティに持たせると不自然な操作
- ステートレスな操作

```typescript
// domain/services/EmployeeDuplicationCheckService.ts
export class EmployeeDuplicationCheckService {
  constructor(private readonly repository: EmployeeRepository) {}

  async isDuplicated(email: Email): Promise<boolean> {
    const existing = await this.repository.findByEmail(email);
    return existing !== null;
  }
}

// domain/services/TransferService.ts（複数集約にまたがる例）
export class TransferService {
  transfer(from: Account, to: Account, amount: Money): void {
    from.withdraw(amount);
    to.deposit(amount);
  }
}
```

**命名規則:** `動詞/名詞 + Service`（例: `TransferService`, `EmployeeDuplicationCheckService`）

## Subdomain / Bounded Context

このプロジェクトでは `src/server/subdomains/[name]/` でサブドメインを分離しています。

```
src/server/subdomains/
├── employee/          # 従業員サブドメイン
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── estimate/          # 見積サブドメイン
│   ├── domain/
│   ├── application/
│   └── infrastructure/
└── ...
```

**境界づけられたコンテキストのルール:**

1. **各サブドメインは独立したユビキタス言語を持つ**
   - 同じ「顧客」でも、販売コンテキストと請求コンテキストでは意味が異なる場合がある

2. **サブドメイン間の依存は最小限に**
   - 直接の依存よりもイベントやIDによる疎結合を優先

3. **共有カーネル（shared kernel）は慎重に**
   - `src/server/shared/` には本当に共通なもののみ配置
   - エラークラス、基底クラスなど

## Error Hierarchy

```typescript
// Domain errors (business rule violations)
throw new ValidationError([{ field: 'email', message: 'Invalid format' }]);
throw new BusinessRuleViolationError('Cannot delete active employee');

// Infrastructure errors (persistence failures)
throw new InfrastructureError('Database connection failed', originalError);

// Not found
throw new NotFoundError('Employee', id);
```

## File Reference

For complete examples and detailed guidelines, see `docs/dev-guidelines.md` section 5.
