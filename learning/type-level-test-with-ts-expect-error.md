# @ts-expect-error を使った型レベルテスト

作成日: 2026-07-16

## 概要

「コンパイルエラーになるべきコード」を `@ts-expect-error` 付きで書くことで、**型の不変則が緩んだことを型チェック（`tsc --noEmit`）で検知する**手法。挙動テスト（実行時の値の検証）では捕まえられない「型が緩んだ」という回帰を、テストとして固定できる。

`@ts-expect-error` は**テストコード内でのみ**有用。本番コードに書くのはアンチパターン（型エラーを握りつぶす用途になり、意図せぬエラーまで通してしまう）。

## 詳細

### 仕組み

`@ts-expect-error` は「次の行で型エラーが起きること」を期待するディレクティブ。

- 次行が**型エラー → OK**（期待どおり）
- 次行が**型エラーにならない → `tsc` が「未使用の @ts-expect-error」として赤にする**

この「エラーが消えたら赤になる」性質を使い、**禁止したいコードが本当に型で禁止できているか**をテストする。将来だれかが型を緩めて禁止コードを通せるようにすると、`@ts-expect-error` が不要になり型チェックが落ちる。

### 使いどころ

型で不変則を強制した箇所。「この型はこのフィールドを名乗れない」「この関数はこの引数を受け取れない」を固定したいとき。挙動テストは happy-path の結果しか担保せず、「型が緩んで禁止コードが書けるようになった」ことは検知できないため、型ガードで補完する。

### コード例（Issue #603 での採用）

単価再解決を伴う生成（複製先・改訂先）で固定値引を型から消した `Repriced*` 記述子と、通常用 `buildVariation`（`revisedFrom` を受け取らない）を固定する:

```ts
// RepricedItemDescriptor は itemDiscount を名乗れない
// @ts-expect-error itemDiscount は再解決経路の記述子に存在しない
const _a: RepricedItemDescriptor = { ...validRepricedItem, itemDiscount: someMoney };

// RepricedVariationDescriptor は overallDiscount を名乗れない
// @ts-expect-error overallDiscount は再解決経路の記述子に存在しない
const _b: RepricedVariationDescriptor = { ...validRepricedVariation, overallDiscount: someMoney };

// 通常用 buildVariation は revisedFrom を受け取れない（改訂専用 buildRevisedVariation のみ）
// @ts-expect-error revisedFrom は通常バリエーション組み立てに存在しない
buildVariation(validDescriptor, { tax, revisedFrom: someId });
```

これにより、型を緩める変更が入ると pre-push の `tsc --noEmit` が赤になり、コメント頼みだった不変則（#598 の再発源）を構造的に守れる。

### 注意点

- `@ts-expect-error` は「何のエラーでも」期待を満たしてしまう。意図と違うエラー（別のtypo等）でも通ってしまうので、直前に有効なベース（`validRepricedItem` 等）を用意し、**禁止フィールドの追加だけが差分**になるように書くと精度が上がる。
- 似た `@ts-ignore` は「エラーがあってもなくても黙らせる」ため型テストには使えない。必ず `@ts-expect-error` を使う。

## 参考

- 採用: Issue #603（単価再解決を伴う生成で固定値引を持ち込まない不変則を型で強制する）
- repo 内の前例: `src/server/subdomains/estimate/domain/entities/__tests__/EstimateVariation.test.ts`, `AfterRepairEstimateDetail.test.ts`
