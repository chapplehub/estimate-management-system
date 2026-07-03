# Issue #508: 実装計画からの逸脱記録

## 1. E2E スペックのコミット先を Step 4 に一本化

- **元の計画**: E2E スペックは Step 2 で書き、「Step 3・4 の green と同じコミットに含める」（両ステップに分けて含める含み）。
- **実際の実装**: スペックファイル全体を Step 4 のコミット（一覧画面）にのみ含めた。Step 3 のコミットは画面実装のみ。
- **逸脱の理由**: スペックは 1 ファイルであり、Step 3 時点で含めると一覧画面ケースが red のままコミットされる。「red なスペックを単独コミットすると `pnpm e2e` が壊れる」という計画自身の制約（コミット済みツリー常時 green）を優先し、全ケースが green になる Step 4 へ一本化した。Step 3 完了時点では未選択画面ケースの green を実行確認のみ行った。

## 2. クライアント wrapper（CustomerSellingPriceTable.tsx）の追加

- **元の計画**: Step 4 の対象ファイルは `[customerCd]/page.tsx`・`_components/columns.tsx`・検索フォーム配線のみ。
- **実際の実装**: `_components/CustomerSellingPriceTable.tsx`（"use client" の薄い wrapper）を追加し、カラム生成をクライアント境界の内側へ移した。
- **逸脱の理由**: 商品コードリンクが得意先コードを含むため、カラム定義が静的配列ではなく `createColumns(customerCode)` ファクトリになる。"use client" モジュールの関数を Server Component から呼ぶことは React Server Components の制約で不可（実行時エラー「Attempted to call createColumns() from the server」で発覚）。共通一覧（静的 `columns` 配列を client 参照として props に渡す）とは異なる構造が必要だった。

## 3. E2E シードの専用得意先コードを C902 に採番

- **元の計画**: 「1得意先に対し active／lapsed／none の3状態が揃う最小フィクスチャを追加」（得意先の具体は未指定）。
- **実際の実装**: 専用得意先 C902「E2E専用_得意先別単価テスト商事」を新設（PRD86x 帯とセット）。C901 は既存の削除テスト用（DB 不変前提）で使用済みだったため次番を採った。
- **逸脱の理由**: 逸脱というより計画の空欄の具体化。既存得意先（C001 等）への相乗りは見積系テストとの結合を生むため、E2E 専用帯（C9xx）の慣例に従い分離した。
