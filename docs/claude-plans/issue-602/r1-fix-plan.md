# Issue #602 / PR #607: 自動レビュー ラウンド 1 の修正計画

`/code-review medium` → judge 評価の結果、**採用①（correctness）0 件・採用②（方針違反）0 件・採用③（cleanup）1 件**。
本ファイルは採用③の 1 件のみを対象とする。

## 対象

### [③ cleanup / severity参考: Low] `EstimateVariation.lineStructure` の索引化

- **file:line**: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts:629`
- **問題**: `lineStructure` が構成明細 1 件ごとに `findItemOrThrow`（`_items.find` の線形走査）を呼ぶため、
  計算量が O(群数 × 構成数 × 明細数) になる。getter の冒頭で `memberItemIds` の Set を作るために
  `_setGroups` を既に 1 周しており、同じ材料から id → 実体の索引を作れば O(明細数) で済む。
- **修正方針**: `_items` から `Map<string, EstimateItem>`（id.value → 実体）を 1 度だけ構築し、
  構成明細の解決をその索引引きに置き換える。欠落時に投げる `BusinessRuleViolationError` は
  `findItemOrThrow` と**同一メッセージ**を保つため、エラー生成を private static ヘルパに切り出して
  `findItemOrThrow` と共用する（メッセージの二重管理を避ける）。
- **やらないこと**: getter のメモ化・キャッシュ導入。呼び出し元（`Estimate.reviseForCustomer`・
  `EstimateDuplicationService.toCopiedDescriptor`）はいずれも 1 回だけ呼んでローカル変数に受けており
  再計算の実害が無いうえ、キャッシュ導入は「いつ無効化するか」という設計判断を伴うため cleanup の
  範囲を超える（＝バケツ④）。
- **影響範囲**: `EstimateVariation.ts` 1 ファイルに閉じる。公開シグネチャ（`VariationLineStructure`）は不変。
  `findItemOrThrow` の呼び出し元（`changeItem*` 系・`deriveSetGroup`）の挙動も不変。
- **想定テスト**: 既存の `EstimateVariation.test.ts`「lineStructure - 平坦な items をセット群で仕分ける（#602）」
  4 本（群なし／群 1 件／群 2 件／`memberItemIds` 順）が緑のまま通ること。改訂・複製側の
  `Estimate.test.ts` / `EstimateDuplicationService.test.ts` のセット群テストも緑のままであること。
- **③ 採用根拠**:
  - **挙動不変**: 索引引きに変えるだけで、返す実体・順序・欠落時の例外型とメッセージはすべて同一。
  - **設計判断不要**: 同一 getter 内で完結し、置き場所・抽象化の選択肢が無い。
  - **局所的**: 1 ファイル 1 メソッド。レイヤ・集約をまたぐ波及も、呼び出し側の一斉修正も無い。

## 却下・残課題（本ラウンドでは直さない）

judge が④に落とした 4 件は PR コメント（judge 評価 ラウンド 1）に理由付きで記録済み。要約:

- **テスト網羅（Medium）**: 改訂・複製のセット群テストが群 1 件のケースのみ → テスト追加は③の
  「挙動不変の純粋リファクタ」ではないため④。人間の判断に委ねる。
- **群構築手順の重複（Low）**: ADR-20260714-k2m が「共通化の上限は『仕分け』」と決着済み（計画準拠）。
- **副作用付き map（Low）**: `EstimateFactory.buildSetGroups` との対称を意図した形（計画準拠／③基準未達）。
- **`copyItem` の引数型（Low）**: develop 時点からの同ファイルの慣用（誤検知）。
