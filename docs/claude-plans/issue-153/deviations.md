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

## 4. `/auto-review-fix` ラウンド 1 で差分外の 2 ファイルを修正

- **計画**: Step 1〜4 の対象ファイルに `src/app/(features)/layout.tsx` と `src/shared/constants/redirect-reasons.ts` は含まれない
- **実装**: `/auto-review-fix`（`/code-review medium` → judge）の指摘 R1-7 を受け、この 2 ファイルのコメントを修正した（`layout.tsx` の「認可は効くのに」→「認証は効くのに」、`redirect-reasons.ts` の設定元・読み取り先を実在の名に）
- **理由**: 本 PR が proxy から認可を外した結果、この 2 ファイルのコメントが事実と食い違うようになった（proxy が持つのは認証のみになり、`FORBIDDEN` の設定元は `verifyAdmin()` へ移った）。上記 §2 で `employees-crud.e2e.ts` を「実在しない定数を指す記述を残さない」ために修正したのと同型の齟齬であり、この 2 件だけ残す整合性が無い。#636 の学び「diff に現れないファイルが静かに古くなる」の適用範囲を揃えた。修正はコメントのみで挙動不変（実コードの変更は `src/proxy.ts` の `publicRoutes` の行移動のみで内容は同一）。
- **併せて対応**: 同ラウンドの R1-1〜R1-5（`verifyAuthentication.ts` の旧「proxy 権威型」前提の記述、`products-crud.e2e.ts` の実在しないパス、`proxy.ts` の JSDoc の付け先）。詳細は `r1-fix-plan.md`
- **対応せず残した課題**: R1-6 — 「一般ユーザーが submit → Server Action の `verifyAdmin()` が拒否」を検証する唯一の E2E が消えた（Step 3 が消失を織り込み済みで計画準拠）。ページ側で描画前に弾かれる以上 UI 経由での維持は原理的に不可能で、代替手段の導入は設計判断を伴うため別 Issue とする
