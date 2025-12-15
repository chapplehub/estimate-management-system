# Server Actions の配置と責務分離

## 概要

責務が混在していた `actions.ts` に対して抱いた違和感を分析し、真の問題点と解決策を明らかにした。

## 疑問

`actions.ts` に対して、以下の3つの違和感があった：

1. **サーバアクションでありながら `app/` に存在している**
2. **フロントエンド側でやるつもりの Zod バリデーションをサーバアクションで行っている**
3. **フロントエンド側であるにもかかわらず、`PrismaEmployeeRepository` 等を利用してサーバ側の利用技術が漏れている**

## 詳細

### 1. actions.ts は app/ に置くのが正しい

- Server Actions は **プレゼンテーション層** の一部である
- Next.js の標準パターンに従っている
- 設計ドキュメント（system-design-doc.md）でも `app/(features)/employees/new/actions.ts` と記載

**結論**: actions.ts の配置場所は問題ではなかった

### 2. Zod バリデーションも app/ で行うのが正しい

プレゼンテーション層の責務として設計ドキュメントに明記されている：

```
プレゼンテーション層の責務
- HTTPリクエストの受付
- 入力値の形式バリデーション (Zod)  ← ここ
- 認証・認可の確認
- ユースケースの呼び出し
- レスポンスの整形・返却
```

**結論**: Zod バリデーションの位置も問題ではなかった

### 3. 本当の問題は「インフラ層への直接依存」

```typescript
// ❌ これが問題
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";

const repository = new PrismaEmployeeRepository();
const command = new CreateEmployeeCommand(repository, ...);
```

`app/`（プレゼンテーション層）から `PrismaEmployeeRepository`（インフラ層）を直接参照しているため、レイヤー間の依存関係が乱れていた。

## 解決策: Composition Root（ファクトリ）パターン

**ファクトリを `server/` に作成し、actions.ts からはそれを呼び出すだけにする**

```
src/
├── app/(features)/employees/new/
│   └── actions.ts          # プレゼンテーション層
│
└── server/subdomains/employee/application/
    └── factories/
        └── createEmployeeCommandFactory.ts  # Composition Root
```

**ファクトリ関数（server/ に配置）:**

```typescript
// src/server/subdomains/employee/application/factories/createEmployeeCommandFactory.ts
export function createEmployeeCommandFactory(): CreateEmployeeCommand {
  const repository = new PrismaEmployeeRepository();
  return new CreateEmployeeCommand(
    repository,
    new EmployeeCdDuplicationCheckDomainService(repository),
    new MailAddressDuplicationCheckDomainService(repository)
  );
}
```

**修正後の actions.ts:**

```typescript
// DIはファクトリで解決（インフラ層への依存をserver/側に閉じ込める）
const command = createEmployeeCommandFactory();
await command.execute(validationResult.data);
```

## 責務の整理

| 層 | 配置 | 責務 |
|---|------|------|
| **Presentation** | `app/actions.ts` | 認証チェック、Zodバリデーション、ファクトリ呼び出し、レスポンス整形 |
| **Composition Root** | `server/.../factories/` | DIの解決、具体的なリポジトリ実装の組み立て |
| **Application** | `server/.../commands/` | ビジネスフローの制御、ユースケース実行 |
| **Domain** | `server/.../domain/` | ビジネスルール |
| **Infrastructure** | `server/.../infrastructure/` | Prisma実装 |

## 教訓

- **違和感の原因を正確に特定することが重要**
  - 「app/ にある」こと自体は問題ではなかった
  - 「Zod バリデーション」も問題ではなかった
  - **真の問題は「インフラ層への直接依存」だった**

- **レイヤー間の依存関係を守るためには、DI の責務を適切な場所に配置する**
  - Composition Root（ファクトリ）をバックエンド側に置くことで、フロントエンドからインフラ層への依存を排除できる

## 参考

- `src/app/(features)/employees/new/actions.ts` - リファクタリング後のServer Action
- `src/app/(features)/employees/[employeeCd]/actions.ts` - リファクタリング後のServer Action
- `src/server/subdomains/employee/application/factories/` - 作成したファクトリ群
- `docs/system-design-doc.md` - DDDレイヤー詳細（3.2節）
- `docs/dev-guidelines.md` - DDD アーキテクチャ実装規則（5章）
