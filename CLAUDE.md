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

```
web/
├── src/
│   ├── app/                    # Next.js App Router (Presentation Layer)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── api/               # API Routes (future)
│   │   └── actions/           # Server Actions (future)
│   │
│   ├── application/           # Application Layer (future)
│   │   └── usecases/         # Use case classes (CreateUserUseCase, etc.)
│   │
│   ├── domain/               # Domain Layer ⚠️ NO external dependencies!
│   │   ├── entities/         # Business entities (User, etc.)
│   │   ├── valueObjects/     # Value objects (Email, EmployeeId, etc.)
│   │   ├── services/         # Domain services
│   │   └── repositories/     # Repository interfaces ONLY
│   │
│   ├── infrastructure/       # Infrastructure Layer (future)
│   │   ├── repositories/     # Prisma repository implementations
│   │   └── mappers/          # Prisma ↔ Domain model mappers
│   │
│   └── shared/              # Shared utilities
│       ├── errors/          # Custom error classes
│       └── utils/           # Utility functions
│
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Migration history
│
└── generated/
    └── prisma/             # Generated Prisma Client (custom output path)
```

**Note:** The Prisma Client is generated to `web/generated/prisma/` (not the default `node_modules/.prisma/client`).

## Domain Model

### User Entity

The main entity with the following features:

- Fields: `id`, `employeeId` (format: `EMP000001`), `email`, `name`, `passwordHash`, `role` (ADMIN/USER)
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

- **Entities:** PascalCase singular nouns (`User`, `Department`)
- **Value Objects:** PascalCase nouns (`Email`, `EmployeeId`)
- **Use Cases:** `VerbNounUseCase` pattern (`CreateUserUseCase`, `GetUsersUseCase`)
- **Repository Interfaces:** `IEntityRepository` pattern (`IUserRepository`)
- **Repository Implementations:** `TechEntityRepository` pattern (`PrismaUserRepository`)
- **Mappers:** `EntityMapper` pattern (`UserMapper`)
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
// domain/repositories/IUserRepository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Implementation (Infrastructure Layer):**

```typescript
// infrastructure/repositories/PrismaUserRepository.ts
export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const prismaUser = await prisma.user.findUnique({ where: { id } });
    return prismaUser ? UserMapper.toDomain(prismaUser) : null;
  }
  // ... uses UserMapper to convert between Prisma models and Domain entities
}
```

### Use Case Pattern

```typescript
// application/usecases/CreateUserUseCase.ts
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository // Depends on interface!
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    // 1. Create value objects (validates input)
    const email = new Email(input.email);

    // 2. Check application rules (e.g., uniqueness)
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new BusinessRuleViolationError("Email already exists");

    // 3. Create entity (validates business rules)
    const user = User.create({ name: input.name, email });

    // 4. Persist
    await this.userRepository.save(user);

    // 5. Return DTO
    return { id: user.id, name: user.name, email: user.email.value };
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
- ✅ Prisma schema with User model
- ⏳ Entities, repositories, use cases (in progress)
- ⏳ API routes, authentication (future)

## Development Guidelines Summary

1. **Always follow DDD layering** - check dependency direction before importing
2. **Domain layer is pure** - no Prisma, no Next.js, no external libraries
3. **Write tests first** for domain layer (TDD)
4. **Use value objects** for validated primitive types (Email, EmployeeId, etc.)
5. **Factory methods** for entity creation (`User.create()` for new, `User.reconstruct()` for DB)
6. **Explicit error handling** - use custom error classes, never swallow errors
7. **Type safety** - no `any`, enable all strict TypeScript checks
8. **Immutability** - value objects and entity properties should be readonly where appropriate

Refer to `docs/system-design-doc.md` and `docs/dev-guidelines.md` for comprehensive architecture and coding standards.

## Learning Documentation

When the user asks to summarize a specific topic they've discussed, create a markdown file in the `learning/` directory with the topic summary. This helps track web development concepts learned during app development.
