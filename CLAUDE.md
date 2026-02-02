# CLAUDE.md

## Tech Stack

Next.js 16 (App Router), React 19, Prisma ORM, PostgreSQL, Vitest, TailwindCSS 4, DDD architecture

## Commands

```bash
pnpm dev / build / test / lint
pnpm db:migrate / db:generate / db:studio
```

## Critical: DDD Layering Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma <-> Domain mapping

## Directory Structure

```
src/app/                    - Presentation Layer (Next.js App Router)
src/server/subdomains/[name]/
  ├── domain/               - Domain Layer (NO external dependencies!)
  ├── application/          - Application Layer (Commands, Queries)
  └── infrastructure/       - Infrastructure Layer (Prisma Repositories)
src/server/shared/          - Server-side shared code
src/shared/                 - Frontend/Backend shared code
```

## Path Aliases

- `@server/*` -> `./src/server/*`
- `@subdomains/*` -> `./src/server/subdomains/*`
- `@shared/*` -> `./src/shared/*`
- `@generated/*` -> `./generated/*`

## Important Notes

**Prisma Client location:** `generated/prisma/` (NOT `@prisma/client`)

```typescript
import { PrismaClient } from "@generated/prisma";
```

## Reference

- DDD implementation patterns: `/ddd-architecture` skill or `docs/dev-guidelines.md`
- System design: `docs/system-design-doc.md`
