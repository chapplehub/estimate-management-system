# 作業引継ぎ資料

**作成日:** 2025-11-15
**最終更新:** 2025-11-17
**次のセッションで実施する作業:** Auth.js導入・ログイン画面実装

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
- `app/employees/new/actions.ts` - 新規登録 Server Action
- `app/employees/new/schema.ts` - 新規登録 Zodスキーマ
- `app/employees/[employeeCd]/page.tsx` - 詳細・編集ページ
- `app/employees/[employeeCd]/EmployeeUpdateForm.tsx` - 更新フォーム（Client Component）
- `app/employees/[employeeCd]/EmployeeDeleteForm.tsx` - 削除フォーム（Client Component）
- `app/employees/[employeeCd]/actions.ts` - 更新・削除 Server Actions
- `app/employees/[employeeCd]/schema.ts` - 更新 Zodスキーマ
- `app/employees/_lib/error-handler.ts` - エラーハンドリング共通処理

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
- Server Actionsを**コロケーション配置**（使う場所の近くに配置）
  - `app/employees/new/actions.ts` - 新規登録用
  - `app/employees/[employeeCd]/actions.ts` - 更新・削除用
- バックエンドは `subdomains/employee/` のまま（DDD: 単数形）

#### Zod導入とバリデーション
- **Zodスキーマ:** 各機能ごとに `schema.ts` で定義
  - `app/employees/new/schema.ts` - 新規登録スキーマ
  - `app/employees/[employeeCd]/schema.ts` - 更新スキーマ
- **バリデーション層の責務分担:**
  - Zod: 入力の形式チェック（文字数、フォーマット、型）
  - Domain層: ビジネスルールチェック（社内メールのみ、など）
- **エラー表示:** フィールドごとのエラーメッセージ表示に対応
- **Zod v4対応:** `z.flattenError()` を使用（`flatten()` は非推奨）

---

## 既知の問題（Issue登録済み）

### ✅ Issue #7: フォーム送信エラー時に入力値が失われる（解決済み）
- **問題:** バリデーションエラー発生時、ユーザー入力値がリセットされる
- **解決策:** Next.jsコミュニティの標準パターンを採用
  - Server Actionから入力値を返却（`ActionResult.data`）
  - フォームコンポーネントで `defaultValue` に設定
  - エラー時: `defaultValue={!state.success ? state.data?.fieldName : ""}`
- **実装ファイル:**
  - `shared/types/ActionResult.ts` - `data` フィールドを追加
  - `app/employees/new/actions.ts` - エラー時に `data: rawData` を返却
  - `app/employees/[employeeCd]/actions.ts` - 同上
  - `app/employees/new/EmployeeCreateForm.tsx` - 各フィールドに `defaultValue` 設定
  - `app/employees/[employeeCd]/EmployeeUpdateForm.tsx` - 同上
- **参考:** `learning/form-input-preservation-issue-7.md`

### ✅ Issue #8: 複数のバリデーションエラーを同時に表示したい（解決済み）
- **問題:** 複数エラーがあっても最初の1つしか表示されない
- **解決策:** Zod導入により、`errors: Record<string, string[]>` で複数エラーを返却
  - フィールドごとのエラー配列を表示

### Issue #9: バックエンドにプレゼンテーション層とDIコンテナを導入する
- **問題:** Server Actionsがインフラ層に直接依存、DI処理が散在
- **実装タイミング:** Auth.js導入後
- **要検討:** ディレクトリ構成（レイヤーごと vs ドメインごと）

### Issue #10: Server Actionsのファイル配置（コロケーション vs 集約）
- **現状:** コロケーション配置を採用
- **今後の検討:** 実績を見て方向転換の可能性あり
- **参考:** `learning/server-actions-file-structure.md`

---

## 次のセッションで実施する作業

### 実装順序

```
✅ [準備フェーズ] (完了)
├─ ✅ 環境変数の整理 (.env.local, AUTH_SECRET)
├─ ✅ ActionResult型の共通化
├─ ✅ エラーハンドリングの共通化
└─ ✅ Server Actionsのコロケーション移行

✅ [Zodフェーズ] (完了)
├─ ✅ Zod導入
├─ ✅ employee CRUDフォームのバリデーション強化
├─ ✅ フィールドごとのエラー表示
├─ ✅ Issue #7の解決（Server Actionからデータ返却パターン採用）
└─ ✅ Issue #8の解決（複数エラー表示）

📋 [Auth.jsフェーズ] (次のタスク)
├─ Prismaシードの整備（テストアカウント）
├─ Auth.js設定
├─ ミドルウェア実装
└─ セッション管理

📋 [ログイン画面フェーズ]
├─ ログイン画面実装
├─ ログアウト機能
└─ CLAUDE.md更新
```

---

## ✅ 準備フェーズの詳細（完了済み）

### 1. 環境変数の整理 ✅

**実施内容:**
- `web/.env.local` 作成（Gitにコミットしない）
- `web/.env.example` 作成（Gitにコミットする）
- `.gitignore` で `.env.local` を除外、`.env.example` のみコミット可能に設定

**作成したファイル:**
```bash
# web/.env.local
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/estimate_management_dev?schema=public"
AUTH_SECRET="iDfHPJn0KTe7F4bzUvkRfJZYgAentfv8//Owa44rqls="
NEXTAUTH_URL="http://localhost:3000"

# web/.env.example
DATABASE_URL="postgresql://user:password@localhost:5432/estimate_management_dev?schema=public"
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

---

### 2. ActionResult型の共通化 ✅

**実施内容:**
- `web/src/shared/types/ActionResult.ts` を作成
- 複数エラー対応（`errors` フィールド）
- フォーム入力値保持用（`data` フィールド）

**作成したファイル:**
```typescript
// web/src/shared/types/ActionResult.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error?: string; // 単一エラーメッセージ
      errors?: Record<string, string[]>; // フィールドごとのエラー配列（Zod用）
      data?: Record<string, unknown>; // フォーム入力値の保持用
    };
```

**修正したファイル:**
- `app/employees/new/actions.ts`
- `app/employees/[employeeCd]/actions.ts`
- `app/employees/new/EmployeeCreateForm.tsx`
- `app/employees/[employeeCd]/EmployeeUpdateForm.tsx`
- `app/employees/[employeeCd]/EmployeeDeleteForm.tsx`

---

### 3. エラーハンドリングの共通化 ✅

**実施内容:**
- `web/src/app/employees/_lib/error-handler.ts` を作成
- 75行のコード削減（DRY原則の適用）

**作成したファイル:**
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

## ✅ Zodフェーズの詳細（完了済み）

### 1. Zod導入 ✅

**実施内容:**
- Zodをインストール（既にインストール済みだった）
- コロケーション方式でスキーマファイルを作成

**作成したファイル:**
- `web/src/app/employees/new/schema.ts` - 新規登録スキーマ
- `web/src/app/employees/[employeeCd]/schema.ts` - 更新スキーマ

**実装例:**
```typescript
// web/src/app/employees/new/schema.ts
import { z } from "zod";

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(100),
  email: z.email("有効なメールアドレスを入力してください"),
  employeeCd: z.string().regex(/^EMP\d{6}$/, "EMP + 6桁の数字で入力"),
  password: z.string().min(8, "8文字以上").max(100),
  role: z.enum(["ADMIN", "USER"], { message: "権限を選択してください" }),
});
```

---

### 2. Server Actionsでのバリデーション ✅

**実施内容:**
- `safeParse()` でバリデーション実行
- **Zod v4対応:** `z.flattenError()` を使用（`flatten()` は非推奨）
- エラー時は `errors` フィールドを返却（`formData` は返さない）

**実装例:**
```typescript
// app/employees/new/actions.ts
import { z } from "zod";
import { createEmployeeSchema } from "./schema";

export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = { name: formData.get("name"), /* ... */ };

  // Zodバリデーション
  const validationResult = createEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return { success: false, errors: fieldErrors };
  }

  const { name, email, employeeCd, password, role } = validationResult.data;

  try {
    // ドメイン層の処理
    await command.execute({ name, email, employeeCd, passwordHash, role });
    revalidatePath("/employees");
  } catch (error) {
    return handleCommandError(error);
  }

  redirect("/employees");
}
```

---

### 3. フォームでのエラー表示 ✅

**実施内容:**
- フィールドごとのエラーメッセージ表示
- バリデーションエラー時の入力値保持（`defaultValue`で設定）

**実装例:**
```typescript
// app/employees/new/EmployeeCreateForm.tsx
export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  return (
    <form action={formAction}>
      <input
        type="text"
        name="name"
        defaultValue={
          !createState.success
            ? (createState.data?.name as string) || ""
            : ""
        }
      />
      {!createState.success && createState.errors?.name && (
        <p className="text-red-500 text-xs mt-1">
          {createState.errors.name[0]}
        </p>
      )}
    </form>
  );
}
```

**重要な変更点:**
- ✅ Server Actionから `data` フィールドを返却（入力値保持用）
- ✅ フィールドごとのエラー表示実装
- ✅ `defaultValue` で入力値を復元
- ✅ Issue #7（入力値保持）解決
- ✅ Issue #8（複数エラー表示）解決

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

### ✅ 準備フェーズ（完了）
- [x] `.env.local` 作成（AUTH_SECRET生成）
- [x] `.env.example` 作成
- [x] `shared/types/ActionResult.ts` 作成
- [x] `app/employees/_lib/error-handler.ts` 作成
- [x] Server Actionsでの型・エラーハンドラ適用
- [x] Server Actionsのコロケーション移行

### ✅ Zodフェーズ（完了）
- [x] Zod導入（既にインストール済み）
- [x] `app/employees/new/schema.ts` 作成
- [x] `app/employees/[employeeCd]/schema.ts` 作成
- [x] Server Actionsにバリデーション追加（create/update）
- [x] フォームコンポーネントの修正（フィールドエラー表示）
- [x] Zod v4対応（`z.flattenError()` 使用）
- [x] Issue #7のクローズ（入力値保持実装完了）
- [x] Issue #8のクローズ（複数エラー表示）

### 📋 Auth.jsフェーズ（次のタスク）
- [ ] `prisma/seed.ts` にテストアカウント追加
- [ ] `npm run db:seed` 実行
- [ ] `npm install next-auth@beta @auth/prisma-adapter`
- [ ] `src/auth.ts` 作成
- [ ] `src/types/next-auth.d.ts` 作成
- [ ] `middleware.ts` 作成
- [ ] `app/api/auth/[...nextauth]/route.ts` 作成

### 📋 ログイン画面フェーズ
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

1. **Auth.jsフェーズから実装開始**
   - Prismaシード整備（テストアカウント追加）
   - Auth.js設定・ミドルウェア実装
2. **ログイン画面フェーズ**
   - ログイン画面・ログアウト機能実装
3. **適宜gitコミット**（各フェーズ完了時）

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

## 完了した作業の振り返り（2025-11-17）

✅ **準備フェーズ**
- 環境変数整理、ActionResult型共通化、エラーハンドリング共通化
- Server Actionsのコロケーション移行

✅ **Zodフェーズ**
- Zodスキーマ定義、バリデーション実装
- Zod v4対応（`z.flattenError()`）
- フィールドごとのエラー表示
- **Issue #7解決**: バリデーションエラー時の入力値保持（`defaultValue`パターン）

📚 **Learning作成**
- `learning/zod-flatten-deprecation.md` - Zod v4移行の記録
- `learning/validation-layer-responsibilities.md` - バリデーション層の責務分担
- `learning/server-actions-file-structure.md` - コロケーション採用の経緯
- `learning/form-input-preservation-issue-7.md` - フォーム入力値保持の実装調査
