# DDDの観点から認証・認可の配置

## 概要

DDDのレイヤードアーキテクチャにおいて、認証・認可処理をどの層に配置すべきかを整理した。認可の性質によって適切な配置場所が異なることを学んだ。

## 背景

DALパターンでPresentation層に認証・認可チェックを実装する方法を検討中、以下の疑問が生じた：

> 認証・認可チェックはPresentation層（Server Action）で実装する方法だが、性質によってApplication層やドメインサービスで実行したほうが良い場合はあるか？

---

## 結論

| 種類 | 配置場所 | 理由 |
|-----|---------|-----|
| **認証**（誰か？） | Presentation層 | HTTPセッション/Cookieに依存 |
| **認可**（権限あるか？） | 性質による | 下記参照 |

---

## 認可の種類と適切な配置

### 1. ロールベース認可（RBAC） → Presentation層

「管理者のみ」「ログインユーザーのみ」のような単純なロールチェック。

```typescript
// ✅ Presentation層（Server Action）で実行
export async function createEmployee(...) {
  await verifyAdmin(); // ← ここで良い
  // ...
}
```

**理由:**
- セッション情報のみで判断可能
- ビジネスロジックではなくアクセス制御
- ドメイン層を汚染しない

---

### 2. リソース所有権チェック → Presentation層 または Application層

「自分のデータのみ編集可能」のようなチェック。

#### シンプルな場合: Presentation層

```typescript
// ✅ Presentation層でOK
export async function updateEmployee(...) {
  await verifyOwnerOrAdmin(employeeId);
  // ...
}
```

#### 他のビジネスルールと関連する場合: Application層

```typescript
// ✅ Application層
class UpdateEmployeeCommand {
  async execute(input: UpdateEmployeeInput, actorId: string, actorRole: Role) {
    // 認可チェック
    if (actorRole !== "ADMIN" && actorId !== input.id) {
      throw new AuthorizationError("自分のデータのみ編集可能です");
    }

    // ビジネスロジック
  }
}
```

---

### 3. ビジネスルールに基づく認可 → Application層 または Domain層

ビジネスロジックと密接に関連する認可ルール。

**例: 「承認済みの見積もりは作成者でも編集不可」**

```typescript
// ✅ Application層で実行
class UpdateEstimateCommand {
  async execute(input: UpdateEstimateInput, actor: Actor) {
    const estimate = await this.repository.findById(input.id);

    // ビジネスルールに基づく認可
    if (estimate.status === "APPROVED") {
      throw new BusinessRuleViolationError(
        "承認済みの見積もりは編集できません"
      );
    }

    // 所有権チェック（ビジネスルール）
    if (!estimate.canBeEditedBy(actor)) {
      throw new AuthorizationError("編集権限がありません");
    }

    // 更新処理
  }
}
```

```typescript
// ✅ ドメインエンティティにロジックを持たせる
class Estimate {
  canBeEditedBy(actor: Actor): boolean {
    // 承認済みは誰も編集不可
    if (this.status === "APPROVED") {
      return false;
    }

    // 管理者は編集可能
    if (actor.role === "ADMIN") {
      return true;
    }

    // 作成者のみ編集可能
    return this.createdBy === actor.id;
  }
}
```

---

### 4. ドメイン不変条件としての認可 → Domain層

ビジネスルールそのものである場合。

**例: 「上司の承認なしに100万円以上の見積もりは作成不可」**

```typescript
// ✅ Domain層（ドメインサービス）
class EstimateCreationPolicy {
  canCreate(
    amount: Money,
    creator: Employee,
    approver: Employee | null
  ): boolean {
    // 100万円以上は上司の承認が必要
    if (amount.greaterThan(Money.of(1_000_000))) {
      if (!approver || !approver.isSupervisorOf(creator)) {
        return false;
      }
    }
    return true;
  }
}
```

---

## 配置の判断フローチャート

```
認可ルールの判断
    │
    ├─ セッション/ロールのみで判断可能？
    │   └─ Yes → Presentation層（verifyAdmin等）
    │
    ├─ エンティティの状態に依存？
    │   └─ Yes → Application層 or Domain層
    │
    ├─ 複数エンティティ間の関係に依存？
    │   └─ Yes → Domain Service
    │
    └─ ビジネスルールの中核？
        └─ Yes → Domain Entity/Value Object
```

---

## 実装例: レイヤー間の連携

### Presentation層（Server Action）

認証チェックとシンプルなロールチェックを担当。

```typescript
// src/app/(features)/employees/[employeeCd]/actions.ts
"use server";

export async function updateEmployee(...) {
  const session = await verifySession(); // 認証

  // Application層に委譲（actorを渡す）
  await command.execute(input, {
    id: session.user.id,
    role: session.user.role as Role,
  });
}
```

### Application層（Command）

リソース所有権チェック、ビジネスルールに基づく認可を担当。

```typescript
// src/server/subdomains/employee/application/commands/UpdateEmployeeCommand.ts
class UpdateEmployeeCommand {
  async execute(input: UpdateEmployeeInput, actor: Actor) {
    const employee = await this.repository.findById(input.id);

    // ビジネスルール: 自分のデータか管理者のみ
    if (!employee.canBeUpdatedBy(actor)) {
      throw new AuthorizationError("更新権限がありません");
    }

    // ビジネスルール: ロール変更は管理者のみ
    if (input.role !== employee.role && actor.role !== "ADMIN") {
      throw new AuthorizationError("ロール変更は管理者のみ可能です");
    }

    // 更新処理
  }
}
```

### Domain層（Entity）

ドメイン知識としての認可ロジックを担当。

```typescript
// src/server/subdomains/employee/domain/entities/Employee.ts
class Employee {
  canBeUpdatedBy(actor: Actor): boolean {
    return actor.role === "ADMIN" || actor.id === this.id;
  }

  canBeDeletedBy(actor: Actor): boolean {
    // 自分自身は削除不可
    if (actor.id === this.id) return false;
    // 管理者のみ削除可能
    return actor.role === "ADMIN";
  }
}
```

---

## Actor型の設計

Application層とDomain層で使う「操作者」の型。

```typescript
// src/server/shared/types/Actor.ts
export type Actor = {
  id: string;
  role: Role;
};
```

**ポイント:**
- セッション全体ではなく、必要な情報のみを渡す
- Domain層がセッション（HTTP層の概念）に依存しない
- テストしやすい

---

## 各層の責務まとめ

| 層 | 責務 | 例 |
|---|-----|-----|
| **Presentation** | 認証、HTTPセッション依存の認可 | `verifySession()`, `verifyAdmin()` |
| **Application** | ユースケース固有の認可、複合チェック | `if (!employee.canBeUpdatedBy(actor))` |
| **Domain** | ビジネスルールとしての認可ロジック | `Employee.canBeUpdatedBy()` |

---

## アンチパターン

### 1. Domain層でセッションを参照

```typescript
// ❌ Domain層がHTTP層に依存
class Employee {
  canBeUpdatedBy(session: Session): boolean { // Session はHTTP層の概念
    return session.user.id === this.id;
  }
}
```

```typescript
// ✅ Actor型を使う
class Employee {
  canBeUpdatedBy(actor: Actor): boolean {
    return actor.id === this.id;
  }
}
```

### 2. 認可ロジックの重複

```typescript
// ❌ 同じロジックが複数箇所に
// actions.ts
if (session.user.id !== employeeId && session.user.role !== "ADMIN") { ... }

// UpdateEmployeeCommand.ts
if (actor.id !== input.id && actor.role !== "ADMIN") { ... }
```

```typescript
// ✅ Domain層に集約
// Employee.ts
canBeUpdatedBy(actor: Actor): boolean {
  return actor.role === "ADMIN" || actor.id === this.id;
}

// 各層から呼び出す
if (!employee.canBeUpdatedBy(actor)) { ... }
```

### 3. 全ての認可をPresentation層で処理

```typescript
// ❌ ビジネスルールがPresentation層に漏れている
export async function updateEstimate(...) {
  await verifySession();

  // これはビジネスルール、Presentation層に書くべきではない
  const estimate = await repository.findById(id);
  if (estimate.status === "APPROVED") {
    return { error: "承認済みは編集できません" };
  }
  if (estimate.createdBy !== session.user.id) {
    return { error: "編集権限がありません" };
  }
}
```

```typescript
// ✅ Application層に委譲
export async function updateEstimate(...) {
  const session = await verifySession();
  await command.execute(input, { id: session.user.id, role: session.user.role });
}
```

---

## 参考

- 関連学習資料:
  - `learning/server-action-auth-patterns.md`
  - `learning/resource-based-authorization.md`
  - `learning/auth-onion-architecture.md`
- 日付: 2025-12-12
