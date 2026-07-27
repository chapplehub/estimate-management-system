# Issue #153 実装計画からの逸脱

## 1. 新規 ADR の ID 日付

- **計画**: `docs/adr/20260728-{sss}-{slug}.md`
- **実装**: `docs/adr/20260727-gk3-authorization-at-execution-boundaries.md`
- **理由**: 計画策定時に翌日着手を見込んで `20260728` と書いていたが、実際の起票日が 2026-07-27 だったため。ADR-0000 は ID の日付部を起票日と定めており、実日付を優先した。同日の既存 ADR（`20260727-2fb`）とはサフィックスが異なるため衝突はない。

## 2. `employees-crud.e2e.ts` のコメント修正を Step 3 に追加

- **計画**: Step 3 の対象ファイルは `src/proxy.ts` と `products-crud.e2e.ts` の 2 件
- **実装**: `src/app/(features)/employees/employees-crud.e2e.ts` のコメント 1 行を併せて修正した
- **理由**: 当該コメントが `src/proxy.ts の adminRoutes` を管理者専用の根拠として明示していた。`adminRoutes` を削除する同じコミットで直さないと、実在しない定数を指す記述が残る。テストコードの変更はなく、根拠の参照先を `ページ本体の verifyAdmin()` に差し替えただけ。

## 3. Step 3 の E2E 実行範囲

- **計画**: 「変更に関係するスペックのみ実行する」
- **実装**: `products` / `employees` / `departments` / `roles` / `customers` の 5 spec（76 件）を実行
- **理由**: 逸脱ではなく解釈の記録。`adminRoutes` の削除は 3 ルート（`employees/new`・`departments/new`・`roles/new`）の防壁を差し替えるため、`products` だけでは実効を確認できない。`customers` は `customers/new` に `verifySession()` を足した影響（一般ユーザーの作成が通ること）の確認として含めた。
