# ADR-0059: 改訂元のメモのみ更新は専用コマンドで凍結ガードを迂回する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-18 |
| 最終更新日 | 2026-06-18 |

## コンテキスト

#388 で、改訂元（得意先改訂で凍結された納品先宛バリエーション・§7.2）は「メモ以外編集不可」だが、メモ（バリ単位の顧客/社内＋各明細単位の顧客/社内）**だけは編集できる**必要があることが確定した。

凍結は ADR-0044 で「系譜からの導出状態」と決め、ドメインは集約横断ガード `editableVariationOrThrow`（`assertVariationNotFrozen` 通過後に対象バリを返す）で内容編集・明細追加削除・C4 全置換を拒否する。C4 `replaceContent`（全置換）は ADR-0046 でも構造的に拒否対象で、改訂元では凍結ガードが弾く。

しかし #359 時点では改訂元のメモ編集経路が未配線で、メモを変える入口が C4 全置換しか無く、凍結下では一切編集できなかった（#359 deviations ⑤: 凍結が UI 観測すらできなかった）。「メモだけ凍結を貫通する」編集経路をどう実現するかが問題。

## 検討した選択肢

### A. 専用コマンド＋ルート粒度別メソッドで凍結を迂回（採用）

`UpdateVariationMemosCommand`（メモのみ）を新設。ルート `Estimate` に `changeVariationMemos(vId, customer, internal)` / `changeItemMemos(vId, itemId, customer, internal)` を追加し、`editableVariationOrThrow`（凍結拒否）ではなく `findVariationOrThrow`（凍結を通す）経由で既存エンティティ設定子（`EstimateVariation` / `EstimateItem` の `changeCustomerMemo` / `changeInternalMemo`）へ委譲する。メモ設定子は金額を変えないため再計算（ADR-0028）を起こさず、保存も税率整合チェック（`checkTaxRateThenSave`）を通さない素の version 付き保存（ADR-0039）とする。

### B. C4 UpdateVariation を「メモのみモード」に拡張（不採用）

全置換ペイロード・全フィールド編集を二重モード分岐させる。submit 形状は全置換のままで、凍結との原理的衝突（ADR-0046）を抱え込み続ける。

### C. ADR-0049 流の「同値 no-op」で凍結下の編集を通す（不採用）

ヘッダーには有効（締切・部署のみ変更し他項目は同値 no-op）。だがメモは「実際に値を変える」のが目的であり、同値 no-op では表現できない。

## 決定

改訂元のメモ更新は専用コマンド `UpdateVariationMemosCommand` ＋ルート `changeVariationMemos` / `changeItemMemos`（`findVariationOrThrow` 経由）で行い、凍結ガード・再計算・税率整合チェックをいずれも通さない（A を採用）。

## 根拠

- 凍結の保護対象は「内容（金額に効く構造）の保全」であり、メモは金額に効かない注記なので保護対象外。`findVariationOrThrow` 経由は `Estimate` 既存コメント（「メモ変更は凍結中も許可されるため findVariationOrThrow を直接使う」）が張った伏線どおりの帰結。
- 再計算・税率チェックを通さないことで、ADR-0049 が守る「凍結バリの税額再計算が起きない前提」と整合し、不要な整合チェック（ADR-0056 の app-shared ラッパ）の巻き込みを避ける。
- 粒度別ペア（対象 × 顧客/社内）はフォーム submit 単位と一致し、集約境界規約（ADR-0027）に沿って追加実装を最小化できる。
- C4 拡張（B）は ADR-0046 の全置換拒否と衝突し続け、二重モード分岐のコストが専用コマンドの新設コストを上回る。

## 影響

- 集約に強度の異なる 3 経路が並ぶ: **凍結**（改訂元・メモ以外不可）／**行構成固定**（改訂先・行追加削除と全置換のみ不可・ADR-0046）／**通常**（C4 全置換可）。メモ経路は凍結を貫通する唯一の編集経路。
- read model 側の帰結: presentation が「メモのみ編集」を出し分けられるよう、`VariationDTO` に per-variation の `revisionRole: "NONE" | "REVISION_SOURCE" | "REVISION_TARGET"` を追加し、従来の `containsRevisedLine`（明細の `revisedDeliveryPrice` 走査による導出）を全廃する。導出は ADR-0044 の凍結導出を read 側に写したもの（SOURCE＝兄弟バリの誰かが自分を改訂元に持つ、TARGET＝自身が出自 `revisedFrom` を持つ）。`isVariationEditable` は `revisionRole === "NONE" && ACTIVE`、`isVariationDuplicatable` は `revisionRole !== "REVISION_TARGET"` に置き換わる。最終強制は引き続きドメイン（二重防御）。
- セット群自身のメモは本経路の対象外（明細単位メモ＝`EstimateItem` に限定。CONTEXT.md「凍結」定義参照）。
- 本決定はメモ設定子が ADR-0028 の自動再計算対象外であるという前提に依存する。将来メモが金額に影響する要件が出れば本決定の見直しが必要。
