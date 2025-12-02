# コードベース構造

## ディレクトリ構成

```
estimate-management-system/
├── src/
│   ├── app/                    # Presentation Layer (Next.js App Router)
│   │   └── api/               # API Routes
│   ├── subdomains/            # Domain ごとの実装
│   │   └── employee/          # Employee サブドメイン
│   │       ├── entities/      # エンティティ
│   │       ├── values/        # Value Objects
│   │       ├── repositories/  # Repository インターフェース
│   │       ├── services/      # Domain Services
│   │       ├── commands/      # Command (CQS パターン)
│   │       ├── queries/       # Query (CQS パターン)
│   │       │   └── dto/       # Query 用 DTO
│   │       ├── types/         # 型定義
│   │       └── infra/         # Infrastructure 実装
│   │           ├── prisma/    # Prisma Repository
│   │           ├── in-memory/ # InMemory Repository (テスト用)
│   │           ├── queries/   # Query Service 実装
│   │           └── mappers/   # Domain ↔ Prisma マッパー
│   └── shared/                # 共有ユーティリティ
│       └── errors/            # エラークラス定義
├── prisma/
│   ├── schema.prisma          # Prisma スキーマ
│   └── seed.ts                # シードスクリプト
├── generated/
│   └── prisma/                # 生成された Prisma Client
├── docs/
│   ├── system-design-doc.md   # システム設計書
│   ├── dev-guidelines.md      # 開発ガイドライン
│   └── ddd-architecture-overview.md
├── lib/                       # ユーティリティライブラリ
├── public/                    # 静的ファイル
└── learning/                  # 学習メモ
```

## 主要ファイル

### Employee サブドメイン
- `src/subdomains/employee/entities/Employee.ts` - Employee エンティティ
- `src/subdomains/employee/values/EmployeeCd.ts` - 社員コード Value Object
- `src/subdomains/employee/values/Password.ts` - パスワード Value Object
- `src/subdomains/employee/repositories/IEmployeeRepository.ts` - Repository インターフェース
- `src/subdomains/employee/commands/CreateEmployeeCommand.ts` - 社員作成コマンド
- `src/subdomains/employee/commands/UpdateEmployeeCommand.ts` - 社員更新コマンド
- `src/subdomains/employee/commands/DeleteEmployeeCommand.ts` - 社員削除コマンド

### テスト
各ディレクトリ内の `__tests__/` フォルダにテストファイルを配置：
- `src/subdomains/employee/entities/__tests__/Employee.test.ts`
- `src/subdomains/employee/values/EmployeeCd.test.ts`
- `src/subdomains/employee/values/Password.test.ts`

### 設定ファイル
- `tsconfig.json` - TypeScript 設定
- `vitest.config.ts` - Vitest 設定
- `eslint.config.mjs` - ESLint 設定
- `next.config.ts` - Next.js 設定
- `prisma.config.ts` - Prisma 設定
