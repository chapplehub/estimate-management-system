# コードベース構造

## ディレクトリ構成

```
estimate-management-system/
├── src/
│   ├── app/                              # Presentation Layer (Next.js App Router)
│   │   ├── _lib/
│   │   │   └── auth-client.ts           # クライアントサイド認証
│   │   ├── api/auth/[...all]/
│   │   │   └── route.ts                 # better-auth ハンドラ
│   │   ├── employees/
│   │   │   ├── page.tsx                 # 従業員一覧
│   │   │   ├── _lib/error-handler.ts
│   │   │   ├── new/actions.ts           # Server Actions
│   │   │   └── [employeeCd]/actions.ts
│   │   └── layout.tsx
│   │
│   ├── server/                           # バックエンドロジック
│   │   ├── auth.ts                      # better-auth 設定
│   │   ├── prisma.ts                    # Prisma Client singleton
│   │   ├── subdomains/                  # DDDサブドメイン
│   │   │   └── employee/
│   │   │       ├── domain/              # Domain Layer
│   │   │       │   ├── entities/Employee.ts
│   │   │       │   ├── values/EmployeeCd.ts, Password.ts
│   │   │       │   ├── types/Role.ts
│   │   │       │   ├── repositories/IEmployeeRepository.ts
│   │   │       │   └── services/
│   │   │       ├── application/         # Application Layer
│   │   │       │   ├── commands/Create/Update/DeleteEmployeeCommand.ts
│   │   │       │   └── queries/dto/, IEmployeeQueryService.ts, Get*Query.ts
│   │   │       └── infrastructure/      # Infrastructure Layer
│   │   │           ├── prisma/PrismaEmployeeRepository.ts
│   │   │           ├── in-memory/InMemoryEmployeeRepository.ts
│   │   │           ├── queries/PrismaEmployeeQueryService.ts
│   │   │           └── mappers/EmployeeMapper.ts
│   │   └── shared/                      # サーバーサイド共有
│   │       ├── domain/values/MailAddress.ts
│   │       ├── errors/DomainError.ts, ApplicationError.ts
│   │       ├── ValueObject.ts
│   │       └── StringValueObject.ts
│   │
│   └── shared/                          # フロント/バック共通
│       └── types/ActionResult.ts
│
├── generated/prisma/                    # Prisma Client生成先
├── prisma/schema.prisma, migrations/, seed.ts
└── docs/, learning/
```

## パスエイリアス
- `@server/*` → `./src/server/*`
- `@subdomains/*` → `./src/server/subdomains/*`
- `@shared/*` → `./src/shared/*`
- `@generated/*` → `./generated/*`
- `@/*` → `./src/*`

## 主要ファイル

### Employee サブドメイン (src/server/subdomains/employee/)
- `domain/entities/Employee.ts` - Employee エンティティ
- `domain/values/EmployeeCd.ts` - 社員コード Value Object
- `domain/values/Password.ts` - パスワード Value Object
- `domain/repositories/IEmployeeRepository.ts` - Repository インターフェース
- `application/commands/*Command.ts` - 作成/更新/削除コマンド
- `application/queries/*Query.ts` - クエリ

### テスト
各ディレクトリ内の `__tests__/` フォルダにテストファイルを配置

### 設定ファイル
- `tsconfig.json` - TypeScript 設定（パスエイリアス）
- `vitest.config.ts` - Vitest 設定（パスエイリアス）
- `next.config.ts` - Next.js 設定
