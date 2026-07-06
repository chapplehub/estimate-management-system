# Issue #493 実装計画からの逸脱記録

計画: `variation-application-states-query.md`。実装中に計画の字義と異なる対応をした点を記録する
（CLAUDE.md「Record deviations from plan」）。いずれも設計判断の本筋（ADR-20260706-u7z /
ドリフト封じ / ADR-0069）は不変で、実現手段の細部の調整。

## 1. Step 1: `VALID_VALUES` 配列は export せず、型のみ export

- **元の計画**: 「`VALID_VALUES` を export 可能にし、`ApplicationStatusCode` を `VALID_VALUES as const`
  から export」。
- **実際の実装**: 内部型 `ApplicationStatusValue` を `ApplicationStatusCode` にリネームして export
  するに留め、`VALID_VALUES` 配列自体は private のまま据え置いた。
- **理由**: 消費側（Step 3 の VariationApplicationState）が必要としたのは `ApplicationStatusCode`
  **型**のみ。4値→6値の写像 Record は `Record<ApplicationStatusCode, …>` の型注釈で網羅を保証でき、
  ランタイム配列を参照しない。デッドエクスポートを増やさない方針（vertical slice で「必要になった時に
  出す」）に従い、配列の export を見送った。将来配列が必要になれば追加 export で足りる。

## 2. Step 4: 共有ポリシーの入力を「還元済み state 配列」にした

- **元の計画（設計判断欄）**: 「各バリを `VariationApplicationState` へ還元し `isAdvancing()`、前進バリを
  検出」する純粋ポリシー。
- **実際の実装**: `AdvancingVariationPolicy.hasAdvancingVariation(states)` は**還元済みの**
  `VariationApplicationState[]` を受け取り、`.some(isAdvancing)` のみを担う。還元（`VO.reduce`）は
  呼び出し側（command / query）が行う。
- **理由**: query（Step 6）はバッジ表示のため各バリを必ず還元する。ポリシーが facts を受けて内部で
  再還元すると query 側が二重還元となり、新たなドリフト源になる。「還元＝VO」「見積単位ゲート＝
  ポリシー」の責務分割は計画の設計判断（`還元 → isAdvancing → 見積単位ゲート` のパイプライン）とも
  一致するため、還元を1回に保つ形を採った。

## 3. Step 7: 消費スタブを server `__tests__` ではなく FE 領域に配置

- **元の計画**: 「消費スタブ（型検査専用ファイル）」。配置場所は未指定。
- **実際の実装**: `src/app/(features)/estimates/[estimateNumber]/variationApplicationStateBadge.ts`
  に置いた（FE の S2 詳細画面領域）。
- **理由**: ADR-0069 が守る契約は「FE が BE の DTO を**直 type-import**で消費できる」こと。server 内に
  置くと BE→FE の import 方向を検査できない。FE 領域に置けば、VO に code が増えた瞬間に `never`
  ガードが **FE のビルド（pre-push tsc）**で折れ、契約破れが正しい場所で顕在化する。実行時アサートは
  持たない型検査専用ファイルで、実 UI は FE 分担の別 issue が本ヘルパーを土台に肉付けする。
