# issue-493 自動レビュー＆修正 ラウンド1 修正計画

`/code-review medium` → judge 評価の結果、採用①②（correctness/方針違反）は 0 件で収束。
本ラウンドは採用③（cleanup）2 件のみを機会主義的に処理する。

## 対象（採用③のみ）

### F2: reduceVariationState の独立2クエリを並列化（efficiency）

- バケツ: ③cleanup / severity参考: Low
- file:line: `src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts:164-165`
- 問題: `reduceVariationState` 内で `exemptionRepository.findByVariationId` と
  `applicationRepository.findByVariationId` を逐次 await している。両者は互いに独立で
  `variationId` のみを引数に取り、結果を別々に使うだけ。
- 修正方針: 2 つの await を `Promise.all([...])` で並列化する。
- 採用根拠（③3基準）:
  - 挙動不変: 2 つの読み取りは順序依存なし、戻り値も同一。既存テスト緑のまま。
  - 設計判断不要: `Promise.all` 化のみ。置き場所・抽象化の迷いなし。
  - 局所的: 単一 private メソッド内・単一ファイル・公開シグネチャ不変。
- 影響範囲: `SubmitApplicationCommand` のみ。呼び出し側変更なし。
- 想定テスト: 既存の `SubmitApplicationCommand` 系テストが緑のまま。

### F3: findByEstimateId の位置結合（states[index]）を解消（simplification）

- バケツ: ③cleanup / severity参考: Low
- file:line: `src/server/subdomains/estimate/infrastructure/queries/PrismaVariationApplicationStateQueryService.ts:61-75`
- 問題: `variations` を 2 度 map し、2 回目で `states[index]` により位置結合している。
  両 map が同順走査である前提に暗黙依存し、将来 filter/sort が挟まると静かにズレる。
- 修正方針: `{ variation, state }` ペアに 1 度 map してから、そのペア配列から
  `hasAdvancing` を算出し DTO を構築する。位置インデックス結合を排除する。
  （`hasAdvancing` は全 state を先に必要とするため単一 fold にはせず、ペア配列を介する zip 形にする）
- 採用根拠（③3基準）:
  - 挙動不変: 出力 DTO は同一。既存テスト（GetVariationApplicationStatesQuery.test.ts）緑のまま。
  - 設計判断不要: 位置結合をペア結合へ置換するだけ。
  - 局所的: 単一メソッド `findByEstimateId` 内・単一ファイル・公開シグネチャ不変。
- 影響範囲: `PrismaVariationApplicationStateQueryService` のみ。
- 想定テスト: `GetVariationApplicationStatesQuery.test.ts` が緑のまま。

## 対象外（④残課題・報告のみ）

- F1（前進ゲートの INACTIVE 包含）: スコープ外。根治は ADR-0061 #335 の
  `DeactivateVariationCommand.assertDeactivatable`。単純除外は「1見積1前進」不変条件を逆に破る。
- F4（2本の Record マップ）: ③基準未達（写像先の型が異なり設計判断が必要）。
- F5（reduceVariationState の facts 組み立て重複）: ③基準未達（application/infra 層跨ぎの置き場所判断が必要）＋計画準拠。

## 修正順

F2・F3 とも③cleanup で①②の修正はないため、独立に適用。各々コミット（`refactor:`）。
実装後 `pnpm test` / `pnpm lint` で挙動不変・緑を確認する。
