# Issue #618 ラウンド2 レビュー指摘の修正計画

`/auto-review-fix` ラウンド2（`/code-review medium` → judge 評価）で採用された指摘の修正方針。
ID は PR #621 の生レビュー・judge 評価コメントと対応する。

採用①②は 0 件（＝収束）。採用③（cleanup）のみを処理する。

## R2-1: 両分岐が同一の無意味な三項演算子

- **バケツ**: ③ cleanup（simplification）
- **severity（参考）**: Low
- **file:line**: `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.test.ts:85`

### 問題

```ts
expect(result.current.nodes.map((n) => (n.kind === "line" ? n.itemName : n.itemName))).toEqual([...])
```

両分岐が完全に同一。`variationLines.ts:52`（`WorkingLine.itemName: string`）と
`variationLines.ts:81`（`WorkingSetGroup.itemName: string`）の両方に `itemName` があるため、
`WorkingNode` の判別なしに `n.itemName` へ直接アクセスできる。

直下の行に `n.kind === "line" ? n.unitPrice : null` という**本物の分岐**が並んでいるため、
読み手は「itemName も取り方が違うのか？」と確認しに行くことになる（コピペ由来の痕跡に見える）。

### 修正方針

三項を潰して `n.itemName` にする。

```ts
expect(result.current.nodes.map((n) => n.itemName)).toEqual(["商品A", "商品B", "商品C"]);
```

直下の `n.kind === "line" ? n.unitPrice : null` は**残す**。`WorkingSetGroup` は価格を持たない
薄い衛星（ADR-0047）で `unitPrice` を持たないため、こちらは判別が必須の本物の分岐。

### ③ cleanup 採用根拠

1. **挙動不変**: assert の対象値は完全に同一。テストは緑のまま通る
2. **設計判断が不要**: 三項を除去するだけで、置き場所・抽象化の選択が一切ない
3. **局所的**: テストファイルの1行に閉じる。プロダクションコード・公開シグネチャへの波及なし

### 影響範囲

`useVariationLineEditor.test.ts` の1行のみ。

### 想定テスト

新規テストは不要（テストコード自体の簡素化のため）。`useVariationLineEditor.test.ts` が
緑のまま通ることを確認する＝挙動不変の担保。

## R2-2（対応しない・残課題）

`DataTable.tsx:147` の「`className` の有無を『利用側が背景色を引き取った』の代理指標にしている」件は
③の基準2（設計判断が不要）・基準3（局所的）をいずれも満たさないため本 PR では対応しない。
ADR-20260716-r4d の「`DataTable` は『無効』の意味を知らない」汎用性方針とも衝突するため、
**別 Issue で「`getRowAttributes` の className セマンティクス明確化」として起票する**のが妥当。
現時点で `getRowAttributes` を渡すのは `SelectionModal` の1箇所のみで実際に背景色を返すため実害は未発生。
