# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **estimate management system** - an internal business application built for learning DDD (Domain-Driven Design) and modern web development practices. Peak usage: ~100 users (internal only).

**Tech Stack:**

- Frontend: Next.js 16 (App Router), React 19, TailwindCSS 4
- Backend: Next.js API Routes, Prisma ORM, PostgreSQL
- Testing: Vitest
- Authentication: Auth.js (NextAuth) with credentials provider
- Architecture: DDD (Domain-Driven Design) with layered architecture

## Development Commands

All commands should be run from the `web/` directory:

```bash
# Development
cd web
npm run dev              # Start dev server (http://localhost:3000)

# Build & Production
npm run build           # Build for production
npm start              # Start production server

# Testing
npm test               # Run tests with Vitest

# Linting
npm run lint           # Run ESLint

# Database Operations
npm run db:studio      # Open Prisma Studio (database GUI)
npm run db:migrate     # Run database migrations
npm run db:push        # Push schema changes to database
npm run db:generate    # Generate Prisma Client
npm run db:seed        # Run seed script (uses tsx)
```

**Database Connection:**

- PostgreSQL running on `localhost:5432`
- Database name: `estimate_management_dev`
- Connection string in `web/.env`

## Architecture & Structure

This project follows **Domain-Driven Design (DDD)** with strict layered architecture:

### Layered Architecture

```
Presentation Layer (Next.js App Router)
    ↓ depends on
Application Layer (Use Cases)
    ↓ depends on
Domain Layer (Entities, Value Objects, Repository Interfaces)
    ↑ implemented by
Infrastructure Layer (Prisma Repositories, Mappers)
```

### Critical Dependency Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries (except for error handling utilities in `shared/`)
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma ↔ Domain model mapping

### Directory Structure

**Important:** This is a **fullstack application** using Next.js. The directory structure separates **frontend** and **backend** concerns as follows:

```
web/
├── src/
│   ├── app/                    # Presentation Layer (Next.js App Router)
│   │   │                       # Contains BOTH frontend and backend entry points:
│   │   ├── (routes)/          # 【Frontend】 Pages, layouts, UI components
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/               # 【Backend】 API Routes (future)
│   │   └── actions/           # 【Backend】 Server Actions (future)
│   │
│   ├── application/           # 【Backend】 Application Layer (future)
│   │   └── usecases/         # Use case classes (CreateEmployeeUseCase, etc.)
│   │
│   ├── domain/               # 【Backend】 Domain Layer ⚠️ NO external dependencies!
│   │   ├── entities/         # Business entities (Employee, etc.)
│   │   ├── valueObjects/     # Value objects (Email, EmployeeCd, etc.)
│   │   ├── services/         # Domain services
│   │   └── repositories/     # Repository interfaces ONLY
│   │
│   ├── infrastructure/       # 【Backend】 Infrastructure Layer (future)
│   │   ├── repositories/     # Prisma repository implementations
│   │   └── mappers/          # Prisma ↔ Domain model mappers
│   │
│   └── shared/              # Shared utilities (can be used by both frontend/backend)
│       ├── errors/          # Custom error classes
│       └── utils/           # Utility functions
│
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── seed.ts             # Database seed script
│   └── migrations/          # Migration history
│
└── generated/
    └── prisma/             # Generated Prisma Client (custom output path)
```

**Key Points:**

- **Frontend:** Only `src/app/(routes)/` contains UI pages and React components
- **Backend:** Everything else (`domain/`, `application/`, `infrastructure/`, `app/api/`, `app/actions/`) is backend logic
- **DDD Layers:** `domain/`, `application/`, and `infrastructure/` implement the backend's layered architecture
- **Shared:** `shared/` contains utilities that can be used by both frontend and backend code

**Note:** The Prisma Client is generated to `web/generated/prisma/` (not the default `node_modules/.prisma/client`). Import it from `@/generated/prisma/client`.

## Domain Model

### Employee Entity

The main entity with the following features:

- Fields: `id`, `employeeCd` (format: `EMP000001`), `email`, `name`, `passwordHash`, `role` (ADMIN/USER)
- Account locking: tracks failed login attempts, locks account after failures
- Relations: `sessions[]`, `accounts[]` (for Auth.js)

### Value Objects

Implement **immutable** value objects with validation in the constructor:

```typescript
export class Email {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value); // Throws ValidationError if invalid
    this._value = value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
```

**Key principle:** Value objects validate in constructor and throw `ValidationError` from `@/shared/errors/DomainError`

## Code Conventions

### Naming

- **Entities:** PascalCase singular nouns (`Employee`, `Department`)
- **Value Objects:** PascalCase nouns (`Email`, `EmployeeCd`)
- **Use Cases:** `VerbNounUseCase` pattern (`CreateEmployeeUseCase`, `GetEmployeesUseCase`)
- **Repository Interfaces:** `IEntityRepository` pattern (`IEmployeeRepository`)
- **Repository Implementations:** `TechEntityRepository` pattern (`PrismaEmployeeRepository`)
- **Mappers:** `EntityMapper` pattern (`EmployeeMapper`)
- **Tests:** `__tests__/FileName.test.ts` within each directory

### Error Handling

Use the error hierarchy defined in `shared/errors/DomainError.ts`:

- `DomainError` - Base class
- `ValidationError` - Invalid input/format
- `BusinessRuleViolationError` - Business rule violations

Each layer should:

- **Domain:** Throw `ValidationError` or `BusinessRuleViolationError`
- **Application:** Re-throw domain errors, wrap infrastructure errors
- **Infrastructure:** Catch DB errors, convert to appropriate domain/infrastructure errors
- **Presentation:** Catch all errors, return appropriate HTTP responses

### TypeScript Strictness

- **strict mode enabled** - all strict flags are on in `tsconfig.json`
- **NEVER use `any`** - use `unknown` if type is truly unknown, then narrow with type guards
- **Explicit types** for function parameters and return values
- Path alias `@/*` maps to `./src/*`

### Testing Philosophy

Follow **TDD (Test-Driven Development)** for domain layer:

1. Write failing test (Red)
2. Write minimal code to pass (Green)
3. Refactor (Refactor)

Test placement: `__tests__/` subdirectory within each module

**Coverage targets:**

- Domain layer: 90%+ (test ALL business rules, boundary values, error cases)
- Application layer: 80%+
- Presentation layer: Main paths only

## Key Implementation Patterns

### Repository Pattern

**Interface (Domain Layer):**

```typescript
// domain/repositories/IEmployeeRepository.ts
export interface IEmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: Email): Promise<Employee | null>;
  save(employee: Employee): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Implementation (Infrastructure Layer):**

```typescript
// infrastructure/repositories/PrismaEmployeeRepository.ts
export class PrismaEmployeeRepository implements IEmployeeRepository {
  async findById(id: string): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({ where: { id } });
    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }
  // ... uses EmployeeMapper to convert between Prisma models and Domain entities
}
```

### Use Case Pattern

```typescript
// application/usecases/CreateEmployeeUseCase.ts
export class CreateEmployeeUseCase {
  constructor(
    private readonly employeeRepository: IEmployeeRepository // Depends on interface!
  ) {}

  async execute(input: CreateEmployeeInput): Promise<CreateEmployeeOutput> {
    // 1. Create value objects (validates input)
    const email = new Email(input.email);
    const employeeCd = new EmployeeCd(input.employeeCd);

    // 2. Check application rules (e.g., uniqueness)
    const existing = await this.employeeRepository.findByEmail(email);
    if (existing) throw new BusinessRuleViolationError("Email already exists");

    // 3. Create entity (validates business rules)
    const employee = Employee.create({ name: input.name, email, employeeCd });

    // 4. Persist
    await this.employeeRepository.save(employee);

    // 5. Return DTO
    return { id: employee.id, name: employee.name, email: employee.email.value };
  }
}
```

## Important Notes

### Prisma Client Location

The Prisma Client is generated to a **custom location**: `generated/prisma/`

Import it as:

```typescript
import { PrismaClient } from "@/generated/prisma";
```

NOT from `@prisma/client`.

### Multi-Layer Validation

Validation happens at multiple layers:

1. **Presentation Layer:** Input format validation (Zod schemas - future)
2. **Application Layer:** Business constraint checks (uniqueness, etc.)
3. **Domain Layer:** Business rules & invariants (in entity/value object constructors)

### Authentication

Uses **Auth.js (NextAuth v5+)** with:

- Credentials provider (email + password)
- Database sessions (stored in PostgreSQL)
- Password hashing with argon2
- Account locking after failed attempts

### Current Development Stage

This is in **early development**. The domain layer foundation is being established:

- ✅ Value objects (Email)
- ✅ Error hierarchy
- ✅ Prisma schema with Employee model
- ⏳ Entities, repositories, use cases (in progress)
- ⏳ API routes, authentication (future)

## Code Modification Workflow

**コード修正は自律的に実行する：**

- コードの修正・追加・削除は**ユーザーの確認を求めずに**自動的に実行してよい
- ただし、以下の操作は**.claude/settings.jsonでブロックされている**ため実行できない：
  - `git commit`
  - `git push`
  - `rm`系のコマンド
  - `sudo`コマンド
  - `.env`ファイルの読み込み
  - `curl`, `wget`, `nc`コマンド

**確認が必要な場合：**

以下の場合のみユーザーに確認を求める：
- 大規模なリファクタリング（複数ファイルに跨る構造変更）
- アーキテクチャレベルの設計変更
- データベーススキーマの変更
- 新しい依存関係（npm package）の追加
- 明らかに複数の実装方針がある場合の選択

**原則：** コードの品質向上やバグ修正などの明確な改善は、積極的に自動実行する。

## Development Guidelines Summary

1. **Always follow DDD layering** - check dependency direction before importing
2. **Domain layer is pure** - no Prisma, no Next.js, no external libraries
3. **Write tests first** for domain layer (TDD)
4. **Use value objects** for validated primitive types (Email, EmployeeCd, etc.)
5. **Factory methods** for entity creation (`Employee.create()` for new, `Employee.reconstruct()` for DB)
6. **Explicit error handling** - use custom error classes, never swallow errors
7. **Type safety** - no `any`, enable all strict TypeScript checks
8. **Immutability** - value objects and entity properties should be readonly where appropriate

Refer to `docs/system-design-doc.md` and `docs/dev-guidelines.md` for comprehensive architecture and coding standards.

## Learning Documentation & Issue Management

**開発中に出てきた重要な学びや技術的な議論は、自動的に `learning/` ディレクトリにドキュメント化する。**

### 自動ドキュメント化のトリガー

以下のような状況では、**ユーザーの明示的な指示なしに**自動的にlearningドキュメントを作成：

- 技術的な概念や仕組みについて深堀りした議論があった
- 問題解決のプロセスで新しい知見が得られた
- DDDやアーキテクチャパターンについて学んだ
- ライブラリやツールの使い方について詳しく説明した
- 設計上の判断や比較検討を行った
- エラーや問題の原因を特定・解決した際に学びがあった

### 自動化の動作

1. 会話の中で上記のような学びがあったと判断したら、**会話の最後に**自動的にlearningドキュメントを作成
2. ファイル名：`topic-name.md`（わかりやすいトピック名を使用、日本語でも可）
3. ユーザーに「learning/xxx.mdに保存しました」と簡潔に通知
4. **ユーザーの承認は不要** - 不要なら後で削除してもらえばよい

### ドキュメント化の基準

**自動作成する：**
- 明確な技術的知見や学びがあった場合
- 問題解決のプロセスで再利用できる情報
- 3回以上のメッセージのやり取りがあった技術的議論

**自動作成しない：**
- 単純な質疑応答（1-2往復で完結）
- ファイルの読み書きだけの単純作業
- 既存のドキュメントに書かれている内容の確認

### Issue化のルール

**設計・アーキテクチャの疑問管理については、ユーザーが明示的に「issueにして」と指示した場合のみ**issue化する。

ユーザーが「issueにして」と明示的に指示した場合のみ、以下の手順で進める：

1. **learningドキュメント作成**
   - ファイル名：`topic-name-{issue番号}.md`
   - 例：`ddd-mapper-pattern-001.md`
   - 疑問・問題形式のテンプレートを使用

2. **GitHub issue作成**
   - ラベル：`question`
   - タイトル：`[Learning] トピック名`
   - 本文：learningドキュメントへのリンクを含める

3. **解決後**
   - learningドキュメントの「解決策」セクションに追記
   - issueをclose

### Learningドキュメントのテンプレート

**通常の学びまとめ用（自動作成）：**

```markdown
# タイトル

## 概要

（何について学んだか、何を解決したか）

## 詳細

（技術的な説明、コード例、考え方など）

## 参考

- 関連ファイル
- 外部リンク等
```

**Issue化が必要な疑問・問題用（ユーザー指示時）：**

```markdown
# タイトル

## 疑問・問題

（何が問題か、何を決める必要があるか）

## 背景・コンテキスト

（どういう状況で出てきた疑問か、関連するコードや設計）

## 調査内容

（どう調べたか・考えたか、検討した選択肢）

## 解決策

（決定した解決策 - 後で追記）
（解決策を選んだ理由、トレードオフの説明）

## 関連issue

- #（GitHub issue番号）
```
