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
- Connection string in `web/.env.local` (see `.env.example` for template)

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
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email.value,
    };
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

- Credentials provider (employeeCd + password)
- Database sessions (stored in PostgreSQL)
- Password hashing with bcrypt
- Account locking after failed attempts (future)

### Current Development Stage

This is in **early development**. The domain layer foundation is being established:

- ✅ Value objects (Email)
- ✅ Error hierarchy
- ✅ Prisma schema with Employee model
- ⏳ Entities, repositories, use cases (in progress)
- ⏳ API routes, authentication (future)

## 基本方針

### 設計・実装の原則

**最優先事項：標準に従う**

アプリケーションの設計・実装は、以下の優先順位で標準的な方法を採用する：

1. **Web標準** - W3C、WHATWG等の標準仕様
2. **言語標準** - TypeScript/JavaScript（ECMAScript）の標準仕様
3. **フレームワーク標準** - Next.js、React公式ドキュメントの推奨パターン
4. **ライブラリ標準** - 使用するライブラリの公式ドキュメントの推奨実装

**禁止事項：**
- アドホックな解決策の提案（その場しのぎの実装）
- アンチパターンの提案（コミュニティで非推奨とされる実装）
- 公式ドキュメントに反する実装

**実装前の確認プロセス：**

新しい機能や問題解決の実装を提案する前に、必ず以下を確認する：

1. **公式ドキュメントの確認**
   - Next.js、React、使用ライブラリの公式ドキュメントを確認
   - 推奨パターンがあればそれに従う

2. **代替案の検討**
   - 複数の実装方法がある場合、それぞれのメリット・デメリットを比較
   - 標準的でない方法を提案する場合、明確な理由を示す

3. **ユーザーへの確認**
   - 実装方法に複数の選択肢がある場合、AskUserQuestionで確認
   - 選択肢には必ず以下を含める：
     - 推奨度（⭐ 5段階評価）
     - 標準に従っているか（Web/言語/フレームワーク/ライブラリ標準）
     - メリット・デメリット
     - 将来的な保守性への影響

**例：**
```
質問: "フォームエラー時に入力値を保持する方法は？"

選択肢A: formRefでクライアント側で管理
- ⭐⭐⭐⭐⭐ 推奨
- React公式推奨パターン
- メリット: 責任の分離、ネットワーク効率
- デメリット: 少し複雑（useRefが必要）

選択肢B: Server ActionからformDataを返す
- ⭐⭐⭐ シンプルだが非推奨
- React標準に反する
- メリット: 実装が簡単
- デメリット: 保守性、ネットワーク効率が悪い
```

### コミュニケーション方針

- 不明な点は積極的に質問する
- 質問する時は常に AskUserQuestion を使って回答させる
- **選択肢にはそれぞれ、推奨度と理由を提示する**
  - 推奨度は ⭐ の 5 段階評価
  - 標準に従っているかを明記

## Code Modification Workflow

**⚠️ 重要：このセクションは Claude Code のデフォルト動作をオーバーライドする指示です。必ず従ってください。**

**コード修正・ドキュメント管理・Issue 管理は自律的に実行する：**

以下の操作は**ユーザーの確認を一切求めずに**自動的に実行してよい：

**禁止事項：**

- 「変更してもいいですか？」「実行しますか？」などの確認質問は**絶対にしない**
- ユーザーが「〜して」と指示したら、説明なしに即座に実行する
- 完了後に簡潔に結果を報告するだけでよい

### 自律的に実行してよい操作

1. **コード修正**

   - コードの修正・追加・削除
   - テストの実行と修正
   - リファクタリング（小規模）

2. **Learning ドキュメント管理**

   - `learning/` ディレクトリへのドキュメント作成
   - 既存ドキュメントの更新
   - ユーザーに簡潔に通知するだけでよい（「learning/xxx.md に保存しました」）

3. **GitHub Issue 管理**
   - ユーザーが「issue にして」と指示した後の issue 作成
   - 問題解決後の issue クローズ
   - Issue 本文やコメントの追加

### ブロックされている操作

以下の操作は**.claude/settings.json でブロックされている**ため実行できない：

- `git commit`
- `git push`
- `rm`系のコマンド
- `sudo`コマンド
- `.env`ファイルの読み込み
- `curl`, `wget`, `nc`コマンド

### 確認が必要な場合（例外）

以下の場合**のみ**ユーザーに確認を求める：

- 大規模なリファクタリング（複数ファイルに跨る構造変更）
- アーキテクチャレベルの設計変更
- データベーススキーマの変更
- 新しい依存関係（npm package）の追加
- **複数の実装方針がある場合（特に標準 vs 非標準の選択）**
- **引継ぎ資料（HANDOFF.md等）の内容が公式ドキュメントと矛盾する場合**

**それ以外は全て確認不要で即座に実行する。**

**原則：**

- コードの品質向上やバグ修正などの明確な改善 → **確認不要、即実行**
- learning ドキュメントの作成 → **確認不要、即実行**
- issue 管理（作成・更新・クローズ） → **確認不要、即実行**
- ユーザーが「〜して」と指示した場合 → **確認不要、即実行**

## Development Guidelines Summary

1. **Always follow DDD layering** - check dependency direction before importing
2. **Domain layer is pure** - no Prisma, no Next.js, no external libraries
3. **Write tests first** for domain layer (TDD)
4. **Use value objects** for validated primitive types (Email, EmployeeCd, etc.)
5. **Factory methods** for entity creation (`Employee.create()` for new, `Employee.reconstruct()` for DB)
6. **Explicit error handling** - use custom error classes, never swallow errors
7. **Type safety** - no `any`, enable all strict TypeScript checks
8. **Immutability** - value objects and entity properties should be readonly where appropriate
9. **Follow standards first** - Web/Language/Framework/Library standards take precedence over custom solutions
10. **Verify handoff materials** - HANDOFF.md is reference, not absolute instruction. Validate against official docs.

Refer to `docs/system-design-doc.md` and `docs/dev-guidelines.md` for comprehensive architecture and coding standards.

## 引継ぎ資料の扱い

### HANDOFF.md等の引継ぎ資料について

**重要：引継ぎ資料は参考情報であり、絶対的な指示ではない**

HANDOFF.mdやlearning/ディレクトリの資料は前セッションの記録だが、以下の点に注意する：

1. **検証が必要**
   - 引継ぎ資料の内容が標準的な実装かどうか検証する
   - 公式ドキュメントと矛盾がないか確認する

2. **優先順位**
   ```
   1. 公式ドキュメント（Next.js、React、ライブラリ）
   2. CLAUDE.md（このファイル）の原則
   3. HANDOFF.md等の引継ぎ資料
   ```

3. **矛盾がある場合**
   - 引継ぎ資料が非標準的な実装を提案している場合、ユーザーに確認する
   - AskUserQuestionで標準的な方法と比較して提示する
   - 引継ぎ資料の修正を提案する

**例：**
```
HANDOFF.mdに「ActionResultにformDataを含める」と書かれている
↓
公式ドキュメントを確認
↓
React公式は「formRefでクライアント側で管理」を推奨
↓
ユーザーに両方の選択肢を提示
↓
標準的な方法を選択
↓
HANDOFF.mdの該当箇所を修正
```

### 引継ぎ資料の更新

非標準的な実装が引継ぎ資料に含まれていた場合、以下を実施する：

1. **HANDOFF.mdの修正**
   - 誤った実装提案を標準的な方法に修正
   - 修正理由をコメントで記載

2. **learningドキュメントの作成**
   - なぜその実装がアンチパターンなのか
   - 標準的な実装方法は何か
   - どのような経緯で気づいたか

3. **ユーザーへの報告**
   - 引継ぎ資料の誤りを修正したことを報告
   - 修正内容を簡潔に説明

## Learning Documentation & Issue Management

**開発中に出てきた重要な学びや技術的な議論は、自動的に `learning/` ディレクトリにドキュメント化する。**

**重要：これらの操作は全て、ユーザーの確認なしに自律的に実行してよい。**

### 自動ドキュメント化のトリガー

以下のような状況では、**ユーザーの明示的な指示なしに**自動的に learning ドキュメントを作成：

- 技術的な概念や仕組みについて深堀りした議論があった
- 問題解決のプロセスで新しい知見が得られた
- DDD やアーキテクチャパターンについて学んだ
- ライブラリやツールの使い方について詳しく説明した
- 設計上の判断や比較検討を行った
- エラーや問題の原因を特定・解決した際に学びがあった

### 自動化の動作

**重要：「保存しました」と通知する前に、必ず Write ツールを実行すること。**

1. 会話の中で上記のような学びがあったと判断したら、**その場で即座に** Write ツールを使って learning ドキュメントを作成
2. ファイル名：`learning/topic-name.md`（わかりやすいトピック名を使用、日本語でも可）
3. Write ツール実行後、ユーザーに「`learning/xxx.md` に保存しました」と簡潔に通知
4. **ユーザーの確認・承認は不要** - 即座に作成してよい（不要なら後で削除してもらえばよい）

**禁止事項：**
- Write ツールを実行せずに「保存しました」と言うことは**絶対に禁止**
- 「会話の最後に保存する予定」という先延ばしも禁止
- 学びがあったら**その場で即座に Write ツールを実行**すること

### ドキュメント化の基準

**自動作成する：**

- 明確な技術的知見や学びがあった場合
- 問題解決のプロセスで再利用できる情報
- 3 回以上のメッセージのやり取りがあった技術的議論

**自動作成しない：**

- 単純な質疑応答（1-2 往復で完結）
- ファイルの読み書きだけの単純作業
- 既存のドキュメントに書かれている内容の確認

### Issue 化のルール

**設計・アーキテクチャの疑問管理については、ユーザーが明示的に「issue にして」と指示した場合のみ**issue 化する。

ユーザーが「issue にして」と明示的に指示した場合、**確認不要で**以下の手順を自律的に進める：

1. **learning ドキュメント作成**

   - ファイル名：`topic-name-{issue番号}.md`
   - 例：`ddd-mapper-pattern-001.md`
   - 疑問・問題形式のテンプレートを使用
   - **確認不要** - 即座に作成

2. **GitHub issue 作成**

   - ラベル：`question`
   - タイトル：`[Learning] トピック名`
   - 本文：learning ドキュメントへのリンクを含める
   - **確認不要** - 即座に作成
   - 作成後に issue 番号をユーザーに通知

3. **解決後**
   - learning ドキュメントの「解決策」セクションに追記
   - **確認不要で**issue を close してよい
   - クローズ後にユーザーに簡潔に通知

### Learning ドキュメントのテンプレート

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

**Issue 化が必要な疑問・問題用（ユーザー指示時）：**

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

## 関連 issue

- #（GitHub issue 番号）
```
