# クライアントコンポーネントからServer Actionsを直接呼び出す

作成日: 2026-01-02

## 概要

クライアントコンポーネントからServer Actionsを呼び出す際、カスタムフック（useXxx）を経由する必要はない。Server Actionsは直接呼び出し可能であり、フックを作るかどうかは目的によって判断すべき。

## 詳細

### Server Actionsの呼び出し方法

クライアントコンポーネントからServer Actionsを呼ぶ方法は複数ある：

```tsx
// 1. フォームのaction属性に直接渡す
<form action={serverAction}>

// 2. useActionStateでラップして渡す（状態管理が必要な場合）
const [state, formAction, isPending] = useActionState(serverAction, initialState);
<form action={formAction}>

// 3. イベントハンドラで直接呼び出す（フォーム以外の場合）
const handleClick = async () => {
  const result = await serverAction(data);
};
```

いずれの方法でもカスタムフックは**必須ではない**。

### カスタムフックを作る理由

カスタムフックを作成するのは以下の場合：

1. **副作用処理が必要** - useEffectで成功/失敗後の処理を行う
2. **ロジックの再利用** - 複数コンポーネントで同じ処理を共有
3. **状態の正規化** - エラー形式の変換など
4. **テスタビリティ** - ロジックを分離してテストしやすくする

### 実例：signinフォームの変遷

#### 元の実装（フックあり）

```typescript
// useSignin.ts
export function useSignin() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signinAction, initialState);

  // 成功時のリダイレクト処理のためにuseEffectが必要だった
  useEffect(() => {
    if (state.success) {
      router.push(DEFAULT_CALLBACK_URL);
    }
  }, [state.success, router]);

  return { errors, pending, formAction };
}

// signin-form.tsx
export function SigninForm() {
  const { errors, pending, formAction } = useSignin();
  // ...
}
```

#### 今回の実装（フックなし）

```typescript
// actions.ts
export async function signinAction(prevState: unknown, formData: FormData) {
  // バリデーション...
  // 認証処理...

  // Server Action内で直接リダイレクト
  redirect(DEFAULT_CALLBACK_URL);
}

// signin-form.tsx
export function SigninForm() {
  // 直接useActionStateを使用
  const [lastResult, formAction, isPending] = useActionState(signinAction, undefined);
  // ...
}
```

### フックが不要になった理由

| 元の実装 | 今回の実装 |
|---------|-----------|
| Server Actionは`{ success: true }`を返す | Server Actionは`redirect()`を呼ぶ |
| クライアント側で成功を検知してリダイレクト | サーバー側で直接リダイレクト |
| → useEffectが必要 → フック化 | → useEffect不要 → フック不要 |

### 判断基準

| シナリオ | 推奨アプローチ |
|---------|--------------|
| フォーム送信後にリダイレクト | Server Action内で`redirect()` |
| 成功後にトースト表示 | useEffectが必要 → フック化を検討 |
| 複数画面で同じロジック | フック化して再利用 |
| シンプルなCRUD | 直接呼び出し |

## 参考

- 関連ファイル
  - `src/app/(features)/(auth)/signin/_components/signin-form.tsx` - 直接呼び出しの例
  - `src/app/(features)/employees/[employeeCd]/EmployeeUpdateForm.tsx` - useEffectでトースト表示の例
- Next.js Server Actions ドキュメント: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
