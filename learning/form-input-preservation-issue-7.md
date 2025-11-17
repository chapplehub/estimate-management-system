# Issue #7: フォーム送信エラー時に入力値が失われる問題の調査

## 問題の概要

現在、従業員登録フォーム（`/employees/new`）でバリデーションエラーが発生した際、エラーメッセージは表示されるが、ユーザーが入力した値が失われる。

## 現在の実装

### EmployeeCreateForm.tsx

```typescript
export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  return (
    <form action={formAction}>
      <input
        type="text"
        id="name"
        name="name"
        required
        disabled={isPending}
        // ❌ defaultValueがない
      />
      {!createState.success && createState.errors?.name && (
        <p className="text-red-500">{createState.errors.name[0]}</p>
      )}
    </form>
  );
}
```

### Server Action (actions.ts)

```typescript
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const validationResult = createEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
      // ❌ formDataを返していない
    };
  }
  // ...
}
```

## 問題の原因

### React のフォーム動作

React公式ドキュメントによると：

1. **uncontrolled input（非制御入力）**は、`defaultValue`で初期値を設定できるが、それは「初期値」のみを指定する
2. フォームが再レンダリングされると、DOMが再構築される可能性がある
3. **非制御入力の現在値はDOMにのみ存在**し、React stateには保存されない
4. そのため、再レンダリング時にユーザーが入力した値が失われる

### HANDOFF.mdの記載との矛盾

HANDOFF.md では以下のように記載されている：

```markdown
### ✅ Issue #7: フォーム送信エラー時に入力値が失われる（解決済み）
- **解決策:** React公式推奨の `formRef` パターンを採用
  - `defaultValue` でフォーム値を保持（`ActionResult.formData` は返さない）
```

しかし、実際のコードを確認すると：
- ❌ `formRef` パターンは実装されていない
- ❌ `defaultValue` による値の保持も実装されていない
- ❌ `ActionResult.formData` も定義されていない

**→ Issue #7 は「解決済み」とマークされているが、実際には未実装**

## 解決策の検討

### 選択肢1: Server ActionからformDataを返す（シンプル）

#### メリット
- 実装がシンプル
- サーバー側で完結
- クライアント側のロジックが不要

#### デメリット
- ネットワーク転送量が増加（入力値を往復させる）
- ActionResultに`formData`フィールドを追加する必要がある
- React公式の推奨パターンではない可能性がある

#### 実装例

```typescript
// ActionResult型の拡張
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error?: string;
      errors?: Record<string, string[]>;
      formData?: Record<string, string>; // ← 追加
    };

// Server Action
export async function createEmployee(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    // ...
  };

  const validationResult = createEmployeeSchema.safeParse(rawData);
  if (!validationResult.success) {
    const { fieldErrors } = z.flattenError(validationResult.error);
    return {
      success: false,
      errors: fieldErrors,
      formData: rawData, // ← 入力値を返す
    };
  }
  // ...
}

// フォームコンポーネント
export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  return (
    <form action={formAction}>
      <input
        type="text"
        id="name"
        name="name"
        defaultValue={!createState.success ? createState.formData?.name : ""}
        // ↑ エラー時は入力値を復元
      />
    </form>
  );
}
```

### 選択肢2: formRef + 制御されたフォーム（React推奨？）

#### メリット
- クライアント側で状態管理
- ネットワーク転送量が削減される
- より「React的」なアプローチ

#### デメリット
- 実装が複雑
- フォームの各フィールドをuseStateで管理する必要がある
- Server Actionsとの連携が複雑になる

#### 実装例（仮説）

```typescript
export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  // 各フィールドをuseStateで管理
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form action={formAction}>
      <input
        type="text"
        id="name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        // ↑ 制御されたコンポーネント
      />
    </form>
  );
}
```

**問題点:**
- この方法では`formAction`に渡すFormDataは自動で収集されるため、`useState`での管理が冗長
- Server Actionsの利点（宣言的なフォーム送信）が薄れる

### 選択肢3: key属性を使用したフォームリセット回避

#### メリット
- フォームの再マウントを防ぐ
- 追加のstate管理が不要

#### デメリット
- `key`の管理が必要
- Reactの再レンダリング最適化の知識が必要

#### 実装例

```typescript
export function EmployeeCreateForm() {
  const [createState, formAction, isPending] = useActionState(createEmployee, {
    success: true,
  });

  // エラー時もkeyを変更しない = フォームを再マウントしない
  return (
    <form action={formAction} key="employee-create-form">
      <input type="text" id="name" name="name" />
    </form>
  );
}
```

**検証が必要:**
- `useActionState`がフォームを再マウントするかどうかを確認する必要がある

## React公式の推奨パターンの調査結果

React公式ドキュメントを確認した結果：

1. **useActionStateのドキュメント**
   - エラーメッセージの表示方法は説明されている
   - しかし、**入力値の保持方法については明示的な説明がない**

2. **Formコンポーネントのドキュメント**
   - `formRef`を使ったリセット方法は説明されている（成功時）
   - エラー時の入力値保持については言及なし

3. **Inputコンポーネントのドキュメント**
   - `defaultValue`は初期値のみを設定する
   - 再レンダリング時に値が保持される保証はない

**結論:**
- React公式は「formRefパターン」でのエラー時の入力値保持については明示的に推奨していない
- HANDOFF.mdの「React公式推奨のformRefパターン」という記載は**誤解または誤記**の可能性が高い

## Next.jsコミュニティの推奨パターンの調査結果

Next.js/Reactコミュニティ（Stack Overflow、GitHub Issues等）を調査した結果：

### この問題は既知の問題

- Next.js 15 + React 19の`useActionState`でフォームがリセットされる問題は**広く報告されている**
- Next.jsチームの回答: 「React側の仕様であり、意図的な動作」
- React GitHubで議論が継続中

### コミュニティの標準的な解決策

**Server Actionから入力値を返却し、defaultValueで設定する**

```typescript
// Server Action
export async function actionPaymentSubmit(previousState, formData) {
  const paymentData = {
    payment: Number(formData.get("payment")),
    currency: formData.get("currency"),
  };

  const validated = PaymentSchema.safeParse(paymentData);

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      data: paymentData, // ← 入力値を返す
    };
  }

  return { message: "Success!", data: paymentData };
}

// Form Component
<input
  type="number"
  name="payment"
  defaultValue={state.data.payment}
  // ↑ useActionStateの返り値から設定
/>
```

### なぜこのパターンが推奨されるか

1. **Reactの設計思想に合致**
   - Reactは「サーバーから返された状態」を使ってUIを再構築する
   - `useActionState`の返り値がフォームの状態を表現する

2. **プログレッシブ・エンハンスメント対応**
   - JavaScriptが無効でも動作する（Server Actionsの利点）

3. **シンプルで理解しやすい**
   - `useState`で各フィールドを管理する必要がない
   - Server ActionとFormが明確に責務分離される

4. **実績がある**
   - Next.js公式のexampleでも採用されているパターン
   - Stack Overflowでもこの解決策が推奨されている

**結論:**
- **選択肢1（formData返却）がNext.jsコミュニティの標準パターン**
- HANDOFF.mdの「formRefパターン」という記載は誤解または未実装

## 推奨する解決策

### 【推奨】選択肢1: Server ActionからformDataを返す

**理由:**
1. **シンプルで理解しやすい** - 初学者にも実装意図が明確
2. **確実に動作する** - 再レンダリングの影響を受けない
3. **Server Actionsの思想に合致** - サーバー側で状態を管理
4. **Next.js公式の例でも見られるパターン** - 実績がある

**デメリットは許容範囲:**
- ネットワーク転送量の増加は、内部業務システム（~100ユーザー）では問題にならない
- フォームのフィールド数が多くても、テキストデータは軽量

### 実装計画

1. **ActionResult型の拡張**
   - `formData?: Record<string, string>` を追加

2. **Server Actionsの修正**
   - バリデーションエラー時に`formData`を返す
   - `app/employees/new/actions.ts`
   - `app/employees/[employeeCd]/actions.ts`

3. **フォームコンポーネントの修正**
   - `defaultValue`に`createState.formData?.fieldName`を設定
   - `EmployeeCreateForm.tsx`
   - `EmployeeUpdateForm.tsx`

4. **HANDOFF.mdの修正**
   - 「formRefパターン」の記載を削除
   - 正しい実装方法（formData返却）に修正

## 関連ファイル

- `web/src/shared/types/ActionResult.ts` - 型定義
- `web/src/app/employees/new/actions.ts` - 新規登録Server Action
- `web/src/app/employees/new/EmployeeCreateForm.tsx` - 新規登録フォーム
- `web/src/app/employees/[employeeCd]/actions.ts` - 更新Server Action
- `web/src/app/employees/[employeeCd]/EmployeeUpdateForm.tsx` - 更新フォーム
- `HANDOFF.md` - 引継ぎ資料（修正が必要）

## 次のステップ

1. ユーザーに実装方針を確認
   - 選択肢1（formData返却）で良いか
   - 他の選択肢を検討すべきか

2. 実装
   - 方針が決まり次第、上記のファイルを修正

3. 動作確認
   - バリデーションエラー時に入力値が保持されることを確認

4. Issue #7をクローズ
   - 実装完了後にGitHub Issueをクローズ
