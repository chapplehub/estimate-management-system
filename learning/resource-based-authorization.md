# リソースベースの認可（Resource-Based Authorization）

## 概要

「自分のデータのみ編集可能」「自分の見積もりのみ削除可能」のような、リソースの所有権に基づく認可パターンについて学んだ。単純なロールベース認可（RBAC）との違いと実装方法を記録する。

## 背景

認証・認可処理のDALパターンを検討中に以下の疑問が生じた：

> `verifyAdmin()` や `verifySession()` は理解できるが、「ユーザは自分のデータしか更新できない」というルールもDALに含められるか？

---

## 認可の種類

### ロールベース認可（RBAC）

ユーザーのロール（役割）に基づく認可。

```typescript
// 「管理者のみ」
if (session.user.role !== "ADMIN") {
  unauthorized();
}
```

**特徴:**
- セッション情報のみで判断可能
- リソースの状態に依存しない
- Presentation層で実装可能

---

### リソースベース認可（ABAC/PBAC）

リソースの属性や所有権に基づく認可。

```typescript
// 「本人のデータのみ」
if (session.user.id !== resource.ownerId) {
  unauthorized();
}
```

**特徴:**
- リソースの情報が必要
- 場合によってはDBアクセスが必要
- Presentation層またはApplication層で実装

---

## 実装パターン

### パターン1: シンプルなヘルパー関数（推奨）

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
 * 管理者権限を検証
 */
export async function verifyAdmin(): Promise<Session> {
  const session = await verifySession();

  if (session.user.role !== "ADMIN") {
    unauthorized();
  }

  return session;
}

/**
 * リソース所有権を検証（本人または管理者）
 * @param resourceOwnerId リソースの所有者ID
 */
export async function verifyOwnerOrAdmin(
  resourceOwnerId: string
): Promise<Session> {
  const session = await verifySession();

  // 管理者は全てのリソースにアクセス可能
  if (session.user.role === "ADMIN") {
    return session;
  }

  // 本人のリソースのみアクセス可能
  if (session.user.id !== resourceOwnerId) {
    unauthorized();
  }

  return session;
}
```

**使用例:**

```typescript
// actions.ts
"use server";
import { verifyOwnerOrAdmin } from "@server/shared/auth/session";

export async function updateEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id") as string;

  // 本人または管理者のみ実行可能
  await verifyOwnerOrAdmin(id);

  // ビジネスロジック...
}
```

---

### パターン2: ポリシーオブジェクト

認可ルールが複雑になった場合の拡張パターン。

```typescript
// src/server/shared/auth/policies/employeePolicy.ts
import { verifySession, type Session } from "../session";
import { unauthorized } from "next/navigation";

export const employeePolicy = {
  /**
   * 従業員の作成権限
   * - 管理者のみ
   */
  async canCreate(): Promise<Session> {
    const session = await verifySession();
    if (session.user.role !== "ADMIN") {
      unauthorized();
    }
    return session;
  },

  /**
   * 従業員の更新権限
   * - 本人または管理者
   */
  async canUpdate(employeeId: string): Promise<Session> {
    const session = await verifySession();

    const isOwner = session.user.id === employeeId;
    const isAdmin = session.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      unauthorized();
    }

    return session;
  },

  /**
   * 従業員の削除権限
   * - 管理者のみ
   * - 自分自身は削除不可
   */
  async canDelete(employeeId: string): Promise<Session> {
    const session = await verifySession();

    if (session.user.role !== "ADMIN") {
      unauthorized();
    }

    // 自分自身の削除を防止
    if (session.user.id === employeeId) {
      throw new Error("自分自身を削除することはできません");
    }

    return session;
  },

  /**
   * ロール変更権限
   * - 管理者のみ
   * - 自分自身のロールは変更不可
   */
  async canChangeRole(employeeId: string): Promise<Session> {
    const session = await verifySession();

    if (session.user.role !== "ADMIN") {
      unauthorized();
    }

    if (session.user.id === employeeId) {
      throw new Error("自分自身のロールは変更できません");
    }

    return session;
  },
};
```

**使用例:**

```typescript
// actions.ts
"use server";
import { employeePolicy } from "@server/shared/auth/policies/employeePolicy";

export async function updateEmployee(...) {
  const id = formData.get("id") as string;

  // ポリシーチェック
  await employeePolicy.canUpdate(id);

  // ロール変更がある場合は追加チェック
  const newRole = formData.get("role");
  if (currentRole !== newRole) {
    await employeePolicy.canChangeRole(id);
  }

  // ビジネスロジック...
}

export async function deleteEmployee(...) {
  const id = formData.get("id") as string;

  await employeePolicy.canDelete(id);

  // ビジネスロジック...
}
```

---

## パターン選択の指針

| プロジェクト規模 | 認可ルールの複雑さ | 推奨パターン |
|----------------|------------------|------------|
| 小〜中規模 | シンプル | パターン1（ヘルパー関数） |
| 中〜大規模 | 複雑 | パターン2（ポリシーオブジェクト） |

### パターン1が適している場合

- 認可ルールが少ない（5個以下）
- ルールが単純（本人 or 管理者）
- チーム規模が小さい

### パターン2が適している場合

- 認可ルールが多い
- ルールに条件分岐がある
- ドメインごとに異なる認可ルール
- テストしやすさを重視

---

## よくある認可パターン例

### 本人 OR 管理者

```typescript
async function verifyOwnerOrAdmin(resourceOwnerId: string) {
  const session = await verifySession();
  if (session.user.role === "ADMIN") return session;
  if (session.user.id === resourceOwnerId) return session;
  unauthorized();
}
```

### 本人のみ（管理者も不可）

```typescript
async function verifyOwnerOnly(resourceOwnerId: string) {
  const session = await verifySession();
  if (session.user.id !== resourceOwnerId) {
    unauthorized();
  }
  return session;
}
```

### 同じ部署のメンバー

```typescript
async function verifySameDepartment(targetEmployeeId: string) {
  const session = await verifySession();
  const target = await employeeRepository.findById(targetEmployeeId);

  if (session.user.departmentId !== target?.departmentId) {
    unauthorized();
  }
  return session;
}
```

### 上司のみ

```typescript
async function verifySupervisor(subordinateId: string) {
  const session = await verifySession();
  const subordinate = await employeeRepository.findById(subordinateId);

  if (subordinate?.supervisorId !== session.user.id) {
    unauthorized();
  }
  return session;
}
```

---

## 注意点

### 1. DBアクセスのタイミング

リソースベース認可ではDBアクセスが必要になることがある。

```typescript
// 悪い例: 2回DBアクセス
export async function updateEmployee(id: string, data: Data) {
  const employee = await repository.findById(id); // 1回目: 認可チェック用
  await verifyOwnerOrAdmin(employee.ownerId);

  const employeeAgain = await repository.findById(id); // 2回目: 更新用
  // ...
}

// 良い例: 1回で済ませる
export async function updateEmployee(id: string, data: Data) {
  const session = await verifySession();
  const employee = await repository.findById(id);

  if (!employee) throw new NotFoundError();

  // 認可チェック
  if (session.user.role !== "ADMIN" && session.user.id !== employee.ownerId) {
    unauthorized();
  }

  // 更新処理
}
```

### 2. 認可とビジネスルールの区別

認可: 誰がアクセスできるか
ビジネスルール: どのような状態で操作できるか

```typescript
// 認可: 本人または管理者のみ
await verifyOwnerOrAdmin(employeeId);

// ビジネスルール: 承認済みは編集不可
if (employee.status === "APPROVED") {
  throw new BusinessRuleViolationError("承認済みは編集できません");
}
```

---

## 参考

- 関連学習資料:
  - `learning/server-action-auth-patterns.md`
  - `learning/ddd-auth-layer-placement.md`
- 日付: 2025-12-12
