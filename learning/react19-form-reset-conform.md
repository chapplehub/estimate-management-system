# React 19の自動フォームリセット問題とconformでの解決策

作成日: 2026-01-28

## 概要

React 19では、`<form action={serverAction}>` を使用した場合、Server Action完了後にフォームが自動的にリセットされる仕様が導入された。これがconformの状態管理と干渉し、バックエンドエラー時に入力値が失われる問題が発生する。

## 問題の詳細

### 症状

- フロントエンドバリデーションエラー時：入力値が保持される ✅
- バックエンドエラー時（ビジネスロジックエラー等）：入力値がリセットされる ❌

### 原因

React 19の自動リセットが発生する条件：

1. `<form action={serverAction}>` のようにaction属性にServer Actionを渡している
2. フォームのネイティブsubmitイベントが発火する
3. Actionが完了する（成功・失敗問わず）

フロントエンドバリデーションエラー時は、Reactの観点では「Action失敗」として扱われる可能性があり、リセットがトリガーされない。一方、バックエンドエラー時はバリデーション自体は成功しており、catchブロックで`submission.reply()`を返しても「Actionは完了した」と見なされ、自動リセットがトリガーされる。

## 解決策

conformの`onSubmit`で`event.preventDefault()`し、`startTransition`を使って手動でactionを呼び出す。

```tsx
import { startTransition } from "react";

const [lastResult, formAction, isPending] = useActionState(
  createEmployee,
  undefined
);

const [form, fields] = useForm({
  lastResult,
  onSubmit(event, { formData }) {
    event.preventDefault();
    startTransition(async () => {
      await formAction(formData);
    });
  },
  onValidate({ formData }) {
    return parseWithZod(formData, { schema: createEmployeeSchema });
  },
  shouldValidate: "onBlur",
  shouldRevalidate: "onInput",
});
```

### なぜこれで解決するのか

#### `event.preventDefault()` の役割

ブラウザのネイティブフォーム送信をキャンセルする。React 19の自動リセットは、`<form action={...}>` を通じたネイティブのフォーム送信フローに組み込まれているため、`preventDefault()`でこのフローを止めると自動リセット機構も発動しない。

#### `startTransition` の役割

1. **非同期処理の適切なスケジューリング**: Server Actionは非同期処理であり、`startTransition`はReactに「この更新は緊急ではない」と伝え、UIの応答性を保つ
2. **isPendingの正常動作**: `useActionState`の`isPending`が正しく動作するために必要
3. **Suspenseとの統合**: React 19のSuspense境界と適切に連携する

## 処理フローの比較

### 通常（自動リセットが発生）

```
ユーザーがsubmit
  ↓
ネイティブsubmitイベント発火
  ↓
React が action={formAction} を検出
  ↓
React が formAction を実行
  ↓
Action完了
  ↓
React が自動的にフォームをリセット ← 問題
  ↓
lastResult が反映されるが、フォームは既にリセット済み
```

### `preventDefault()` + `startTransition`

```
ユーザーがsubmit
  ↓
ネイティブsubmitイベント発火
  ↓
conform の onSubmit が呼ばれる
  ↓
event.preventDefault() でネイティブ送信をキャンセル
  ↓
startTransition 内で手動で formAction を呼び出す
  ↓
Action完了
  ↓
React の自動リセット機構は発動しない（ネイティブ送信ではないため）
  ↓
lastResult が反映され、conform がフォーム状態を制御
```

## 参考

- [React 19 allow opting out of automatic form reset - GitHub Issue](https://github.com/facebook/react/issues/29034)
- [Conform Discussion #606 - Form reset issue](https://github.com/edmundhung/conform/discussions/606)
- [How to (not) reset a form after a Server Action in React](https://www.robinwieruch.de/react-server-action-reset-form/)

### 関連ファイル

- `src/app/(features)/employees/new/EmployeeCreateForm.tsx`
- `src/app/(features)/employees/[employeeCd]/EmployeeUpdateForm.tsx`
