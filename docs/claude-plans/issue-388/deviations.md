# Issue #388 実装の計画からの逸脱記録

計画: `docs/claude-plans/issue-388/revision-source-memo-only-edit.md`

実装は計画の 7 ステップ・設計判断（ADR-0059）に忠実。以下は軽微な逸脱（多くはテストの追加・整理）。

## ① Step 1: 「凍結中の非メモ操作はエラー」テストを新規追加しなかった

- 計画: RED で「凍結中の非メモ操作（changeItemUnitPrice）は従来どおり BusinessRuleViolationError」を固定。
- 実装: 既存テスト `Estimate.test.ts`（「改訂元（凍結）には明細操作…ができない」）が同一フィクスチャで既にカバー済みのため重複追加せず、代わりに #388 固有の「メモ更新で金額（finalTotal）が変化しない」テストを追加した。
- 理由: TDD の「観測可能な振る舞いを重複検証しない」原則。メモ経路が再計算を起こさない契約（ADR-0028 非該当）を固定する方が有益。

## ② Step 5/6: 計画に明記されていないユニットテストを追加

- 計画: Step 5（LineTable）・Step 6（フォーム配線）にユニットテストファイルの明示なし（検証は Step 7 E2E に委譲する構成）。
- 実装: `components/LineTable.test.tsx`（メモ列の read-only 表示＝バグ修正／編集モードの onChangeMemo 発火）と `VariationPanel.test.tsx` への追記（改訂元で「メモを編集」が出て「内容を編集」が出ない／フォーム切替）を TDD で追加した。
- 理由: いずれも観測可能な振る舞いで TDD の vertical slice に適する。E2E より速く回帰を捕捉できる。

## ③ Step 5: セット群ヘッダのメモを read-only 表示した

- 計画: 「セット群ヘッダ自身のメモは対象外」（編集対象外）。
- 実装: 編集対象からは除外（read-only のまま）しつつ、メモ列に群自身のメモを read-only 表示した。
- 理由: 「対象外」は編集対象外の意図と解釈。メモ未表示バグ解消の一貫性として群メモも表示する方が自然で、編集はさせない（スコープは保持）。

## ④ Step 7: E2E は当初自動実行を見送り → 後に実行し全緑

- 計画: 既存 C7 E2E を拡張し検証。
- 実装: 追加コミット時点ではこの worktree で `next dev` が稼働し `.next/dev/lock` と dev DB を占有していたため自動実行を見送った（dev サーバ停止は破壊的なため）。その後ユーザーが dev サーバを停止・`.next` を削除したのを受けて estimate 系 E2E を実行し、**49/49 全緑**を確認済み（#388 追加分の改訂元メモ編集 2 件を含む）。
- 影響/対応: 解消。ユニット/統合（1231 件）も全緑。

## ⑤ 編集・複製可否ゲートの既存 E2E をフィクスチャ差し替えで更新

- 計画: 明示なし（containsRevisedLine 全廃は Step 4 の範囲）。
- 実装: containsRevisedLine 全廃（revisionRole 化）により、既存 E2E 3 件（variation-edit／variation-create／duplicate）が依存していた人工シード N9905001（系譜なしの改訂価格行）では新ロジックで NONE＝編集・複製可となり失敗した。系譜付き N9905004（seed が reviseForCustomer 実行済み・V1=改訂元/V2=改訂先）へ差し替え、改訂先（TARGET）で編集・複製不可を検証するよう更新した。
- 理由: 実データでは revisedDeliveryPrice は reviseForCustomer が系譜と同時に付与するため「改訂価格行を持つ」⟺「系譜を持つ改訂先」。N9905001 の改訂価格行は本番で発生しない人工状態であり、実プロダクトの挙動変化はない（テストフィクスチャの差し替えのみ）。最終強制はドメインで不変。
