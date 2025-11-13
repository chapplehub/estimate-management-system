# Next.js: redirect vs Link の使い分け

## 概要

Next.jsで画面遷移する際の`redirect()`と`<Link>`の使い分けについて、Server Componentでの実装時に理解したことをまとめる。

## 基本的な違い

| 項目 | `<Link>` | `redirect()` |
|------|----------|--------------|
| **用途** | ユーザーがクリックして遷移 | サーバー側で強制的にリダイレクト |
| **トリガー** | ユーザーの操作（クリック） | プログラムによる自動遷移 |
| **実行場所** | クライアント側 | サーバー側 |
| **出力** | `<a>`タグとしてHTML出力 | HTTPリダイレクト（307） |
| **SEO対応** | ✅ あり | ✅ あり |
| **プリフェッチ** | ✅ 自動で効く | ❌ なし |

## 使い分けのルール

### `<Link>` を使う場面

**「ユーザーが能動的にページ移動する」場合**

```tsx
import Link from "next/link";

// ナビゲーションメニュー
<Link href="/employee">従業員一覧</Link>

// 一覧から詳細へのリンク
<Link href={`/employee/${employee.employeeCd}`}>
  {employee.employeeCd}
</Link>

// ボタン風のリンク
<Link
  href="/employee"
  className="bg-blue-500 text-white px-4 py-2 rounded"
>
  一覧へ戻る
</Link>
```

**特徴:**
- クリック可能なリンクとしてレンダリング
- ホバー時にプリフェッチが効いて高速
- SEO対応（検索エンジンがクロール可能）
- ユーザーの意思で遷移

---

### `redirect()` を使う場面

**「処理完了後、自動的にページ移動させる」場合**

```typescript
"use server";
import { redirect } from "next/navigation";

// 削除後、一覧へ強制移動
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  revalidatePath("/employee");
  redirect("/employee");
}

// 更新後、詳細ページへ戻る
export async function updateEmployee(id: string, data: FormData) {
  await command.execute({ id, ...data });
  revalidatePath(`/employee/${employeeCd}`);
  redirect(`/employee/${employeeCd}`);
}

// ログイン成功後、ダッシュボードへ
export async function login(credentials: FormData) {
  const user = await authenticateUser(credentials);
  if (user) {
    redirect("/dashboard");
  }
}

// 未認証ユーザーを強制的にログインページへ
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <Dashboard />;
}
```

**特徴:**
- Server Action内で使用
- HTTPステータス307（Temporary Redirect）
- ユーザーの操作不要で自動遷移
- 処理完了後のフローを制御

---

## 実際の使用例（従業員管理システム）

### 一覧画面（/employee/page.tsx）

```tsx
import Link from "next/link";

export default async function EmployeePage() {
  const employees = await getAllQuery.execute({});

  return (
    <div>
      <h1>従業員一覧</h1>
      <table>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                {/* ✅ Link: ユーザーがクリックして詳細へ */}
                <Link href={`/employee/${employee.employeeCd}`}>
                  {employee.employeeCd}
                </Link>
              </td>
              <td>{employee.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 削除処理（/app/actions/deleteEmployee.ts）

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function deleteEmployee(id: string) {
  try {
    const repository = new PrismaEmployeeRepository();
    const command = new DeleteEmployeeCommand(repository);

    await command.execute({ id });

    // キャッシュ無効化
    revalidatePath("/employee");
  } catch (error) {
    console.error("Failed to delete employee:", error);
    throw error;
  }

  // ✅ redirect: 削除後、自動的に一覧へ戻る
  redirect("/employee");
}
```

### 詳細画面（/employee/[employeeCd]/page.tsx）

```tsx
export default async function EmployeeDetailPage({ params }) {
  const { employeeCd } = await params;
  const employee = await getEmployeeQuery.execute({ employeeCd });

  const updateUserWithId = updateEmployee.bind(null, employee.id);
  const deleteUserWithId = deleteEmployee.bind(null, employee.id);

  return (
    <div>
      {/* 更新フォーム */}
      <form action={updateUserWithId}>
        <input name="name" defaultValue={employee.name} />
        <button type="submit">更新</button>
      </form>

      {/* 削除フォーム */}
      <form action={deleteUserWithId}>
        <button type="submit">削除</button>
      </form>

      {/* ✅ Link: ユーザーがクリックして一覧へ戻る */}
      <Link href="/employee">一覧へ戻る</Link>
    </div>
  );
}
```

---

## よくある間違いと正しい実装

### ❌ 間違い1: Server ComponentでonClickを使おうとする

```tsx
// NG: Server Componentではイベントハンドラが使えない
<button onClick={() => deleteEmployee(employee.id)}>
  削除
</button>
```

**正しくは:**
```tsx
// OK: formのactionでServer Actionを呼ぶ
const deleteUserWithId = deleteEmployee.bind(null, employee.id);

<form action={deleteUserWithId}>
  <button type="submit">削除</button>
</form>
```

### ❌ 間違い2: フォーム送信後にLinkで遷移しようとする

```tsx
// NG: これは動作しない
<form>
  <button type="submit">
    <Link href="/employee">送信</Link>
  </button>
</form>
```

**正しくは:**
```tsx
// OK: Server Action内でredirectを使う
<form action={createEmployee}>
  <button type="submit">送信</button>
</form>

export async function createEmployee(data: FormData) {
  await command.execute(data);
  revalidatePath("/employee");
  redirect("/employee");  // ← 処理完了後にリダイレクト
}
```

### ❌ 間違い3: 単純なリンクにredirectを使おうとする

```tsx
// NG: クリック可能なリンクにredirectは使えない
<button onClick={() => redirect("/employee")}>
  一覧へ戻る
</button>
```

**正しくは:**
```tsx
// OK: Linkを使う
<Link href="/employee">
  <button type="button">一覧へ戻る</button>
</Link>

// または
<Link
  href="/employee"
  className="button-style"
>
  一覧へ戻る
</Link>
```

---

## Server Actionとの組み合わせ

### パターン1: 作成・更新・削除後のリダイレクト

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// 作成後 → 一覧へ
export async function createEmployee(data: FormData) {
  const employee = await command.execute(data);
  revalidatePath("/employee");
  redirect("/employee");
}

// 更新後 → 詳細ページへ戻る
export async function updateEmployee(id: string, data: FormData) {
  await command.execute({ id, ...data });
  revalidatePath(`/employee/${employeeCd}`);
  redirect(`/employee/${employeeCd}`);
}

// 削除後 → 一覧へ
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  revalidatePath("/employee");
  redirect("/employee");
}
```

**ポイント:**
- `revalidatePath()`でキャッシュを無効化
- `redirect()`で遷移先を指定
- この順序が重要

### パターン2: 条件によるリダイレクト

```typescript
"use server";
import { redirect } from "next/navigation";

export async function login(credentials: FormData) {
  const user = await authenticateUser(credentials);

  if (!user) {
    // ログイン失敗 → エラーページへ
    redirect("/login?error=invalid_credentials");
  }

  if (user.role === "ADMIN") {
    // 管理者 → 管理画面へ
    redirect("/admin/dashboard");
  } else {
    // 一般ユーザー → ダッシュボードへ
    redirect("/dashboard");
  }
}
```

---

## revalidatePath() との関係

### `revalidatePath()` とは

Next.jsのキャッシュを無効化して、指定したパスを再レンダリングさせる関数。

```typescript
revalidatePath("/employee");
```

「`/employee`ページのキャッシュを削除して、次回アクセス時に最新データで再生成する」という意味。

### なぜ必要？

Server Componentは積極的にキャッシュされるため、データを変更しても画面に反映されない問題がある。

**❌ revalidatePathなし:**
```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  redirect("/employee");  // リダイレクトするが...
}
```

**結果:**
1. 従業員を削除
2. `/employee`にリダイレクト
3. **古いキャッシュが表示される**（削除した従業員がまだ表示される）
4. ブラウザをリロード（F5）すると消える

**✅ revalidatePathあり:**
```typescript
export async function deleteEmployee(id: string) {
  await command.execute({ id });
  revalidatePath("/employee");  // キャッシュ無効化
  redirect("/employee");
}
```

**結果:**
1. 従業員を削除
2. `/employee`のキャッシュを削除
3. リダイレクト時に**最新データで再生成**される
4. 削除した従業員がすぐに消える

### revalidatePathのパターン

```typescript
// 特定のページ
revalidatePath("/employee");

// 動的ルート（全ての従業員詳細ページ）
revalidatePath("/employee/[employeeCd]", "page");

// レイアウト配下の全ページ
revalidatePath("/employee", "layout");
```

---

## まとめ

### 覚え方

- **`<Link>`** = 「ここをクリックして〇〇へ行く」（ユーザー主導）
- **`redirect()`** = 「処理が終わったから〇〇へ飛ばす」（システム主導）

### 基本フロー

```
ユーザーがクリック
  ↓
<Link> でページ遷移
  ↓
Server Componentがレンダリング
  ↓
フォーム送信（Server Action実行）
  ↓
データ変更処理
  ↓
revalidatePath() でキャッシュ無効化
  ↓
redirect() で別ページへ遷移
```

### DDD設計での注意点

- **Domain/Application層**: Next.js非依存（redirect使わない）
- **Server Action（Presentation層）**: redirect, revalidatePathを使う
- レイヤーの責務を守ることで、テストしやすく保守性の高いコードになる

---

## 参考

- 実装ファイル:
  - `web/src/app/employee/page.tsx`
  - `web/src/app/employee/[employeeCd]/page.tsx`
  - `web/src/app/actions/deleteEmployee.ts`
  - `web/src/app/actions/updateEmployee.ts`
- 日付: 2025-11-12
- 関連: `bff-architecture-with-nextjs.md`, `pragmatic-approach-first-implementation.md`
