# Issue #633 / PR #634: 自動レビュー ラウンド 1 修正計画

`/auto-review-fix` ラウンド 1 の judge 評価で採用された指摘の修正計画。

## 対象

### R1-1 ［① correctness bug / severity 参考: High］

- **file:line**:
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts:170,180`
  - 契約側: `src/app/_components/shared/SelectionModal.tsx:88-102`
- **問題**:
  `handleProductSelect` が非業務例外（`callReadAction` の `undefined`）で中断するとき素の `return;`（= `undefined`）で抜けるが、`SelectionModal.handleConfirm` は `onConfirm` の戻り値が falsy なら「確定成功」とみなして `handleClose()` を呼ぶ（ADR-20260716-r4d）。結果、DB 障害・ネットワーク断で確定が失敗すると **モーダルが閉じて `data` / `rowSelection` / `hasSearched` がリセットされる**。
  PR 前は裸 await だったため例外が `handleConfirm` を貫通し `handleClose()` に到達せず、モーダルは開いたままだった。本 PR で例外を `undefined` に変換した結果、**toast を得た引き換えにリトライ用の state を失う**退行が新規に生じている。ADR-20260723-h7r 決定 4「操作中断・state 凍結（画面 state に一切触らない・ダイアログは開いたまま）」に反する。
- **修正方針**:
  `SelectionModal` の `onConfirm` 契約に **「閉じない・メッセージも出さない」中断 sentinel** を加算的に足す。
  1. `SelectionModal` から `SELECTION_ABORTED`（`Symbol`）と型 `SelectionAborted` を export し、`onConfirm` の戻り値型を `void | SelectionRejection | SelectionAborted` に拡張する。
  2. `handleConfirm` で `result === SELECTION_ABORTED` を **`setRejection` 分岐より前** に判定して early return する（画面 state に一切触らない。`isConfirming` は既存 `finally` が戻す）。
  3. `handleProductSelect` の中断 2 箇所（取得失敗・価格解決失敗）で `SELECTION_ABORTED` を返す。
  4. `prepared` の集約段階で **`undefined`（非業務例外 → 中断）と `null`（業務: 商品の並行削除 → 従来の no-op）を区別**する。両者を同一視すると、業務 `null` 経路まで「閉じない」に変わり #622（並行削除時の表示設計）の判断を巻き込む。
- **設計判断とその理由**:
  - **sentinel に `Symbol` を採る**: `SelectionRejection`（`{ message, invalidIds }`）に判別子 `kind` を足す破壊的変更を避けつつ、`===` 比較で TypeScript の narrowing が効くため。文字列リテラルと違い他の戻り値と偶然衝突しない。
  - **`SelectionRejection` に汎用文言を詰める案は採らない**: モーダル内の `rejection` バナーと `callReadAction` の toast が二重表示になり、ADR-20260723-h7r 決定 3（通知は toast 1 枚に集約・UI に技術詳細を出さない）に反するため。中断 sentinel が `message` を持たないことで両立させる。
  - **加算的な契約拡張とする**: ADR-20260716-r4d の既存 2 状態（`undefined` = 成功で閉じる / `SelectionRejection` = 閉じずに理由 + 行ハイライト）は不変のまま保たれ、同 ADR が根拠に挙げた「既存呼び出し元 7 箇所の無改修」も維持される。
- **影響範囲**:
  - `SelectionModal.tsx`（契約の拡張・`handleConfirm` の分岐追加）
  - `useVariationLineEditor.ts`（`handleProductSelect` の戻り値型と中断 2 箇所）
  - 他 6 コンポーネントの `onConfirm` は `void` を返すままで無改修（union に選択肢が増えるだけ）。
  - `confirmSuggestions` / `requestSuggestions` は `SelectionModal` を経由しない（`ProductSuggestDialog` は戻り値で閉じない設計）ため現状維持。
- **想定テスト**:
  - `SelectionModal.test.tsx` に「`onConfirm` が `SELECTION_ABORTED` を返したらモーダルを閉じず、検索結果・選択状態・`hasSearched` を保つ」ケースを追加する。
  - 既存の「`undefined` で閉じる」「`SelectionRejection` で閉じず理由表示」ケースが緑のままであることで、契約拡張が加算的であることを担保する。

## ドキュメント更新

契約の変更にあたるため、両 ADR に追記する（新規 ADR は起こさない。既存決定の細目追加であり、決定そのものは覆っていないため）。

- `docs/adr/20260716-r4d-selection-modal-confirm-veto-by-return-value.md`: 第 3 の戻り値 `SELECTION_ABORTED` を影響に追記。
- `docs/adr/20260723-h7r-read-action-raw-return-client-wrapper-over-result-envelope.md`: 決定 4 の細目として「`SelectionModal` 経由の呼び出しは中断を sentinel で表現する」を追記。

## 却下・残課題

このラウンドの生レビューは 1 件のみで、それを採用したため④残課題はなし。
