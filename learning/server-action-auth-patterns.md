# Server Actionでの認証処理パターン

## 概要

Next.js App RouterのServer Actionで認証・認可処理を実装する際の主要な3つのパターンを比較し、Next.js公式推奨のDALパターンを採用した理由を記録する。

## 背景

Server Actionはクライアントから直接呼び出せるため、各actionで認証チェックが必要。以下の疑問が生じた：

- 各actionに個別でコーディングするべきか？
- 共通処理を継承や高階関数で抽出できるか？
- セッションチェックだけでも共通化できないか？

---

## 3つのパターン

### パターン1: DAL（Data Access Layer）パターン

**Next.js公式推奨**

共通のヘルパー関数を作成し、各Server Actionで呼び出す方式。

```typescript
// src/server/shared/auth/session.ts
import { auth } from "@server/shared/auth/better-auth/auth";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

export async function verifySession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    unauthorized(); // 401を返す
  }

  return session;
}

export async function verifyAdmin() {
  const session = await verifySession();

  if (session.user.role !== "ADMIN") {
    unauthorized();
  }

  return session;
}
```

```typescript
// actions.ts での使用
"use server";
import { verifyAdmin } from "@server/shared/auth/session";

export async function createEmployee(...) {
  const session = await verifyAdmin(); // 認証+認可チェック

  // 以降のビジネスロジック
}
```

**評価: 推奨度 5/5**

| 観点 | 評価 |
|-----|------|
| 標準準拠 | Next.js公式ドキュメントの推奨パターン |
| 実装の簡潔さ | シンプルで理解しやすい |
| 型安全性 | 完全に型推論が動く |
| チェック漏れ防止 | 各actionで呼び出しを忘れる可能性あり |

---

### パターン2: 高階関数（HOF）パターン

認証済みのServer Actionを生成するラッパー関数。

```typescript
// src/server/shared/auth/withAuth.ts
import { auth } from "@server/shared/auth/better-auth/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@shared/types/ActionResult";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export function withAuth<T extends unknown[]>(
  action: (session: NonNullable<Session>, ...args: T) => Promise<ActionResult>
) {
  return async (...args: T): Promise<ActionResult> => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "認証が必要です" };
    }

    return action(session, ...args);
  };
}
```

```typescript
// actions.ts での使用
"use server";
import { withAuth } from "@server/shared/auth/withAuth";

export const createEmployee = withAuth(
  async (session, _prevState: ActionResult, formData: FormData) => {
    // sessionは既に検証済み
  }
);
```

**評価: 推奨度 3/5**

| 観点 | 評価 |
|-----|------|
| 標準準拠 | Next.js公式では特に推奨されていない |
| 実装の簡潔さ | ラッパー定義が必要 |
| 型安全性 | useActionStateとの組み合わせで型推論が複雑 |
| チェック漏れ防止 | 構造的に防げる |

---

### パターン3: Middleware + DAL 併用パターン

ルートレベルでの認証はMiddlewareで、認可はDALで。

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const session = await getSession(request);

  if (!session && request.nextUrl.pathname.startsWith('/employees')) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
}
```

```typescript
// actions.ts - 認可チェックはDALで
"use server";
import { verifyAdmin } from "@server/shared/auth/session";

export async function createEmployee(...) {
  await verifyAdmin(); // 認可チェック
}
```

**評価: 推奨度 4/5**

| 観点 | 評価 |
|-----|------|
| 標準準拠 | Middlewareはmutation保護には不向き（公式警告） |
| 実装の簡潔さ | 2箇所での管理が必要 |
| 型安全性 | 良好 |
| チェック漏れ防止 | ページアクセスは防げるがactionは別途必要 |

---

## 比較表

| パターン | 標準準拠 | 実装の簡潔さ | チェック漏れ防止 | 型安全性 |
|---------|---------|-------------|----------------|---------|
| DAL（推奨） | 5 | 5 | 3 | 5 |
| 高階関数 | 3 | 3 | 5 | 3 |
| Middleware+DAL | 4 | 3 | 4 | 4 |

---

## このプロジェクトでの選択: DALパターン

### 採用理由

1. **Next.js公式推奨**: 公式ドキュメント（authentication.mdx, data-security.mdx）で推奨されているパターン
2. **シンプルで理解しやすい**: 新しいメンバーでもすぐ理解できる
3. **型安全性**: useActionStateとの組み合わせで型推論が正しく動く
4. **柔軟性**: 各actionで必要な認可レベルを明示的に選択できる

### チェック漏れ対策

- コードレビューで確認
- ESLintルールの検討（カスタムルールで未認証actionを検出）
- テストで認証なしのリクエストが拒否されることを確認

---

## 実装例

### セッション検証ヘルパー

```typescript
// src/server/shared/auth/session.ts
import { auth } from "@server/shared/auth/better-auth/auth";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * セッション検証（認証のみ）
 */
export async function verifySession(): Promise<Session> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    unauthorized();
  }

  return session;
}

/**
 * 管理者権限を検証（認証 + 管理者認可）
 */
export async function verifyAdmin(): Promise<Session> {
  const session = await verifySession();

  if (session.user.role !== "ADMIN") {
    unauthorized();
  }

  return session;
}
```

### Server Actionでの使用

```typescript
// src/app/(features)/employees/new/actions.ts
"use server";

import { verifyAdmin } from "@server/shared/auth/session";
import type { ActionResult } from "@shared/types/ActionResult";

export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 認証 + 管理者権限チェック
  await verifyAdmin();

  // Zodバリデーション、ビジネスロジック...
}
```

---

## 参考

- Next.js公式ドキュメント:
  - [Authentication](https://nextjs.org/docs/app/building-your-application/authentication) - verifySession()パターンの解説
  - [Data Security](https://nextjs.org/docs/app/building-your-application/data-fetching/security) - Server Actionでの認証チェック
- better-auth:
  - [Next.js Integration](https://www.better-auth.com/docs/integrations/next) - Server Actionでのセッション取得
- 関連ファイル:
  - `src/server/shared/auth/better-auth/auth.ts`
  - `src/app/(features)/employees/new/actions.ts`
- 関連学習資料:
  - `learning/auth-onion-architecture.md`
  - `learning/nextjs-server-action-patterns.md`
- 日付: 2025-12-12
