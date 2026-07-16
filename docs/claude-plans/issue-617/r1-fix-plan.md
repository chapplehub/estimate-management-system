# Issue #617 ラウンド 1 修正計画（/auto-review-fix）

`/code-review medium`（対象 `develop...HEAD`）の指摘 5 件を judge が評価した結果、
**採用①② = 0 件（収束）／採用③ = 1 件／④ 残課題 = 4 件**。本ファイルは採用③の修正方針を定める。

## 修正対象（採用 ③ cleanup）

### R1-1 | ③ cleanup | severity(参考): Low | `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts:166`

**問題**

複製経路のセット群記述子を組む箇所が、型引数なしの bare `RepricedSetGroupDescriptor` を使っている。

```ts
setGroups: structure.setGroups.map(
  ({ group, components }): RepricedSetGroupDescriptor => ({   // ← 経路を名乗っていない
```

`RepricedSetGroupDescriptor<I extends RepricedItemDescriptor = RepricedItemDescriptor>` の
既定型引数により `components: RepricedItemDescriptor[]` と解決される。これが今日通っているのは
`CopiedItemDescriptor = RepricedItemDescriptor` という**別名関係にすぎない**。

**修正方針**

型引数を明示して経路を名乗らせる。

```ts
setGroups: structure.setGroups.map(
  ({ group, components }): RepricedSetGroupDescriptor<CopiedItemDescriptor> => ({
```

`copyItem` は既に `CopiedItemDescriptor` を返しており（143 行）、囲む `toCopiedDescriptor` の
戻り値型は `CopiedVariationDescriptor` ＝ `RepricedVariationDescriptor<CopiedItemDescriptor>`
（＝ `setGroups: RepricedSetGroupDescriptor<CopiedItemDescriptor>[]` を要求）。
よって書くべき型引数は `CopiedItemDescriptor` 一択で、設計判断の余地は無い。

**影響範囲**

`EstimateDuplicationService.ts` 1 ファイル・1 行の型注釈のみ。既定型引数は残すため
他の呼び出し側（型ガードテストの bare 形 2 件）には波及しない。実行時コードは不変。

**想定テスト**

追加テスト不要（型注釈の精緻化であり挙動不変）。担保は次の 2 つ:

- `tsc --noEmit` が緑（型注釈が実際の要求型と一致することの証明）
- 既存の `EstimateDuplicationService.test.ts`（#602 セット群引き継ぎの回帰テストを含む）が緑のまま

**③ 採用根拠**

| 基準 | 充足 |
|---|---|
| 挙動不変 | ✅ 型注釈のみ。トランスパイル後に消える。既存テストは緑のまま通る |
| 設計判断が不要 | ✅ 囲む戻り値型が `CopiedVariationDescriptor` に確定しており型引数は `CopiedItemDescriptor` 一択 |
| 局所的 | ✅ 1 ファイル 1 行。レイヤ／集約をまたがず、公開シグネチャも変えない |

## 修正しないもの（④ 残課題・報告のみ）

- **R1-2**（`EstimateFactory.ts:176,187` 既定型引数が経路非依存な記述子を再導入）: ③基準 2・3 未達。
  既定型引数を外すと型ガードテスト 2 件が壊れ、かつ「ガードを土台型で実体化するか経路型で検査し直すか」に
  設計判断の余地がある（ADR-w4k「構造ガードは最終合成型に対して固定する」の解釈に踏み込む）。
  現時点の実害は無い（`buildRevisedVariation` が `RevisedVariationDescriptor` を要求するため
  bare 形は改訂ビルダーに届かない）。ADR-w4k 追記とセットで後続 Issue とすべき。
- **R1-3**（`Estimate.ts:256` `toRepricedItem` の命名）: ④（命名の乱れ）。③の 4 カテゴリ非該当。
- **R1-4**（`Estimate.ts:252` コメントが #617 に未言及）: ④（コメント）。③非該当。
- **R1-5**（`repricedDescriptor.type.test.ts:15` docstring が #603 のまま）: ④（コメント）。③非該当。
