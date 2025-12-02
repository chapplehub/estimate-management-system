# プロジェクト概要

## 名称
見積管理システム (Estimate Management System)

## 目的
DDD（ドメイン駆動設計）とモダンなWeb開発手法を学習するための社内業務アプリケーション。
想定ユーザー数：約100人（社内利用のみ）

## 技術スタック

### フロントエンド
- **Next.js 16** (App Router)
- **React 19**
- **TailwindCSS 4**

### バックエンド
- **Next.js API Routes**
- **Prisma ORM** (v6.18.0)
- **PostgreSQL** (localhost:5432)

### テスト
- **Vitest** (v4.0.2)

### 認証
- **Better Auth** (v1.4.1)

### その他
- **TypeScript 5** (strict mode)
- **Zod 4** (バリデーション)
- **ESLint 9**

## アーキテクチャ
**DDD（ドメイン駆動設計）+ レイヤードアーキテクチャ**

```
Presentation Layer (Next.js App Router)
    ↓ depends on
Application Layer (Commands/Queries)
    ↓ depends on
Domain Layer (Entities, Value Objects, Repository Interfaces)
    ↑ implemented by
Infrastructure Layer (Prisma Repositories, Mappers)
```

## 重要な注意点

### Prisma Client の場所
Prisma Client は **カスタム場所** に生成される: `generated/prisma/`

```typescript
// ✅ 正しい
import { PrismaClient } from '@/generated/prisma';

// ❌ 間違い
import { PrismaClient } from '@prisma/client';
```

### レイヤー間の依存ルール（絶対厳守）
1. **Domain 層は外部ライブラリに依存してはならない**（Prisma, Next.js など）
2. Application 層は Repository **インターフェース** を使用
3. Infrastructure 層が Domain インターフェースを実装

## 現在の開発段階
早期開発段階：
- ✅ Value Objects (EmployeeCd, Password)
- ✅ エラー階層
- ✅ Prisma スキーマ (Employee モデル)
- ✅ Employee エンティティ
- ✅ Repository 実装 (Prisma, InMemory)
- ✅ Commands/Queries (CQRS パターン)
- ⏳ API Routes, 認証（今後）
