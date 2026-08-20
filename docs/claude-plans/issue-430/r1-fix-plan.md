# Issue #430 自動レビュー＆修正 ラウンド1 修正計画

`/auto-review-fix 595`（深さ medium）の judge 評価で採用された指摘の修正方針。

## 採用①② （修正対象）

### 指摘1 [① correctness / severity参考: High]

- **file:line**: `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts:132`
- **問題**: セット構成の解決不能判定が `prices[c.productId] === null`（strict equality）。表示解決 Server Action `resolveSellingPricesForDisplay` は `estimateDate` が空のとき空マップ `{}` を返す（`selling-price-actions.ts:42-44`）。このとき `prices[c.productId]` は `undefined` となり、`undefined === null` は `false` のため解決不能判定を素通りする。結果、拒否されずに `createWorkingSetGroup(..., (productId) => prices[productId]!)` が全構成に `unitPrice: undefined` を与え、`previewVariationTotals` の金額が NaN になる。
- **根拠（非対称性）**: 同ファイルの通常明細パス（157行 `prices[snapshot.id] == null`）とサジェストパス（182-183行 `prices[s.id] != null` / `== null`）はいずれも loose equality で `undefined` も拾う。セットパス（132行）だけが `=== null` で非対称に壊れている。作者が意図した3経路対称のうち1経路の取りこぼし。
- **修正方針**: 132行の `prices[c.productId] === null` を `prices[c.productId] == null` に変更し、兄弟2経路と対称にする。`undefined`（キー欠落＝estimateDate 空）も解決不能として扱い、セット展開を拒否してエラー表示へ倒す。
- **影響範囲**: `useVariationLineEditor.ts` 1行のみ。挙動変更は「estimateDate 空でセット商品選択時、NaN セット群を無言追加していたのを、解決不能として拒否・エラー表示に変える」方向のみ（正しい振る舞いへの是正）。通常明細・サジェスト経路は不変。
- **想定テスト**: `useVariationLineEditor.test.ts` に「estimateDate 空 → セット商品選択で `prices` が空マップ → セット展開が拒否され selectionError が設定され nodes が増えない」ケースを追加。既存のセット展開成功ケースは緑のまま。

## ④残課題（このラウンドでは修正しない・Phase 6 サマリへ）

judge が③基準未達・計画準拠・パターン一貫・便益僅少で④に振り分けた7件（指摘2〜8）。詳細は PR コメント「⚖️ judge 評価 ラウンド 1」を参照。
