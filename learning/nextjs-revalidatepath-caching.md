# Next.js: revalidatePath() とキャッシング戦略

## 概要

Next.js App Routerでは、Server Componentが積極的にキャッシュされる。データ変更後に画面に最新データを反映させるため、`revalidatePath()`を使ってキャッシュを無効化する必要がある。

## revalidatePath() とは

**Next.jsのキャッシュを無効化して、指定したパスを再レンダリングさせる関数**

```typescript
import { revalidatePath } from "next/cache";

revalidatePath("/employee");
```

**意味:**
- `/employee`ページのキャッシュを削除
- 次回アクセス時に最新データで再生成される

---

## なぜ必要なのか

### Next.jsのキャッシング動作

Next.js（App Router）は、**Server Componentを積極的にキャッシュ**する：

```tsx
// /employee ページ
export default async function EmployeePage() {
  const employees = await getAllQuery.execute({});  // ← この結果がキャッシュされる
  return (
    <div>
      {employees.map(employee => (
        <div key={employee.id}>{employee.name}</div>
      ))}
    </div>
  );
}
```

**問題点:**
- データベースのデータを変更しても、ページはキャッシュされた古いデータを表示し続ける
- ユーザーがブラウザをリロード（F5）しない限り、新しいデータが表示されない

---

## 実例：従業員削除のケース

### ❌ revalidatePathなし（問題のあるコード）

```typescript
"use server";
import { redirect } from "next/navigation";

export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

    await command.execute({ id });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  redirect("/employee");  // リダイレクトするが...
}
```

**動作:**
1. ユーザーが「削除」ボタンをクリック
2. データベースから従業員が削除される
3. `/employee`にリダイレクト
4. **古いキャッシュが表示される**（削除した従業員がまだ一覧に表示される）
5. ブラウザをリロード（F5）すると、ようやく消える

**ユーザー体験:** 削除したのに消えない → バグだと思われる ❌

---

### ✅ revalidatePathあり（正しいコード）

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

    await command.execute({ id });

    revalidatePath("/employee");  // ← キャッシュ無効化
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  redirect("/employee");
}
```

**動作:**
1. ユーザーが「削除」ボタンをクリック
2. データベースから従業員が削除される
3. `/employee`のキャッシュを削除
4. `/employee`にリダイレクト
5. **最新データで再生成**される（削除した従業員が即座に消える）

**ユーザー体験:** 削除したら即座に消える → 期待通りの動作 ✅

---

## revalidatePathの使い方パターン

### 1. 特定のページを無効化

```typescript
// /employee ページだけ
revalidatePath("/employee");
```

最も基本的な使い方。指定したパスのキャッシュを削除する。

---

### 2. 動的ルートを無効化

```typescript
// /employee/[employeeCd] の全ページ
revalidatePath("/employee/[employeeCd]", "page");
```

**使用例:**
```typescript
export async function updateEmployee(id: string, employeeCd: string, data: FormData) {
  await command.execute({ id, ...data });

  // この従業員の詳細ページのキャッシュを無効化
  revalidatePath(`/employee/${employeeCd}`, "page");

  redirect(`/employee/${employeeCd}`);
}
```

---

### 3. レイアウト配下の全ページを無効化

```typescript
// /employee 配下の全ページ（一覧、詳細、編集など全て）
revalidatePath("/employee", "layout");
```

**使用例:**
```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });

  // /employee配下の全ページのキャッシュを無効化
  revalidatePath("/employee", "layout");

  redirect("/employee");
}
```

**注意:** 広範囲を無効化するため、使いすぎるとパフォーマンスに影響する。

---

### 4. タグベースの無効化（Next.js 14+）

```typescript
// fetch時にタグを付与
const employees = await fetch("https://api.example.com/employees", {
  next: { tags: ["employees"] }
});

// タグで無効化
import { revalidateTag } from "next/cache";
revalidateTag("employees");
```

**使用例:**
```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });

  // "employees"タグを持つ全てのキャッシュを無効化
  revalidateTag("employees");

  redirect("/employee");
}
```

**メリット:** 複数のページで同じデータを使っている場合、タグで一括無効化できる。

---

## 実際の使用例（CRUD操作）

### Create（作成）

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createEmployee(data: FormData) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new CreateEmployeeCommand(repository, ...services);

    await command.execute({
      name: data.get("name") as string,
      email: data.get("email") as string,
      employeeCd: data.get("employeeCd") as string,
      passwordHash: await hash(data.get("password") as string, 10),
      role: data.get("role") as "ADMIN" | "USER",
    });

    // 一覧ページのキャッシュを無効化
    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to create employee:", error);
    throw error;
  }

  // 一覧ページへリダイレクト
  redirect("/employee");
}
```

**ポイント:**
- 新規作成後、一覧ページに新しいデータを表示させる
- `revalidatePath("/employee")`で一覧のキャッシュを無効化

---

### Update（更新）

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateEmployee(id: string, data: FormData) {
  const employeeCd = data.get("employeeCd") as string;

  try {
    const repository = new PrismaEmployeeRepository();
    const command = new UpdateEmployeeCommand(repository);

    await command.execute({
      id,
      name: data.get("name") as string,
      email: data.get("email") as string,
      role: data.get("role") as "ADMIN" | "USER",
    });

    // 一覧ページと詳細ページ両方を無効化
    revalidatePath("/employee");
    revalidatePath(`/employee/${employeeCd}`);
  } catch (error) {
    console.error("Failed to update employee:", error);
    throw error;
  }

  // 詳細ページへリダイレクト
  redirect(`/employee/${employeeCd}`);
}
```

**ポイント:**
- 更新後、一覧と詳細の両方のキャッシュを無効化
- 複数のパスを無効化する場合は、複数回`revalidatePath()`を呼ぶ

---

### Delete（削除）

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

    await command.execute({ id });

    // 一覧ページのキャッシュを無効化
    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  // 一覧ページへリダイレクト
  redirect("/employee");
}
```

**ポイント:**
- 削除後、一覧ページから削除したデータを即座に消す
- `revalidatePath("/employee")`で一覧のキャッシュを無効化

---

## revalidatePathの実行タイミング

### ✅ 正しいタイミング（try内）

```typescript
export async function deleteEmployee(id: string) {
  try {
    await command.execute({ id });

    revalidatePath("/employee");  // ← try内で実行
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  redirect("/employee");
}
```

**理由:**
- データ変更が成功した場合のみキャッシュを無効化
- エラーが発生した場合は無効化しない（古いデータが残る）

---

### ❌ 間違ったタイミング（try外）

```typescript
export async function deleteEmployee(id: string) {
  try {
    await command.execute({ id });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  revalidatePath("/employee");  // ← try外で実行（エラー時も実行される）
  redirect("/employee");
}
```

**問題:**
- エラーが発生してもキャッシュが無効化される
- データは削除されていないのに、画面から消えたように見える（実際はリロードすると戻る）

---

## revalidatePath vs revalidateTag

| 項目 | revalidatePath | revalidateTag |
|------|----------------|---------------|
| **無効化の対象** | 特定のパス | 特定のタグ |
| **使いやすさ** | シンプル | タグ管理が必要 |
| **柔軟性** | 低い | 高い |
| **パフォーマンス** | 無駄が少ない | 関連する全てを一括無効化 |

### revalidatePathの例

```typescript
// 特定のページだけ無効化
revalidatePath("/employee");
revalidatePath(`/employee/${employeeCd}`);
```

### revalidateTagの例

```typescript
// fetchにタグを付与
const employees = await fetch("/api/employees", {
  next: { tags: ["employees"] }
});

const employee = await fetch(`/api/employees/${id}`, {
  next: { tags: ["employees", `employee-${id}`] }
});

// タグで無効化
revalidateTag("employees");           // 全従業員データを無効化
revalidateTag(`employee-${id}`);      // 特定従業員のみ無効化
```

**使い分け:**
- **revalidatePath**: シンプルなケース（今のプロジェクト）
- **revalidateTag**: 複雑な依存関係がある場合

---

## よくある間違い

### ❌ 間違い1: revalidatePathを忘れる

```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  redirect("/employee");  // ← revalidatePathがない
}
```

**結果:** 削除したのに画面に残り続ける

---

### ❌ 間違い2: redirectの後にrevalidatePathを書く

```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  redirect("/employee");
  revalidatePath("/employee");  // ← redirectの後なので実行されない
}
```

**結果:** `redirect()`で処理が終了するため、`revalidatePath()`は実行されない

**正しい順序:**
```typescript
1. データ変更処理
2. revalidatePath()  ← キャッシュ無効化
3. redirect()        ← リダイレクト
```

---

### ❌ 間違い3: 間違ったパスを指定

```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });

  revalidatePath("/employees");  // ← 実際のパスは "/employee"（sなし）

  redirect("/employee");
}
```

**結果:** 違うパスのキャッシュを無効化してしまい、意図したページが更新されない

---

## パフォーマンスへの影響

### キャッシュ戦略のバランス

```
                高速                              最新
  ┌──────────────────────────────────────────────────┐
  │                                                  │
キャッシュあり                              キャッシュなし
（古いデータの可能性）                    （常に最新だが遅い）
  │                                                  │
  └──────────────────────────────────────────────────┘
                    ↑
            revalidatePathで
            適切なタイミングで無効化
```

**ベストプラクティス:**
- データ変更（CRUD）時のみ無効化
- 読み取り専用の操作では無効化しない
- 必要最小限のパスだけ無効化

---

### 無効化の範囲を最適化

```typescript
// ✅ Good: 必要なパスだけ無効化
export async function updateEmployee(id: string, employeeCd: string, data: FormData) {
  await command.execute({ id, ...data });

  revalidatePath("/employee");                // 一覧ページ
  revalidatePath(`/employee/${employeeCd}`);  // 詳細ページ

  redirect(`/employee/${employeeCd}`);
}

// ❌ Bad: 広範囲を無効化しすぎ
export async function updateEmployee(id: string, employeeCd: string, data: FormData) {
  await command.execute({ id, ...data });

  revalidatePath("/", "layout");  // サイト全体を無効化（重い）

  redirect(`/employee/${employeeCd}`);
}
```

---

## Server ActionsでのrevalidatePathの位置づけ

### レイヤー別の責務

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (Server Actions)            │
│  - revalidatePath()    ← キャッシュ制御        │
│  - redirect()          ← 画面遷移制御          │
├─────────────────────────────────────────────────┤
│  Application Layer (Commands/Queries)           │
│  - ビジネスロジック実行                         │
├─────────────────────────────────────────────────┤
│  Domain Layer (Entities, Value Objects)         │
│  - ドメインルール                               │
├─────────────────────────────────────────────────┤
│  Infrastructure Layer (Repositories)            │
│  - データ永続化                                 │
└─────────────────────────────────────────────────┘
```

**重要:**
- `revalidatePath()`はPresentation層（Server Actions）で使う
- Domain/Application層では使わない（Next.js非依存を保つ）

### DDDアーキテクチャでの正しい実装

```typescript
// ✅ Good: Server Action（Presentation層）で使う
"use server";
import { revalidatePath } from "next/cache";

export async function deleteEmployee(id: string) {
  // Application/Domain層を呼ぶ（Pure DDD）
  const repository = new PrismaEmployeeRepository();
  const command = new DeleteEmployeeCommand(repository);
  await command.execute({ id });

  // Presentation層の責務（Next.js固有）
  revalidatePath("/employee");
  redirect("/employee");
}
```

```typescript
// ❌ Bad: Command内で使う（Domain/Application層にNext.js依存）
export class DeleteEmployeeCommand {
  async execute(input: { id: string }) {
    // ...削除処理

    revalidatePath("/employee");  // ← NG: Domain層にNext.js依存を持ち込む
  }
}
```

---

## まとめ

### revalidatePathの基本

- **目的:** Next.jsのキャッシュを無効化して最新データを表示
- **使う場所:** Server Actions内（Presentation層）
- **タイミング:** データ変更後、redirectの前

### 基本パターン

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function someDataMutation() {
  try {
    // 1. データ変更処理
    await command.execute(...);

    // 2. キャッシュ無効化
    revalidatePath("/some-path");
  } catch (error) {
    throw error;
  }

  // 3. リダイレクト
  redirect("/some-path");
}
```

### チェックリスト

データ変更のServer Actionを書く時は、以下を確認：

- [ ] `revalidatePath()`を呼んでいるか？
- [ ] `try`ブロック内で呼んでいるか？
- [ ] `redirect()`の前に呼んでいるか？
- [ ] 正しいパスを指定しているか？
- [ ] 必要最小限のパスだけ無効化しているか？

---

## 参考

- 実装ファイル:
  - `web/src/app/actions/createEmployee.ts`
  - `web/src/app/actions/updateEmployee.ts`
  - `web/src/app/actions/deleteEmployee.ts`
- 日付: 2025-11-12
- 関連: `nextjs-redirect-vs-link.md`, `bff-architecture-with-nextjs.md`
