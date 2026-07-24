# Issue #635: 実装計画からの逸脱

計画: `docs/claude-plans/issue-635/unify-selection-modal-confirm-outcome-union.md`

## 1. テストの手写し型の寄せ先を `SelectionModalProps` から `SelectionConfirmHandler` へ変更した

### 元の計画内容

Step 1 の作業内容:

> `SelectionModal.test.tsx:35` の手写し型を `SelectionModalProps<Row>["onConfirm"]` 参照へ寄せる（`SelectionModalProps` の export が必要）

### 実際の実装内容

`SelectionModalProps` は非 export のまま据え置き、`onConfirm` の型だけを名前付きで切り出して export した。

```ts
export type SelectionConfirmHandler<TData> = (
  selectedItems: TData[]
) => SelectionOutcome | Promise<SelectionOutcome>;
```

テスト側は `onConfirm: SelectionConfirmHandler<Row>` と書く（`SelectionModalProps<Row>["onConfirm"]` ではなく）。

### 逸脱の理由

「テストの手写し型を契約の所有者へ寄せる」という目的は両案とも達成する。そのうえで名前付きの型を選んだのは、
**引数の不変条件（`selectedItems` は必ず 1 件以上）の記述場所を 1 箇所に定められる**ため。

判断 2 で「不変条件は JSDoc に記述する」と決めたが、その JSDoc をどこに置くかまでは決めていなかった。
props 型の `onConfirm` フィールドに書くと、呼び出し元のハンドラに注釈を付けたい人（`(rows: CompanyRow[]): SelectionOutcome => ...`）
からは辿りづらい。専用の型があれば、そこが不変条件の正典になり、型を参照した先で必ず読まれる。

なお実装途中、`SelectionModalProps` を export した際に Next の TS プラグイン警告（71007
"Props must be serializable for components in the use client entry file"）が新規に出たように見え、
一度それを理由に挙げたが、これは誤りだった。同警告は未変更の `onClose` / `getRowId` にも出ており、
`git stash` して確認したところ export の有無と無関係な既存の IDE 専用警告（`tsc --noEmit` には出ない）
であることが判明したため、この理由は撤回している。
