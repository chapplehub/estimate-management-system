# Issue #598 ラウンド1 レビュー指摘の修正計画（/auto-review-fix・/code-review medium）

`/code-review`（深さ medium・対象 `develop...HEAD`）の 6 件を judge が再評価した結果、
**採用①correctness: 0 件 / 採用②方針違反: 0 件 / 採用③cleanup: 3 件 / ④残課題: 3 件**。

採用①②が 0 件のため収束条件を満たす。本ラウンドは**採用③（cleanup）3 件のみ**を処理して終了する。

## 修正対象（③ cleanup）

3 件はいずれも**同一の根**を持つ: 本 PR は改訂先の固定値引セマンティクスを「複写 → クリア」に
撤回した（ADR-20260714-pv8）が、撤回前の「全複写」を述べる記述が**ドメイン層の外側に残存**して
いる。Step 2 の対象が UI ダイアログと E2E ヘッダに限られていたため取りこぼした。
コードの挙動は一切変えない（doc コメント・業務ドキュメントのみ）。

### ③-1 `reviseForCustomerSchema.ts` の doc コメント

| 項目 | 内容 |
|---|---|
| バケツ / severity(参考) | ③ cleanup / Medium |
| file:line | `src/app/(features)/estimates/[estimateNumber]/reviseForCustomerSchema.ts:7` |
| 問題 | 「掛率・値引・メモ・全体値引は改訂元から複写し、見積単価のみ得意先宛で再解決する」が旧セマンティクスのまま。同一ディレクトリの `ReviseForCustomerDialog.tsx` は本 PR で「固定値引はクリア」に更新済みで、同じ機能の説明が割れている |
| 修正方針 | 「率（掛率）・メモは改訂元から複写、見積単価は得意先宛で再解決（#431）、固定値引（明細値引・全体値引）はクリア（ADR-20260714-pv8・#598）」に書き換える。スキーマの本旨（利用者の入力面は sourceVariationId と version の 2 つだけ）は変えない |
| 影響範囲 | doc コメントのみ。挙動・型・テストに影響なし |
| 想定テスト | 既存 `reviseForCustomerSchema.test.ts` が緑のまま |
| ③採用根拠 | 挙動不変（コメントのみ）・設計判断不要（ADR が文言を確定済み）・局所的（1 ファイルの doc ブロック） |

### ③-2 `ReviseForCustomerCommand.ts` のクラス doc

| 項目 | 内容 |
|---|---|
| バケツ / severity(参考) | ③ cleanup / Medium |
| file:line | `src/server/subdomains/estimate/application/commands/ReviseForCustomerCommand.ts:37` |
| 問題 | 「（全複写・deliveryPrice スナップショット・系譜・凍結はドメインの責務）」の「全複写」が実挙動と食い違う。ドメイン側 `Estimate.reviseForCustomer` の doc は本 PR で更新済みで、アプリ層だけ旧記述 |
| 修正方針 | 「全複写」を「率・メモの複写／単価の再解決／固定値引のクリア」に改める。ドメインの責務であることの主張は維持する |
| 影響範囲 | doc コメントのみ |
| 想定テスト | 既存の Command テストが緑のまま |
| ③採用根拠 | 挙動不変・設計判断不要・局所的（1 ファイルの doc ブロック） |

### ③-3 業務ドキュメント C7 行

| 項目 | 内容 |
|---|---|
| バケツ / severity(参考) | ③ cleanup / Medium |
| file:line | `docs/business/estimate/ユースケース一覧(見積).md:41` |
| 問題 | C7 行の「**改訂先の内容はドメインが改訂元から全複写で決定する**ため UI は内容入力を取らない純粋確認ゲート」が、本 PR で更新済みの CONTEXT.md・ADR-20260714-pv8 と矛盾。放置するとドキュメント間の不整合が固定化する |
| 修正方針 | 「全複写」を「改訂先の内容をドメインが決定する（率・メモは複写／単価は得意先宛で再解決／固定値引はクリア）」に改める。UI が純粋確認ゲートである結論は変わらない（内容入力を取らない理由が「全複写だから」から「ドメインが決定するから」に精密化されるだけ） |
| 影響範囲 | ドキュメントのみ |
| 想定テスト | なし（docs 変更のみ・pre-commit の vitest related はスキップされる） |
| ③採用根拠 | 挙動不変・設計判断不要（ADR が確定済み）・局所的（1 行） |

## 対応しない（④ 残課題・別 Issue 起票が妥当）

- `Estimate.ts:262` `reviseForCustomer` が `setGroups` を渡さず改訂元のセット群が改訂先で失われる
  → **スコープ外**。真の欠陥だが、id 再採番に伴う `memberItemIds` 再配線・構成明細の `deliveryPrice`
  方針・`EstimateDuplicationService` 側の同一欠落・永続化/E2E への波及という ADR 相当の設計判断を要する
- `Estimate.ts:255` 「絶対額は持ち込まない」不変則が型で強制されていない（optional 既定に依存）
  → **③基準未達**。共有記述子ビルダの導入は設計判断を伴い、2 経路＋ファクトリ記述子型に波及する
- `Estimate.test.ts:699` 新規テストの構築重複 → **③基準未達**（一部誤検知）。`makeItem` のシグネチャ
  拡張という設計判断が入り、得られる価値も小さい

## コミット方針

3 件とも挙動を変えない記述の同期であり、1 つの意味のまとまり（「撤回した旧セマンティクスの言い残しを
消す」）として `docs:` で 1 コミットにする。本計画ファイル自体も同コミットに含める。
