# Issue #507 auto-review-fix ラウンド1 修正計画（採用 ③cleanup のみ）

`/code-review medium` → judge 評価の結果、**採用①②（correctness / 方針違反）は 0 件で収束**。
本ラウンドで手を入れるのは judge が③cleanup として採用した2件のみ。①②は無いため、③のみ処理して完了サマリへ。

## 対象1: TimelinePeriod 写像の重複を private ヘルパへ集約（③simplification）

- **バケツ / severity(参考)**: ③cleanup / Low
- **file:line**: `src/app/(features)/customer-selling-prices/[customerCd]/[productCd]/PeriodDetailPanel.tsx:129-144`
- **問題**: `computeTimelineLayout` 呼び出しで `detail.periods` と `commonPeriods` を同一の中立構造 `{periodId,start,end,status,price:sellingPrice}` へ写像する2つのインライン `.map` が完全に重複。
- **修正方針**: 同一ファイル内の module-level private 関数 `toTimelinePeriod` に集約し、主・従の両 `.map` から呼ぶ。
  引数型は両 DTO 要素が構造的に適合する最小構造型（`periodId/start/end/status/sellingPrice`、status は `_shared/period-rules` の `PeriodStatus`）。返り値は `_shared/timeline-layout` の `TimelinePeriod`。
- **採用根拠（③3基準）**: (1)挙動不変＝両 map は完全同一の射を無状態ヘルパへ括り出すだけ。(2)設計判断不要＝同一ファイル内 private ヘルパで置き場所一意、variant/flag 引数なし。(3)局所的＝1ファイルに閉じ公開シグネチャ変更なし。「同一ファイル内 private 関数抽出は可（最も安全）」に該当。
- **影響範囲**: `PeriodDetailPanel.tsx` のみ。
- **想定テスト**: 既存テスト（`timeline-layout.test.ts`）が緑のまま。写像部分に新規テストは新設しない（計画方針・E2E は #509）。`pnpm test` / `pnpm lint` で確認。

## 対象2: テストの不要な optional chaining / non-null assertion 除去（③conventions）

- **バケツ / severity(参考)**: ③cleanup / Low
- **file:line**: `src/app/(features)/_shared/timeline-layout.test.ts:142,144,165`
- **問題**: `secondaryBars` は型上非オプショナル（`TimelineBar[]`・timeline-layout.ts:52）なのに、テストが `secondaryBars?.map(...)` と `secondaryBars![0]` で不要な `?.` / `!` を使い型と齟齬。読者に「未定義があり得る」と誤読させる。
- **修正方針**: `secondaryBars?.map` → `secondaryBars.map`、`secondaryBars![0]` → `secondaryBars[0]` に置換。`toBeDefined()`（141行）と `toEqual([])`（173行）はそのまま残す。
- **採用根拠（③3基準）**: (1)挙動不変＝死んだ `?.`/`!` の除去でテストは緑のまま。(2)設計判断不要。(3)局所的＝当該テストファイルに閉じる。Step 3-1 の TDD 正規テストでスコープ内。
- **影響範囲**: `timeline-layout.test.ts` のみ。
- **想定テスト**: `pnpm test` で当該テストが緑。

## 却下（④・修正しない。理由は PR コメントに記録済み）

- PriceTimeline 従レーンの表示意味論 → 計画準拠（表示専用フォールバック層は意図的設計）
- PrimaryBar/SecondaryBar 統合 → ③基準未達（variant 引数による内部分岐が必須）
- 76px マジックナンバー → ③基準未達（Tailwind JIT の静的検出で挙動不変が非保証）
- computeTimelineLayout の従レーン特殊ケース → 計画準拠（選択肢A・後方互換オプション引数拡張を明示採用）
