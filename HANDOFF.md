# 作業引継ぎ資料

**作成日:** 2025-11-15
**次のセッションで実施する作業:** Zod導入・Auth.js導入・ログイン画面実装

---

## 現在の完了状況

### ✅ 完了済み

#### Employee CRUD機能の実装
- **一覧画面:** `/employees` (GET)
- **新規登録画面:** `/employees/new` (POST)
- **詳細・編集画面:** `/employees/[employeeCd]` (GET/PUT/DELETE)

**実装ファイル:**
- `app/employees/page.tsx` - 一覧表示
- `app/employees/new/page.tsx` - 新規登録ページ
- `app/employees/new/EmployeeCreateForm.tsx` - 新規登録フォーム（Client Component）
- `app/employees/[employeeCd]/page.tsx` - 詳細・編集ページ
- `app/employees/[employeeCd]/EmployeeUpdateForm.tsx` - 更新フォーム（Client Component）
- `app/employees/[employeeCd]/EmployeeDeleteForm.tsx` - 削除フォーム（Client Component）
- `app/employees/_lib/actions.ts` - Server Actions（create/update/delete）

**重要な実装パターン:**
- `useActionState` を使用したフォーム状態管理
- 変数命名: `createState`, `updateState`, `deleteState` (プレフィックス付き)
- `isPending` でローディング状態管理
- hidden inputでID・従業員コードを渡す（disabledフィールドはフォーム送信されないため）

#### バリデーション・重複チェック
- **従業員コード重複チェック:** `EmployeeCdDuplicationCheckDomainService`
- **メールアドレス重複チェック:** `MailAddressDuplicationCheckDomainService`（`shared/domain/services/`に配置）
- 新規登録時: 両方チェック
- 更新時: メールアドレス変更時のみチェック（自分自身との重複はスキップ）

#### ディレクトリ構成の変更
- `app/employee/` → `app/employees/` (RESTful: 複数形)
- Server Actionsを `_lib/actions.ts` に統合（Feature-based構成）
- バックエンドは `subdomains/employee/` のまま（DDD: 単数形）

---

## 既知の問題（Issue登録済み）

### Issue #7: フォーム送信エラー時に入力値が失われる
- **問題:** バリデーションエラー発生時、ユーザー入力値がリセットされる
- **解決策（予定）:** Zod導入時に `ActionResult` に `formData` を含めて返す

### Issue #8: 複数のバリデーションエラーを同時に表示したい
- **問題:** 複数エラーがあっても最初の1つしか表示されない
- **解決策（予定）:** Zod導入時にエラー配列を収集して一括表示

### Issue #9: バックエンドにプレゼンテーション層とDIコンテナを導入する
- **問題:** Server Actionsがインフラ層に直接依存、DI処理が散在
- **実装タイミング:** Auth.js導入後
- **要検討:** ディレクトリ構成（レイヤーごと vs ドメインごと）

---

## 次のセッションで実施する作業

### 実装順序

```
[準備フェーズ] (推定: 1-2時間)
├─ 環境変数の整理 (.env.local, AUTH_SECRET)
├─ ActionResult型の共通化
└─ エラーハンドリングの共通化

[Zodフェーズ] (推定: 2-3時間)
├─ Zod導入
├─ employee CRUDフォームのバリデーション強化
└─ Issue #7, #8の解決

[Auth.jsフェーズ] (推定: 4-5時間)
├─ Prismaシードの整備（テストアカウント）
├─ Auth.js設定
├─ ミドルウェア実装
└─ セッション管理

[ログイン画面フェーズ] (推定: 2-3時間)
├─ ログイン画面実装
├─ ログアウト機能
└─ CLAUDE.md更新
```

---

## 準備フェーズの詳細

### 1. 環境変数の整理

**作業内容:**

```bash
# AUTH_SECRETの生成
openssl rand -base64 32
```

**ファイル作成:**

```bash
# web/.env.local (新規作成、Gitにコミットしない)
DATABASE_URL="postgresql://user:password@localhost:5432/estimate_management_dev"
AUTH_SECRET="生成したランダム文字列"
NEXTAUTH_URL="http://localhost:3000"
```

```bash
# web/.env.example (新規作成、Gitにコミットする)
DATABASE_URL="postgresql://user:password@localhost:5432/estimate_management_dev"
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

**確認:**
- `.gitignore` に `.env.local` が含まれていること

---

### 2. ActionResult型の共通化

**目的:** Zod導入時に複数エラー・フォームデータ保持に対応

**ファイル作成:**

```typescript
// web/src/shared/types/ActionResult.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error?: string; // 単一エラーメッセージ
      errors?: Record<string, string[]>; // フィールドごとのエラー配列
      formData?: Record<string, string>; // フォーム値の保持
    };
```

**変更ファイル:**
- `app/employees/_lib/actions.ts`
- `app/employees/new/EmployeeCreateForm.tsx`
- `app/employees/[employeeCd]/EmployeeUpdateForm.tsx`
- `app/employees/[employeeCd]/EmployeeDeleteForm.tsx`

**変更内容:**
```typescript
// Before
type ActionResult = { success: true } | { success: false; error: string };

// After
import type { ActionResult } from "@/shared/types/ActionResult";
```

---

### 3. エラーハンドリングの共通化

**目的:** 各Server Actionでのエラーハンドリング重複を削減

**ファイル作成:**

```typescript
// web/src/app/employees/_lib/error-handler.ts
import {
  NotFoundEntityError,
  NotFoundError,
} from "@/shared/errors/ApplicationError";
import {
  BusinessRuleViolationError,
  ValidationError,
} from "@/shared/errors/DomainError";
import type { ActionResult } from "@/shared/types/ActionResult";

export function handleCommandError(error: unknown): ActionResult {
  console.error("Command failed:", error);

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: `入力内容に誤りがあります: ${error.message}`,
    };
  }

  if (error instanceof BusinessRuleViolationError) {
    return { success: false, error: error.message };
  }

  if (error instanceof NotFoundEntityError || error instanceof NotFoundError) {
    return { success: false, error: "指定されたリソースが見つかりません" };
  }

  return {
    success: false,
    error: "処理に失敗しました。しばらくしてから再度お試しください。",
  };
}
```

**使用例:**

```typescript
// app/employees/_lib/actions.ts
import { handleCommandError } from "./error-handler";

export async function createEmployee(...) {
  try {
    // ...
  } catch (error) {
    return handleCommandError(error);
  }
}
```

---

## Zodフェーズの詳細

### 1. Zod導入

**インストール:**
```bash
cd web
npm install zod
```

**スキーマファイル作成:**

```typescript
// web/src/app/employees/_lib/schemas.ts
import { z } from "zod";

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  employeeCd: z
    .string()
    .regex(/^EMP[0-9]{6}$/, "従業員コードの形式が正しくありません（例: EMP000001）"),
  password: z.string().min(8, "パスワードは8文字以上である必要があります"),
  role: z.enum(["ADMIN", "USER"], {
    errorMap: () => ({ message: "権限は ADMIN または USER である必要があります" }),
  }),
});

export const updateEmployeeSchema = z.object({
  id: z.string(),
  employeeCd: z.string(), // hidden inputから取得
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  role: z.enum(["ADMIN", "USER"], {
    errorMap: () => ({ message: "権限は ADMIN または USER である必要があります" }),
  }),
});

export const deleteEmployeeSchema = z.object({
  id: z.string(),
});
```

---

### 2. Server Actionsでのバリデーション

**変更例（createEmployee）:**

```typescript
// app/employees/_lib/actions.ts
import { createEmployeeSchema, updateEmployeeSchema, deleteEmployeeSchema } from "./schemas";

export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // Zodバリデーション
  const validatedFields = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    employeeCd: formData.get("employeeCd"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      formData: Object.fromEntries(formData.entries()) as Record<string, string>,
    };
  }

  try {
    const repository = new PrismaEmployeeRepository();
    const employeeCdDuplicationCheck = new EmployeeCdDuplicationCheckDomainService(repository);
    const mailAddressDuplicationCheck = new MailAddressDuplicationCheckDomainService(repository);

    const command = new CreateEmployeeCommand(
      repository,
      employeeCdDuplicationCheck,
      mailAddressDuplicationCheck
    );

    const passwordHash = await hash(validatedFields.data.password, 10);

    await command.execute({
      name: validatedFields.data.name,
      email: validatedFields.data.email,
      employeeCd: validatedFields.data.employeeCd,
      passwordHash,
      role: validatedFields.data.role,
    });

    revalidatePath("/employees");
  } catch (error) {
    return handleCommandError(error);
  }

  redirect("/employees");
}
```

---

### 3. フォームでのエラー表示とフォーム値保持

**変更例（EmployeeCreateForm）:**

```typescript
// app/employees/new/EmployeeCreateForm.tsx
"use client";

import { createEmployee } from "../_lib/actions";
import { useActionState } from "react";

export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      {/* エラーメッセージ表示 */}
      {!createState.success && createState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">エラー</p>
          <p>{createState.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
            名前
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            disabled={isPending}
            defaultValue={createState.success ? "" : createState.formData?.name}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="山田太郎"
          />
          {/* フィールドごとのエラー表示 */}
          {!createState.success && createState.errors?.name && (
            <p className="text-red-500 text-xs mt-1">{createState.errors.name[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
            メールアドレス
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            disabled={isPending}
            defaultValue={createState.success ? "" : createState.formData?.email}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
            placeholder="yamada@example.com"
          />
          {!createState.success && createState.errors?.email && (
            <p className="text-red-500 text-xs mt-1">{createState.errors.email[0]}</p>
          )}
        </div>

        {/* 他のフィールドも同様 */}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isPending ? "登録中..." : "登録"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

**ポイント:**
- `defaultValue={createState.success ? "" : createState.formData?.name}` でフォーム値を保持
- `createState.errors?.name` でフィールドごとのエラーを表示
- Issue #7, #8が解決される

---

## Auth.jsフェーズの詳細

### 1. Prismaシードの整備

**変更ファイル:** `web/prisma/seed.ts`

```typescript
import { PrismaClient } from "@/generated/prisma";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // 管理者アカウント
  const admin = await prisma.employee.upsert({
    where: { employeeCd: "EMP000001" },
    update: {},
    create: {
      id: "cm000000000000000000001",
      employeeCd: "EMP000001",
      name: "管理者",
      email: "admin@example.com",
      passwordHash: await hash("password123", 10),
      role: "ADMIN",
    },
  });
  console.log("Created admin:", admin);

  // テストユーザー
  const user = await prisma.employee.upsert({
    where: { employeeCd: "EMP000002" },
    update: {},
    create: {
      id: "cm000000000000000000002",
      employeeCd: "EMP000002",
      name: "テストユーザー",
      email: "user@example.com",
      passwordHash: await hash("password123", 10),
      role: "USER",
    },
  });
  console.log("Created user:", user);

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**実行:**
```bash
npm run db:seed
```

**テストアカウント:**
- 管理者: `EMP000001` / `password123`
- 一般ユーザー: `EMP000002` / `password123`

---

### 2. Auth.js設定

**インストール:**
```bash
npm install next-auth@beta @auth/prisma-adapter
```

**ファイル作成:**

```typescript
// web/src/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/generated/prisma";
import { compare } from "bcrypt";
import { z } from "zod";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        employeeCd: { label: "従業員コード", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        // Zodでバリデーション
        const parsedCredentials = z
          .object({
            employeeCd: z.string(),
            password: z.string(),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        // 従業員検証
        const employee = await prisma.employee.findUnique({
          where: { employeeCd: parsedCredentials.data.employeeCd },
        });

        if (!employee) return null;

        // パスワード検証
        const passwordMatch = await compare(
          parsedCredentials.data.password,
          employee.passwordHash
        );

        if (!passwordMatch) return null;

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          employeeCd: employee.employeeCd,
          role: employee.role,
        };
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      // セッションにロール情報を追加
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.employeeCd = user.employeeCd;
      }
      return session;
    },
  },
});
```

**型定義拡張:**

```typescript
// web/src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "USER";
      employeeCd: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "USER";
    employeeCd: string;
  }
}
```

---

### 3. ミドルウェア実装

**ファイル作成:**

```typescript
// web/middleware.ts (プロジェクトルート)
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith("/login");

  // 未ログイン → ログイン画面以外にアクセス → リダイレクト
  if (!isLoggedIn && !isOnLoginPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  // ログイン済み → ログイン画面にアクセス → ダッシュボードへ
  if (isLoggedIn && isOnLoginPage) {
    return Response.redirect(new URL("/employees", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### 4. API Routes作成

**ファイル作成:**

```typescript
// web/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

---

## ログイン画面フェーズの詳細

### 1. ログイン画面実装

**ファイル作成:**

```typescript
// web/src/app/login/page.tsx
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8">見積管理システム</h1>
        <LoginForm />
      </div>
    </div>
  );
}
```

```typescript
// web/src/app/login/LoginForm.tsx
"use client";

import { useActionState } from "react";
import { authenticate } from "./_lib/actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, {
    success: true,
  });

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
      <h2 className="text-xl font-semibold mb-4">ログイン</h2>

      {!state.success && state.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="employeeCd" className="block text-gray-700 text-sm font-bold mb-2">
            従業員コード
          </label>
          <input
            type="text"
            id="employeeCd"
            name="employeeCd"
            required
            disabled={isPending}
            placeholder="EMP000001"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
            パスワード
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            disabled={isPending}
            placeholder="パスワード"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isPending ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
```

```typescript
// web/src/app/login/_lib/actions.ts
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import type { ActionResult } from "@/shared/types/ActionResult";

export async function authenticate(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    await signIn("credentials", {
      employeeCd: formData.get("employeeCd"),
      password: formData.get("password"),
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "従業員コードまたはパスワードが正しくありません" };
        default:
          return { success: false, error: "ログインに失敗しました" };
      }
    }
    throw error;
  }
}
```

---

### 2. ログアウト機能

**ヘッダーコンポーネント作成:**

```typescript
// web/src/app/_components/Header.tsx
import { auth, signOut } from "@/auth";
import Link from "next/link";

export async function Header() {
  const session = await auth();

  if (!session) return null;

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">見積管理システム</h1>
          <nav className="flex gap-4">
            <Link href="/employees" className="text-blue-600 hover:underline">
              従業員管理
            </Link>
            {/* 将来: 見積管理などのリンク */}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-700">
            {session.user.name} ({session.user.employeeCd})
          </span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

**レイアウトに追加:**

```typescript
// web/src/app/layout.tsx
import { Header } from "./_components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

---

### 3. CLAUDE.md更新

**追加内容:**

```markdown
## Authentication

Uses **Auth.js (NextAuth v5+)** with:
- Credentials provider (employeeCd + password)
- Database sessions (stored in PostgreSQL via Prisma Adapter)
- Password hashing with bcrypt
- Account locking after failed attempts (future)

### Login Credentials (Development)
- Admin: `EMP000001` / `password123`
- User: `EMP000002` / `password123`

### Protected Routes
All routes except `/login` require authentication (enforced by middleware.ts)

## Validation

Uses **Zod** for:
- Form validation in Server Actions
- Type-safe schema definitions
- Runtime type checking
- Multiple error display support

### Example Schema

\`\`\`typescript
import { z } from "zod";

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  employeeCd: z.string().regex(/^EMP[0-9]{6}$/, "従業員コードの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上である必要があります"),
  role: z.enum(["ADMIN", "USER"]),
});
\`\`\`

### Server Action Pattern

\`\`\`typescript
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 1. Zod validation
  const validatedFields = createEmployeeSchema.safeParse({...});

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      formData: Object.fromEntries(formData.entries()),
    };
  }

  // 2. Business logic
  try {
    await command.execute(validatedFields.data);
  } catch (error) {
    return handleCommandError(error);
  }

  // 3. Revalidate and redirect
  revalidatePath("/employees");
  redirect("/employees");
}
\`\`\`

## Form Pattern with useActionState

\`\`\`typescript
const [state, formAction, isPending] = useActionState(serverAction, { success: true });

// Form value preservation
<input defaultValue={state.success ? "" : state.formData?.fieldName} />

// Field-level error display
{!state.success && state.errors?.fieldName && (
  <p className="text-red-500 text-xs">{state.errors.fieldName[0]}</p>
)}
\`\`\`
```

---

## チェックリスト

### 準備フェーズ
- [ ] `.env.local` 作成（AUTH_SECRET生成）
- [ ] `.env.example` 作成
- [ ] `shared/types/ActionResult.ts` 作成
- [ ] `app/employees/_lib/error-handler.ts` 作成
- [ ] Server Actionsでの型・エラーハンドラ適用

### Zodフェーズ
- [ ] `npm install zod`
- [ ] `app/employees/_lib/schemas.ts` 作成
- [ ] Server Actionsにバリデーション追加（create/update/delete）
- [ ] フォームコンポーネントの修正（フォーム値保持・フィールドエラー表示）
- [ ] Issue #7, #8のクローズ

### Auth.jsフェーズ
- [ ] `prisma/seed.ts` にテストアカウント追加
- [ ] `npm run db:seed` 実行
- [ ] `npm install next-auth@beta @auth/prisma-adapter`
- [ ] `src/auth.ts` 作成
- [ ] `src/types/next-auth.d.ts` 作成
- [ ] `middleware.ts` 作成
- [ ] `app/api/auth/[...nextauth]/route.ts` 作成

### ログイン画面フェーズ
- [ ] `app/login/page.tsx` 作成
- [ ] `app/login/LoginForm.tsx` 作成
- [ ] `app/login/_lib/actions.ts` 作成
- [ ] `app/_components/Header.tsx` 作成
- [ ] `app/layout.tsx` にHeader追加
- [ ] ログイン・ログアウト動作確認
- [ ] `CLAUDE.md` 更新

---

## 重要な注意事項

### Prismaクライアントのインポートパス
```typescript
// ✅ 正しい
import { PrismaClient } from "@/generated/prisma";

// ❌ 間違い
import { PrismaClient } from "@prisma/client";
```

カスタム出力先を使用しているため、必ず `@/generated/prisma` からインポートすること。

### Server Actionsのredirect
`redirect()` は `try-catch` の外で呼ぶこと（エラーとして扱われるため）。

### hidden inputの重要性
`disabled` フィールドはフォーム送信時にデータが送られないため、変更不可フィールドは hidden input で送る。

---

## 参考資料

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Zod Documentation](https://zod.dev/)
- [Auth.js Documentation](https://authjs.dev/)
- [Auth.js Next.js Integration](https://authjs.dev/getting-started/installation?framework=next.js)

---

## 現在のgitステータス

```
M web/package-lock.json
M web/package.json
?? learning/bff-architecture-with-nextjs.md
?? learning/directory-structure-comparison.md
?? learning/pragmatic-approach-first-implementation.md
```

**注意:** ディレクトリ構成は既にRESTful準拠（`app/employees/`）に変更済み。

---

## 次のセッションで最初にやること

1. 準備フェーズから順に実装開始
2. 各フェーズ完了後に動作確認
3. 適宜gitコミット（準備フェーズ完了時、Zodフェーズ完了時、など）

**開発サーバー起動:**
```bash
cd web
npm run dev
# http://localhost:3000
```

**データベースリセット（必要時）:**
```bash
npm run db:push
npm run db:seed
```
