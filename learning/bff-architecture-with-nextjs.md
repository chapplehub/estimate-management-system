# BFFアーキテクチャとNext.jsの統合設計

## 概要

フロントエンド（app/）とバックエンド（subdomains/）を明確に分離し、subdomainsをBFF（Backend For Frontend）として機能させる設計について検討した。

## 設計思想

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────┤
│  app/                                                    │
│  ├── (routes)/                  ← UI層（React）         │
│  │   ├── employees/                                      │
│  │   │   └── page.tsx                                   │
│  │   └── estimates/                                      │
│  │       └── page.tsx                                   │
│  ├── actions/                   ← Server Actions        │
│  │   ├── employee.ts           （Frontend→Backend接続）  │
│  │   └── estimate.ts                                     │
│  └── api/                      ← API Routes（将来）     │
│      └── employees/route.ts                              │
└─────────────────────────────────────────────────────────┘
                           ↓ RPC / HTTP
┌─────────────────────────────────────────────────────────┐
│              Backend (BFF - DDD Layers)                  │
├─────────────────────────────────────────────────────────┤
│  subdomains/                                             │
│  ├── employee/                  ← Bounded Context       │
│  │   ├── entities/             (Domain層)               │
│  │   ├── values/                                         │
│  │   ├── repositories/                                   │
│  │   ├── services/                                       │
│  │   ├── commands/             (Application層)          │
│  │   ├── queries/                                        │
│  │   └── infra/                (Infrastructure層)       │
│  └── estimate/                                           │
│      └── (同様の構造)                                    │
└─────────────────────────────────────────────────────────┘
```

## メリット

### 1. 明確な責務分離
- **app/**: UIとユーザー体験に集中
- **subdomains/**: ビジネスロジックとデータ整合性に集中

### 2. フロントエンドの自由度
- UIフレームワークを変更しても（Next.js → Remix等）、`subdomains/`は影響を受けない
- モバイルアプリを追加する際も同じBFFを使える

### 3. テスタビリティ
- バックエンドロジック（subdomains）は完全に独立してテスト可能
- フロントエンドのコンポーネントテストも独立して可能

### 4. スケーラビリティ
- 将来的に`subdomains/`を別プロセス（Express/Fastify等）に切り出せる
- マイクロサービス化への移行が容易

### 5. DDDの純粋性
- `subdomains/`内のドメインモデルがReactやNext.jsに汚染されない
- 真の「バックエンド」として、フレームワーク非依存を保てる

## デメリットと対処法

### デメリット1: Next.jsの強みを活かしきれない可能性

Next.jsはフルスタックフレームワークで、Server ComponentsやServer Actionsでフロントエンドとバックエンドの境界を曖昧にする設計思想。

**対処法**: Server ActionsをBFFへのAdapter層として活用

```typescript
// app/actions/employee.ts (Frontend層)
"use server";

import { EmployeeApplicationService } from "@/subdomains/employee/commands/EmployeeApplicationService";

export async function createEmployee(formData: FormData) {
  // app層 → subdomains層への橋渡し
  const service = new EmployeeApplicationService(/* DI */);

  const result = await service.registerEmployee({
    email: formData.get("email") as string,
    name: formData.get("name") as string,
  });

  return result; // DTOをそのまま返す
}
```

### デメリット2: オーバーエンジニアリングのリスク

100ユーザー規模の社内アプリでBFFまで分離するのは過剰設計になる可能性。

**判断基準**:
- ✅ DDD学習が目的なら、この設計は**最適**（原則を正しく学べる）
- ✅ 将来的にモバイルアプリやマイクロサービス化を視野に入れているなら**最適**
- ⚠️ 短期間でMVPを作りたいだけなら過剰

**このプロジェクトの場合**: 「DDD学習」が目的なので、この設計は**非常に適切**

### デメリット3: 型共有の複雑さ

フロントエンド（app/）とバックエンド（subdomains/）で型定義をどう共有するか。

**対処法**: DTOを共有型として活用

```typescript
// subdomains/employee/queries/dto/EmployeeDTO.ts
export type EmployeeDTO = {
  id: string;
  email: string;
  name: string;
  employeeCd: string;
};
```

```typescript
// app/(routes)/employees/page.tsx
import type { EmployeeDTO } from "@/subdomains/employee/queries/dto/EmployeeDTO";

async function EmployeesPage() {
  const employees: EmployeeDTO[] = await getEmployees(); // Server Action
  // ...
}
```

**重要**: DTOはプリミティブ型のみで構成されるべき（Value Objectを含まない）

## 依存関係のルール

この設計における依存方向：

```
app/
├── (routes)/         → app/actions/ を呼ぶ
└── actions/          → subdomains/ を呼ぶ

subdomains/           → app/ を一切参照しない（完全に独立）
```

### 絶対に守るべきルール

- ❌ `subdomains/`内から`app/`をimportしてはいけない
- ❌ `subdomains/`内でReact Hooksを使ってはいけない
- ❌ `subdomains/`内でNext.js固有の機能を使ってはいけない
- ✅ `app/`から`subdomains/`のDTO型をimportするのはOK
- ✅ `app/actions/`から`subdomains/`のサービスを呼ぶのはOK

## 実装パターン例

### パターン1: Server Actions経由（推奨）

```typescript
// subdomains/employee/commands/EmployeeApplicationService.ts
export class EmployeeApplicationService {
  async registerEmployee(command: RegisterEmployeeCommand): Promise<EmployeeDTO> {
    // ビジネスロジック
  }
}
```

```typescript
// app/actions/employee.ts
"use server";

import { EmployeeApplicationService } from "@/subdomains/employee/commands/EmployeeApplicationService";

export async function registerEmployee(command: RegisterEmployeeCommand) {
  const service = new EmployeeApplicationService(/* DI */);
  return await service.registerEmployee(command);
}
```

```typescript
// app/(routes)/employees/new/page.tsx
"use client";

import { registerEmployee } from "@/app/actions/employee";

export default function NewEmployeePage() {
  async function handleSubmit(formData: FormData) {
    await registerEmployee({
      email: formData.get("email") as string,
    });
  }

  return <form action={handleSubmit}>...</form>;
}
```

### パターン2: API Routes経由（将来的なマイクロサービス化を見据える場合）

```typescript
// app/api/employees/route.ts
import { EmployeeApplicationService } from "@/subdomains/employee/commands/EmployeeApplicationService";

export async function POST(request: Request) {
  const body = await request.json();
  const service = new EmployeeApplicationService(/* DI */);
  const result = await service.registerEmployee(body);
  return Response.json(result);
}
```

## 結論

**subdomains = BFF という考え方は正しい**

この設計により：
1. ✅ DDDの原則を正しく学べる
2. ✅ フロントエンドとバックエンドの関心事が明確に分離
3. ✅ 将来的な拡張性（マイクロサービス化、モバイルアプリ追加）を確保
4. ✅ テストがしやすい
5. ✅ Next.jsの機能（Server Actions）も活用できる

### 推奨アクション

- `subdomains/`内にpresentation層は**作らない**
- フロントエンド関連は全て`app/`に配置
- `app/actions/`をBFFへのAdapter層として活用
- DTOを使ってapp/とsubdomains/間で型安全にデータをやり取り

## 参考

- 日付: 2025-11-12
- 関連ドキュメント: `docs/ddd-architecture-overview.md`
