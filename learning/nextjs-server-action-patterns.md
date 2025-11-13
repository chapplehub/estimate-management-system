# Next.js Server Action パターン選択ガイド

## 概要

Next.jsのServer Actionを使う際、以下の選択肢がある：

1. `useActionState` + `<form action={...}>`
2. `useTransition` + `<form onSubmit={...}>`
3. `useState` + `<button onClick={...}>`

それぞれの特徴と使い分けを整理し、**このプロジェクトでは一貫性を優先して`useActionState`で統一した**理由を記録する。

## 背景

従業員管理機能のエラーハンドリング実装中に以下の疑問が生じた：

> 削除ボタンは`_prevState`も`_formData`も使わないのに、`useActionState`を使う意味はあるのか？

この疑問から、Server Actionのパターン選択について議論した。

---

## パターン比較

### パターン1: `useActionState` + `action`（Next.js推奨）

```tsx
"use client";

import { useActionState } from "react";
import { updateEmployee } from "@/app/actions/updateEmployee";

export function EmployeeUpdateForm({ employee }) {
  const updateEmployeeWithId = async (
    _prevState: ActionState,
    formData: FormData
  ): Promise<ActionState> => {
    return await updateEmployee(employee.id, formData);
  };

  const [state, formAction, isPending] = useActionState(
    updateEmployeeWithId,
    { success: true }
  );

  return (
    <form action={formAction}>
      {!state.success && <div>{state.error}</div>}
      <input name="name" defaultValue={employee.name} />
      <button type="submit" disabled={isPending}>更新</button>
    </form>
  );
}
```

**メリット:**
- ✅ Next.jsの推奨パターン
- ✅ プログレッシブエンハンスメント（JavaScript無効でも動く）
- ✅ FormDataが自動で渡される
- ✅ `isPending`が自動で取れる
- ✅ フレームワークの最適化が効く

**デメリット:**
- ❌ Server Actionの第1引数に`prevState`を受け取る必要がある
- ❌ 削除ボタンなど入力がない場合、使わないパラメータが発生
- ❌ ラッパー関数が必要

**適している場面:**
- フォーム入力がある（更新、作成）
- 入力値を保持したい
- JavaScript無効でも動かしたい

---

### パターン2: `useTransition` + `onSubmit`

```tsx
"use client";

import { useState, useTransition } from "react";
import { deleteEmployee } from "@/app/actions/deleteEmployee";

export function EmployeeDeleteForm({ employeeId }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await deleteEmployee(employeeId);
      if (!result.success) {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div>{error}</div>}
      <button type="submit" disabled={isPending}>削除</button>
    </form>
  );
}
```

**メリット:**
- ✅ 無駄なパラメータがない
- ✅ エラーハンドリングが明示的
- ✅ カスタムロジックを挟みやすい（確認ダイアログなど）
- ✅ `useTransition`はどこでも使える（コンポーネント分割不要）

**デメリット:**
- ❌ JavaScript無効時に動かない
- ❌ `action`の利点を失う

**適している場面:**
- 入力がない（削除、アーカイブなど）
- 確認ダイアログなどのカスタムロジックを挟む
- エラーハンドリングを細かく制御したい

---

### パターン3: `useState` + `onClick`

```tsx
"use client";

import { useState } from "react";
import { deleteEmployee } from "@/app/actions/deleteEmployee";

export function EmployeeDeleteForm({ employeeId }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setError(null);
    setIsLoading(true);

    const result = await deleteEmployee(employeeId);
    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && <div>{error}</div>}
      <button onClick={handleDelete} disabled={isLoading}>
        {isLoading ? "削除中..." : "削除"}
      </button>
    </div>
  );
}
```

**メリット:**
- ✅ 最もシンプル
- ✅ 直感的（ただのボタン）

**デメリット:**
- ❌ `<form>`のセマンティックを失う
- ❌ アクセシビリティが低下する可能性
- ❌ 自分でローディング状態を管理する必要

**適している場面:**
- 本当にシンプルなボタン
- フォームではない単独のアクション

---

## `useFormStatus` vs `useTransition`

### `useFormStatus`

```tsx
"use client";

import { useFormStatus } from "react-dom";

export function EmployeeDeleteForm({ employeeId }) {
  return (
    <form action={deleteEmployee.bind(null, employeeId)}>
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus(); // ⚠️ formの子コンポーネント内でしか使えない
  return <button type="submit" disabled={pending}>削除</button>;
}
```

**制約:**
- ❌ **formの子コンポーネント内でしか使えない**
- ❌ コンポーネントを分割する必要がある
- ❌ エラーハンドリングが難しい

**使うべき場面:**
- `action`を使っていて、コンポーネント分割が許容できる場合

---

### `useTransition`

```tsx
"use client";

import { useTransition } from "react";

export function EmployeeDeleteForm({ employeeId }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await deleteEmployee(employeeId);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={isPending}>削除</button>
    </form>
  );
}
```

**利点:**
- ✅ どこでも使える
- ✅ コンポーネント分割不要
- ✅ エラーハンドリングが簡単

---

## このプロジェクトでの選択：`useActionState`で統一

### 結論

**削除フォームも更新フォームも、`useActionState` + `action`で統一する。**

### 理由

#### 1. 一貫性を優先

```tsx
// 更新フォーム
const [state, formAction, isPending] = useActionState(updateEmployeeWithId, { success: true });

// 削除フォーム
const [state, formAction, isPending] = useActionState(deleteEmployeeWithId, { success: true });
```

どちらも同じパターンなので、コードが読みやすい。

#### 2. Next.jsの推奨パターンに従う

- `useActionState`はNext.js 14から推奨されているパターン
- 将来的にフレームワークの最適化が効く可能性
- 公式ドキュメントの例に従う方が学習コストが低い

#### 3. 将来的な拡張性

削除ボタンでも将来的に以下のような機能を追加する可能性：
- 確認ダイアログの状態管理
- 複数選択削除
- 削除前のバリデーション

その場合、`prevState`を使う可能性がある。

#### 4. 無駄は許容範囲

`_prevState`、`_formData`を使わないことは確かに無駄だが：
- パフォーマンスへの影響はほぼない
- TypeScriptで型安全
- 一貫性のメリットの方が大きい

---

## 実装例

### 更新フォーム（EmployeeUpdateForm.tsx）

```tsx
"use client";

import { updateEmployee } from "@/app/actions/updateEmployee";
import { useActionState } from "react";

type ActionState =
  | { success: true }
  | { success: false; error: string };

export function EmployeeUpdateForm({ employee }) {
  const updateEmployeeWithId = async (
    _prevState: ActionState,
    formData: FormData
  ): Promise<ActionState> => {
    return await updateEmployee(employee.id, formData);
  };

  const [state, formAction, isPending] = useActionState(
    updateEmployeeWithId,
    { success: true }
  );

  return (
    <div>
      {!state.success && (
        <div className="error">{state.error}</div>
      )}

      <form action={formAction}>
        <input name="name" defaultValue={employee.name} disabled={isPending} />
        <input name="email" defaultValue={employee.email} disabled={isPending} />
        <button type="submit" disabled={isPending}>
          {isPending ? "更新中..." : "更新"}
        </button>
      </form>
    </div>
  );
}
```

### 削除フォーム（EmployeeDeleteForm.tsx）

```tsx
"use client";

import { deleteEmployee } from "@/app/actions/deleteEmployee";
import { useActionState } from "react";

type ActionState =
  | { success: true }
  | { success: false; error: string };

export function EmployeeDeleteForm({ employeeId }) {
  const deleteEmployeeWithId = async (
    _prevState: ActionState,
    _formData: FormData
  ): Promise<ActionState> => {
    return await deleteEmployee(employeeId);
  };

  const [state, formAction, isPending] = useActionState(
    deleteEmployeeWithId,
    { success: true }
  );

  return (
    <div>
      {!state.success && (
        <div className="error">{state.error}</div>
      )}

      <form action={formAction}>
        <button type="submit" disabled={isPending}>
          {isPending ? "削除中..." : "削除"}
        </button>
      </form>
    </div>
  );
}
```

**ポイント:**
- どちらも同じパターン（`useActionState`）
- `_prevState`、`_formData`は使わないが、型安全性のために定義
- エラー表示のUIも統一

---

## 他のプロジェクトでの使い分け

このプロジェクトでは**一貫性**を優先したが、他のプロジェクトでは以下の基準で使い分けることも検討できる：

### 使い分けの基準

| 状況 | 推奨パターン | 理由 |
|------|------------|------|
| **フォーム入力がある** | `useActionState` + `action` | FormDataを扱う、入力保持 |
| **入力がない（削除など）** | `useTransition` + `onSubmit` | シンプル、無駄がない |
| **カスタムロジック多い** | `useTransition` + `onSubmit` | 柔軟性が高い |
| **JavaScript無効対応必要** | `useActionState` + `action` | プログレッシブエンハンスメント |
| **単純なボタン** | `useState` + `onClick` | 最もシンプル |

---

## まとめ

### 学んだこと

1. **`useActionState`の制約**
   - Server Actionの第1引数に`prevState`が必要
   - 削除ボタンなど入力がない場合、使わないパラメータが発生

2. **`useTransition`の利点**
   - どこでも使える
   - エラーハンドリングが簡単
   - カスタムロジックを挟みやすい

3. **`useFormStatus`の制約**
   - formの子コンポーネント内でしか使えない
   - コンポーネント分割が必要

4. **一貫性の重要性**
   - 技術的に「最適」でなくても、一貫性があることで可読性が上がる
   - チームで開発する場合、パターンを統一することが重要

### このプロジェクトの方針

**全てのServer Actionで`useActionState` + `action`を使う**

理由：
- 一貫性を保つ
- Next.jsの推奨パターンに従う
- 将来的な拡張性を考慮
- `_prevState`、`_formData`の「無駄」は許容範囲

---

## 参考

- 実装ファイル:
  - `web/src/app/employee/[employeeCd]/EmployeeUpdateForm.tsx`
  - `web/src/app/employee/[employeeCd]/EmployeeDeleteForm.tsx`
  - `web/src/app/actions/updateEmployee.ts`
  - `web/src/app/actions/deleteEmployee.ts`
- 関連ドキュメント:
  - `learning/nextjs-redirect-vs-link.md`
  - `learning/nextjs-revalidatepath-caching.md`
- 日付: 2025-11-13
- 議論のきっかけ: エラーハンドリング実装中に「削除ボタンで`useActionState`を使う意味はあるか？」という疑問
