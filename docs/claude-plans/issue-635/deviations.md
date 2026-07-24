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

## 2. 拒否メッセージの書式変更に伴い E2E の locator も直した（計画の前提が誤っていた）

### 元の計画内容

判断 8（拒否メッセージは原因でグループ化する）の採用理由に、既存テストへの影響を次のように見積もっていた:

> 既存テストの assertion は商品名の `toContain` のみ（`useVariationLineEditor.test.ts` 128/281/342-344/364-366 行）で
> 接頭辞・全文を assert していないため、書式変更でテストは割れない。**E2E にも文言の assertion は無い**。

### 実際の実装内容

E2E には文言の assertion があった。`estimates-price-unresolvable.e2e.ts:63` が拒否 alert を
`filter({ hasText: "有効な販売単価が無いため" })` で同定しており、書式変更で「無い**ため**」→「無い**: **」と
部分文字列が消滅したため、CI の Playwright で `element(s) not found`（5s タイムアウト）となり 1 件失敗した。

locator のアンカーを可変部（原因ラベル）から不変部（接頭辞「次の商品は追加できません」）へ移し、
原因の内容は `toContainText` で個別に検証する形へ分離して解消した（コミット `b2dca906`）。

### 逸脱の理由

計画時の影響調査が `useVariationLineEditor.test.ts` に閉じており、`*.e2e.ts` まで grep が届いていなかった。
文言・DOM 属性のような**型システムの外にある継ぎ目**は、変更しても TypeScript が参照元を追ってくれず、
diff にも現れないファイルを静かに壊す。手元の pre-push フックは `vitest run`（単体のみ）で E2E を回さないため、
push 時点でも検出されない。

今後、ユーザー可視の文言や DOM 属性を変更する際は、影響調査の grep 範囲に `*.e2e.ts` を必ず含める。
