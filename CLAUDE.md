# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 設計・実装の基本方針

このセクションは汎用的な指針であり、他のプロジェクトでも使いまわし可能です。

### 原則：標準に従う

**最優先事項：標準に従う**

アプリケーションの設計・実装は、以下の優先順位で標準的な方法を採用する：

1. **Web 標準** - W3C、WHATWG 等の標準仕様
2. **言語標準** - TypeScript/JavaScript（ECMAScript）の標準仕様
3. **フレームワーク標準** - Next.js、React 公式ドキュメントの推奨パターン
4. **ライブラリ標準** - 使用するライブラリの公式ドキュメントの推奨実装

**禁止事項：**

- アドホックな解決策の提案（その場しのぎの実装）
- アンチパターンの提案（コミュニティで非推奨とされる実装）
- 公式ドキュメントに反する実装

### ドキュメント参照の原則

実装や調査を行う際は、必ず以下の原則に従うこと：

#### 1. 使用バージョンの確認

- プロジェクトの依存関係管理ファイル（`package.json`, `requirements.txt`, `go.mod` など）で使用中のバージョンを確認
- 参照するドキュメントは必ず使用バージョンに対応したものを使用
- バージョン不一致のドキュメントを参照すると、非推奨の実装や存在しない API を提案するリスクがある

#### 2. ドキュメント URL の検証

- **WebFetch ツールや検索結果から得た URL をそのまま提示しない**
- WebFetch ツールはリダイレクトを透過的に処理するため、古い URL や存在しない URL を参照している可能性がある
- 必ず以下を確認：
  - URL が実際にアクセス可能か
  - リダイレクトされていないか
  - バージョン番号が URL に含まれている場合、使用バージョンと一致しているか
- ユーザーに提示する URL は、**ユーザーが実際にアクセスできる正しい URL**であること

#### 3. 公式ドキュメントの探し方

正しい手順：

1. 依存関係管理ファイルでバージョンを確認
2. 公式ドキュメントのトップページにアクセス
3. 目次や検索機能を使って該当ページを探す
4. 見つけた URL が使用バージョンに対応していることを確認
5. その URL を提示する

誤った手順（やってはいけない）：

- ❌ 記憶や推測で URL を構築する
- ❌ 記憶や推測で API・メソッドの使い方を実装する
- ❌ WebFetch 結果の URL をそのまま提示する（リダイレクトの可能性）
- ❌ 古いバージョンのドキュメントを参照する

#### 4. API レベルの実装ルール

ライブラリの個別の API・メソッドを使用する際も、以下を遵守する：

1. **使用前に必ずドキュメント確認**

   - 記憶に頼らず、使用バージョンの公式ドキュメントを確認
   - 特に以下の場合は必須：
     - 新しいライブラリを初めて使う
     - メジャーバージョンが上がっている（v3 → v4 など）
     - 非推奨警告が出ている

2. **確認の手順**

   - package.json でバージョン確認
   - WebFetch で公式ドキュメントの該当ページを参照
   - 推奨パターンを確認してから実装

3. **実装例**

   ❌ 悪い例：

   ```typescript
   // 記憶に基づいて実装（Zod v3のパターン）
   const errors = result.error.flatten().fieldErrors;
   ```

   ✓ 良い例：

   ```typescript
   // 1. package.jsonでZod v4を確認
   // 2. https://zod.dev/error-formatting で推奨方法を確認
   // 3. 確認した方法で実装
   const { fieldErrors } = z.flattenError(result.error);
   ```

### 実装前の確認プロセス

新しい機能や問題解決の実装を提案する前に、**および個別の API・メソッドを使用する前に**、必ず以下を確認する：

1. **使用バージョンの確認**

   - 依存関係管理ファイル（例: `package.json`）で使用している技術スタックのバージョンを確認
   - 参照するドキュメントは必ず使用バージョンに対応したものを使用
   - バージョン不一致のドキュメントを参照した場合、ユーザーに訂正を求められる

2. **公式ドキュメントの確認**

   - 使用技術の**使用バージョンに対応した**公式ドキュメントを確認
   - 推奨パターンがあればそれに従う
   - **ドキュメント URL が正しいことを検証**（上記「ドキュメント参照の原則」参照）
   - リダイレクトされた URL や古い URL を提示しない

3. **代替案の検討**

   - 複数の実装方法がある場合、それぞれのメリット・デメリットを比較
   - 標準的でない方法を提案する場合、明確な理由を示す

4. **ユーザーへの確認**
   - 実装方法に複数の選択肢がある場合、AskUserQuestion で確認
   - 選択肢には推奨度（⭐ 5 段階評価）、標準準拠、メリット・デメリット、保守性への影響を含める

### 引継ぎ資料の扱い

**重要：引継ぎ資料は参考情報であり、絶対的な指示ではない**

引継ぎ資料の扱い方の詳細は `HANDOFF.md` の冒頭セクション「このファイルの扱い方」を参照

### コミュニケーション方針

- 不明な点は積極的に質問する
- 質問する時は常に AskUserQuestion を使って回答させる
- **選択肢にはそれぞれ、推奨度と理由を提示する**
  - 推奨度は ⭐ の 5 段階評価
  - 標準に従っているかを明記

---

## プロジェクト固有の情報

以下のセクションはこのプロジェクト特有の情報です。

### Project Overview

This is an **estimate management system** - an internal business application built for learning DDD (Domain-Driven Design) and modern web development practices. Peak usage: ~100 users (internal only).

**Tech Stack:**

- Frontend: Next.js 16 (App Router), React 19, TailwindCSS 4
- Backend: Next.js API Routes, Prisma ORM, PostgreSQL
- Testing: Vitest
- Authentication: Auth.js (NextAuth) with credentials provider
- Architecture: DDD (Domain-Driven Design) with layered architecture

**このプロジェクトの主要技術ドキュメント:**

参考として、このプロジェクトで使用している主要技術のドキュメント URL：

- **Next.js**: https://nextjs.org/docs
- **React**: https://react.dev/
- **Prisma**: https://www.prisma.io/docs
- **Auth.js**: https://authjs.dev/

### Development Commands

All commands should be run from the project root directory:

```bash
# Development
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
- Connection string in `.env.local` (see `.env.example` for template)

### Architecture & Structure

This project follows **Domain-Driven Design (DDD)** with strict layered architecture:

#### Layered Architecture

```
Presentation Layer (Next.js App Router)
    ↓ depends on
Application Layer (Use Cases)
    ↓ depends on
Domain Layer (Entities, Value Objects, Repository Interfaces)
    ↑ implemented by
Infrastructure Layer (Prisma Repositories, Mappers)
```

#### Critical Dependency Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries (except for error handling utilities in `shared/`)
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma ↔ Domain model mapping

#### Directory Structure

**Important:** This is a **fullstack application** using Next.js with DDD layered architecture.

**詳細なディレクトリ構成:** `docs/system-design-doc.md` の「4. ディレクトリ構成」を参照

**主要レイヤー:**

- `src/app/` - Presentation Layer (Next.js App Router)
- `src/application/` - Application Layer (Use Cases)
- `src/domain/` - Domain Layer ⚠️ **NO external dependencies!**
- `src/infrastructure/` - Infrastructure Layer (Prisma Repositories, Mappers)
- `src/shared/` - Shared utilities

**Note:** Prisma Client は `generated/prisma/` に生成される（デフォルトの `node_modules/.prisma/client` ではない）。`@generated/prisma` から import すること。

### Domain Model

**ドメインモデルの詳細:** `docs/system-design-doc.md` の「6. ドメインモデル設計」を参照

**主要エンティティ:**

- Employee: 従業員情報（employeeCd 形式: `EMP000001`）

**Value Objects 実装原則:**

- Immutable（不変）
- コンストラクタでバリデーション
- バリデーション失敗時は `ValidationError` を throw（`@/shared/errors/DomainError`）

### Code Conventions

**コーディング規約の詳細:** `docs/dev-guidelines.md` を参照

**主要な規約:**

- **Naming:** Entities（PascalCase 単数形）, Value Objects（PascalCase）, Use Cases（`VerbNounUseCase`）
- **Error Handling:** `shared/errors/DomainError.ts` のエラー階層を使用
- **TypeScript:** strict mode 有効、`any` 禁止
- **Testing:** TDD（Red-Green-Refactor）, Domain 層 90%+カバレッジ目標

### Key Implementation Patterns

**実装パターンの詳細:** `docs/dev-guidelines.md` の「5. DDD アーキテクチャ実装規則」を参照

**主要パターン:**

- **Repository Pattern:** Domain 層でインターフェース定義、Infrastructure 層で実装（Prisma）
- **Use Case Pattern:** Application 層でビジネスロジックを実装
- **Mapper Pattern:** Prisma ↔ Domain モデル間の変換

### Important Notes

#### Prisma Client Location

The Prisma Client is generated to a **custom location**: `generated/prisma/`

Import it as:

```typescript
import { PrismaClient } from "@/generated/prisma";
```

NOT from `@prisma/client`.

#### Multi-Layer Validation

Validation happens at multiple layers:

1. **Presentation Layer:** Input format validation (Zod schemas - future)
2. **Application Layer:** Business constraint checks (uniqueness, etc.)
3. **Domain Layer:** Business rules & invariants (in entity/value object constructors)

#### Authentication

Uses **Auth.js (NextAuth v5+)** with:

- Credentials provider (employeeCd + password)
- Database sessions (stored in PostgreSQL)
- Password hashing with bcrypt
- Account locking after failed attempts (future)

#### Current Development Stage

This is in **early development**. The domain layer foundation is being established:

- ✅ Value objects (Email)
- ✅ Error hierarchy
- ✅ Prisma schema with Employee model
- ⏳ Entities, repositories, use cases (in progress)
- ⏳ API routes, authentication (future)

### Development Guidelines Summary

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
