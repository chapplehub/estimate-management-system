# useCallbackの適切な使用場面

作成日: 2026-01-08

## 概要

ReactのuseCallbackフックは、パフォーマンス最適化のためのツールだが、適切な使用場面を理解せずに乱用すると、効果がないばかりか余計なオーバーヘッドを追加することになる。

## 詳細

### useCallbackが必要な場合

1. **`memo`でラップされたコンポーネントに関数をpropsとして渡す場合**
   - 子コンポーネントが`React.memo()`でメモ化されている場合のみ効果がある
   - メモ化された子コンポーネントは、propsが変わらなければ再レンダリングをスキップする

2. **他のHookの依存関係として使用される場合**
   - `useEffect`の依存配列に含める関数
   - 別の`useCallback`や`useMemo`の依存配列に含める関数

### useCallbackが不要な場合

- **ネイティブHTML要素**（`<button>`, `<form>`, `<input>`など）に渡すイベントハンドラ
  - ネイティブ要素はmemo化されていないため、効果がない
- **依存配列の値が頻繁に変わる場合**
  - 例: stateを依存配列に含めると、入力のたびに関数が再生成される
  - メモ化の効果がほぼなくなる

### 悪い例（今回のケース）

```tsx
// ❌ 不要なuseCallback
const handleSearch = useCallback(
  (e: React.FormEvent) => {
    // ...
  },
  [name, email, employeeCd, role, pathname, router] // stateが含まれている
);

// <form onSubmit={handleSearch}> に渡している（ネイティブ要素）
```

問題点:
1. `<form>`はネイティブ要素なのでmemo化されていない
2. `name`, `email`などのstateが依存配列にあり、入力のたびに再生成される

### 良い例

```tsx
// ✅ シンプルな関数定義で十分
const handleSearch = (e: React.FormEvent) => {
  e.preventDefault();
  // ...
};

const handleClear = () => {
  setName("");
  // ...
};
```

### 公式ドキュメントの指針

> "You should only rely on useCallback as a performance optimization. If your code doesn't work without it, find the underlying problem and fix it first."

useCallbackはパフォーマンス最適化であり、必須ではない。まずコードが正しく動作することを確認し、実際にパフォーマンス問題が発生した場合にのみ検討する。

## 参考

- [React公式: useCallback](https://react.dev/reference/react/useCallback)
- [Skipping re-rendering of components](https://react.dev/reference/react/useCallback#skipping-re-rendering-of-components)
- 修正したファイル: `src/app/(features)/employees/_components/EmployeeSearchForm.tsx`
