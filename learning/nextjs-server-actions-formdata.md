# Next.js Server Actions と FormData の自動受け渡しの仕組み

## 疑問

`createEmployee` 関数を `EmployeeCreateForm` で使う時、明示的に `formData` を引数として渡していないのに、どうやって Server Action が FormData を受け取っているのか？

## 背景

```typescript
// EmployeeCreateForm.tsx
const [createState, formAction, isPending] = useActionState(createEmployee, {
  success: true,
});

// ...
<form action={formAction}>
  <input name="email" />
  <input name="name" />
  {/* ... */}
</form>;
```

```typescript
// actions.ts
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  // ...
}
```

明示的に `formData` を渡すコードがどこにもない。

## 解決策：useActionState フックの自動バインディング

### 1. `useActionState` の動作

```typescript
const [createState, formAction, isPending] = useActionState(
  createEmployee,
  initialState
);
```

`useActionState` は：

- Server Action (`createEmployee`) を受け取る
- **ラップした関数 (`formAction`) を返す**
- この `formAction` は自動的に `prevState` と `formData` を Server Action に渡す

### 2. フォーム送信時の流れ

```
1. ユーザーがフォーム送信
   ↓
2. ブラウザが FormData オブジェクトを自動生成
   - <input name="email"> → formData.get("email")
   - <input name="name"> → formData.get("name")
   ↓
3. Next.js が formAction を呼び出す
   ↓
4. formAction が createEmployee を呼び出す
   - 第1引数: prevState (前回の ActionResult)
   - 第2引数: FormData (ブラウザが生成)
   ↓
5. createEmployee が実行される
```

### 3. Server Action のシグネチャ規約

Server Action を `useActionState` で使う場合、以下のシグネチャが必須：

```typescript
async function actionName(
  prevState: State, // ← useActionState が自動的に渡す
  formData: FormData // ← form 送信時に自動生成される
): Promise<State>;
```

## 重要なポイント

### ✅ 自動的に行われること

1. **FormData の生成**：ブラウザが `<form>` 内の全 input から自動生成
2. **prevState の受け渡し**：`useActionState` が前回の実行結果を自動的に第 1 引数に渡す
3. **FormData の受け渡し**：`useActionState` が自動的に第 2 引数に渡す

### ❌ 開発者が書かなくていいこと

```typescript
// こういうコードは不要！
const handleSubmit = (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  createEmployee(prevState, formData);
};
```

### 📝 name 属性が key になる

```typescript
<input name="email" /> → formData.get("email")
<input name="name" />  → formData.get("name")
```

## なぜこの設計？

1. **プログレッシブ・エンハンスメント**
   JavaScript なしでもフォームが動作する（標準的な form 送信として機能）

2. **シンプルな API**
   開発者が FormData の組み立てを明示的に書く必要がない

3. **型安全性**
   Server Action の引数型が明確（`prevState` と `formData` は必ず渡される）

4. **React 19 の設計思想**
   フォーム処理を宣言的に書ける（`action` 属性に関数を渡すだけ）

## 参考

- 関連ファイル：
  - `web/src/app/employees/new/EmployeeCreateForm.tsx`
  - `web/src/app/employees/_lib/actions.ts`
- React 19 ドキュメント：`useActionState` hook
- https://ja.react.dev/reference/react-dom/components/form#props
- Next.js ドキュメント：Server Actions and Mutations
- https://nextjs.org/docs/app/guides/forms#how-it-works
