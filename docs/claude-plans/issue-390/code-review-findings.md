# PR #395 コードレビュー指摘（改訂先バリエーションの部分編集・#390）

- 対象: PR #395 / `feat/issue-390`（base: `develop`）
- レビュー: `/code-review high`（8 finder 角度 → 検証）
- 実施日: 2026-06-19
- 総評: ドメイン／アプリ層の正しさは TDD でよく担保されており、**マージを止める正しさバグは無し**。残りは altitude・ドキュメント整合・クリーンアップ。

## 対応状況

| 指摘 | 区分 | 状況 |
|---|---|---|
| 1 | 正しさ | 取り下げ（Playwright 実機検証で反証） |
| 2 | altitude | イシュー化 → #398（draft・要設計） |
| 3 | ドキュメント | 対応済み（ADR-0046 に改訂注記・本 PR でコミット） |
| 4 | 再利用 | 対応済み（cellInputClass を formStyles へ集約・本 PR） |
| 5 + 6 | 簡素化・効率 | イシュー化 → #399（draft） |
| 7 | 再利用 | イシュー化 → #397（draft） |
| 8 | 簡素化 | 対応済み（patchItem 統合・本 PR） |
| 9 | 簡素化 | 対応済み（lineGross 共通化・本 PR） |

## 指摘1（取り下げ・参考）

> 【正しさ】controlled な数値入力が空・小数の途中入力を 0 に倒す（掛率が致命的）

**Playwright MCP の実機検証で反証**（→ 取り下げ）。実際の改訂先バリの価格調整フォームで 1 文字ずつ実キー入力した結果、掛率の小数入力（`0.95` / `2.5`）は正常に通った。React の controlled な `type="number"` は中間の無効状態（`2.`）でブラウザの編集バッファを上書きしないため、`.` は消えない。

残った軽微な点（任意の磨き込み）:
- 数値セルを空にすると `0` にスナップする（空のまま置けない）。
- クリア後に打ち直すと先頭ゼロが残る表示（`05000` 等）。ただし送信値・parse 値は正しく**データ破損なし**。掛率 `0` のままの保存は schema の `positive()` が弾く。

---

## 指摘2 【altitude】数量不変条件が `changeItemQuantity` の入口1点でしか守られていない

- 対象: `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts:236, 466`
- 内容: `assertQuantityImmutable` は「改訂先では数量が動かない」という**状態の不変条件**を、特定メソッド（`changeItemQuantity`）の先頭ガードとして表現している。`EstimateItem.changeQuantity` 自体は無防備で、現状は `replaceContent`（改訂先を全置換ごと `assertLineStructureMutable` で拒否）と `changeItemQuantity` の 2 経路しか数量を触らないため穴は塞がっている。
- 失敗シナリオ: 将来 部分置換・一括リサイズ等の数量変更経路が 1 つ増えると `assertQuantityImmutable` を通らず改訂先の数量が動き、`deliveryPrice`（旧数量の行金額）と `finalAmount`（新数量）の差が無意味な粗利になる（ADR-0060 の前提崩壊）。
- 補足: 現状はバグではなく将来脆弱性。深さの観点では「各ミューテータでガードを再宣言」ではなく、状態ベースの不変条件（改訂先で数量が初期値から動いたら拒否）への一般化が望ましい。

## 指摘3 【ドキュメント整合】ADR-0060 が改めると宣言した ADR-0046 本文が未更新

- 対象: `docs/adr/0060-revised-variation-fixes-quantity-to-preserve-gross-profit-snapshot.md:71`（影響欄）
- 内容: ADR-0060 影響欄は「ADR-0046 と旧 CONTEXT.md の数量可変記述を改める」と述べるが、本 PR は CONTEXT.md とコード内コメントは更新する一方、**一次情報源 ADR-0046 本文（"単価・掛率・値引・数量・メモの調整は可能"）は未更新**。
- 失敗シナリオ: 後続実装者が ADR-0046 を真実の源として読み「改訂先は数量可変」と誤認し、数量を扱う UI／コマンドを再導入して粗利スナップショット保全の前提を再び破る。採用済みの 2 ADR が相反した状態になる。
- 提案: ADR-0046 に「ADR-0060 で改訂」のステータス注記を追記する。

## 指摘4 【再利用】`cellInputClass` が `LineEditTable` と完全一致で再定義されている

- 対象: `src/app/(features)/estimates/[estimateNumber]/components/LineTable.tsx:20`（`LineEditTable.tsx:32` とバイト一致・コメントも自認）
- 内容: 入力セルの共通クラス文字列が 2 箇所に重複。`formStyles.ts` に共通スタイル集約の前例（`inputClass`／`memoInputClass`）がある。
- コスト: 入力セルの focus リング色やパディングを変えるとき片方だけ直し、改訂先テーブルと通常編集テーブルでセル外観が割れる。
- 提案: `cellInputClass` を `formStyles.ts` へ移し、両テーブルから import する。

## 指摘5 【簡素化】`overallDiscount` を useState と conform field で二重管理している

- 対象: `src/app/(features)/estimates/[estimateNumber]/VariationAdjustForm.tsx:290, 386-396`
- 内容: 同一 input に controlled `value`（プレビュー用 state）＋`name={fields.overallDiscount.name}` を併設し、schema にも定義。送信値の真実源（state）と検証系（conform）が分離している。
- コスト: 税率不一致・楽観ロック競合で `reply` → 再描画されると、useState が持つ画面値と conform が復元する値が乖離し、表示と保存値が食い違いうる。既存フォームのスカラー＝conform 一本の流儀からの逸脱。
- 提案: スカラーは conform を単一の真実源とし、プレビューは conform の値を read する形に寄せる。

## 指摘6 【効率】派生プレビューが毎レンダー（=入力1文字ごと）に全件再計算される

- 対象: `src/app/(features)/estimates/[estimateNumber]/VariationAdjustForm.tsx:313-340`
- 内容: `linesWithAdjust` → `flatLines` → `previewLines` → `totalGross` → `totals` を `useMemo` なしで毎レンダー生成。
- コスト: 単価入力 1 文字ごとの再レンダーで `O(明細数)` の派生計算＋オブジェクト再生成が走る。明細数が増えると入力レイテンシ／GC 負荷が上がる。粗利ライブ反映はホットパス。
- 提案: `items`／`overallDiscount`／`variation` にのみ依存する純導出なので `useMemo` 化する。

## 指摘7 【再利用】DTO 明細平坦化ロジックが複数箇所に散在

- 対象: `src/app/(features)/estimates/[estimateNumber]/VariationAdjustForm.tsx:238, 313, 320`（＋ `VariationMemoEditForm.tsx` の `buildInitialItemMemos`／`linesWithMemos`）
- 内容: 「`setGroup` なら `components`、else 行」の平坦化・写し込みが `buildInitialItemAdjust`／`linesWithAdjust`／`flatLines` と `VariationMemoEditForm` に重複。`variationLines.ts` の `flattenPricedLines` は `WorkingNode` 型で DTO に流用不可のため別系統で重複している。
- コスト: セット群の扱い（対象明細集合・群自身を対象外にする等）を変える仕様変更時に全コピーを直す必要があり、片方を漏らすとメモと価格で対象明細集合がずれる。
- 提案: DTO 用の共通平坦化（例 `flattenLineDTOs(lines): LineDTO[]`）を 1 つ起こし、両フォームで使う。

## 指摘8 【簡素化】`patchPrice` と `patchMemo` が同一実装

- 対象: `src/app/(features)/estimates/[estimateNumber]/VariationAdjustForm.tsx:292-297`
- 内容: 本体が `setItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId]!, ...patch } }))` で完全に同一。`prev[itemId]!` の non-null 断言の落とし穴（未登録 itemId でのクラッシュ）も両者で二重。`VariationMemoEditForm` 側は `?? ""` でガードしている前例がある。
- 提案: patch を union 型にした単一 setter に統合し、未登録 itemId ガードを 1 箇所に入れる。

## 指摘9 【簡素化】行粗利計算が `LineRow` とフォーム合計で二重定義

- 対象: `src/app/(features)/estimates/[estimateNumber]/components/LineTable.tsx:194` と `VariationAdjustForm.tsx:330-334`
- 内容: `revisedDeliveryPrice − previewLineAmount(...)` を `LineRow`（行ごとの粗利列）とフォーム（`totalGross` の reduce）で別々に記述。
- コスト: §8.4 の粗利定義や逆ザヤ赤字閾値を変えると 2 箇所直す必要があり、片方だけ直すと「行粗利の合計」と「合計粗利」表示が一致しなくなる。
- 提案: 行粗利を返す純関数（例 `lineGross(line)`）に括り出して共有する。

---

## 検証で REFUTED（取り下げ・参考）

- `actions.ts` の `formErrors: []` 握り潰し疑い → 既存全 action と同一定型で、`handleCommandError` は常に非空 `error` を返すため到達不能。
- `adjustPricing` がドメインで改訂先限定しない → 設計上「一般の編集可能バリにも安全」と明言、意図通り。
- `changeItemMemos` ループでの id 不一致クラッシュ → DTO と `_items` の itemId 集合は 1:1 で一致。
- 粗利 ±1 円近似による境界での赤字誤表示 → ADR-0050 影響欄で明示済みの許容近似。

## 優先度の目安

1. 短期（任意）: 指摘3（ADR-0046 注記）はドキュメント整合のみで低コスト。指摘4・8・9 は局所的なクリーンアップ。
2. 中期: 指摘5・6・7 はフォーム設計の磨き込み（conform 一本化／`useMemo`／共通平坦化）。
3. 設計メモ: 指摘2 は将来の数量変更経路追加時に効いてくる脆弱性。次に数量系を触る issue で状態ベースの不変条件へ一般化を検討。
