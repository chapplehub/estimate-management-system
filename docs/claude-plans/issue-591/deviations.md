# Issue #591 実装の計画からの逸脱記録

計画（`enrich-dev-seed-data.md`）に対し、実装中に計画と異なる対応をした点を記録する
（CLAUDE.md「Record deviations from plan」）。

## 1. seed-dev.ts の削除順序を申請・免除・販売単価テーブルまで拡張（Step 1〜3）

- **元の計画**: Step 1〜3 は役割・従業員・商品・ドラフトの追加が対象で、既存削除ブロックの
  変更は明記していなかった。
- **実際の実装**: `main()` の削除ブロックに、見積申請系（`estimateStepApproval` /
  `estimateStepRejection` / `estimateApprovalStep` / `estimateApplicationWithdrawal` /
  `estimateApprovalExemption` / `estimateApplication`）と得意先別/納品先別販売単価
  （`customerSellingPrice` / `deliveryLocationSellingPrice`）の `deleteMany` を、
  見積・共通販売単価より前に追加した。
- **逸脱の理由**: 既存 dev DB に申請行が残っていると `estimate.deleteMany()` が FK 制約
  （`estimate_applications_variation_id_fkey`）で失敗する。#591 で dev が申請・免除・価格上書きを
  持つようになったため、再シードの冪等性を保つには削除順序の拡張が必須だった。seed-e2e.ts の
  削除順序に合わせた。

## 2. Step 2 の商品・価格を seed-dev-data/products.ts へ切り出し

- **元の計画**: Step 2 は「`prisma/seed-dev.ts` 内マスタ（肥大するようなら
  `prisma/seed-dev-data/products.ts` へ切り出し）」と条件付きで切り出しを許容していた。
- **実際の実装**: 商品 48 件＋価格＋上書きは分量が大きく、`seed-dev-data/products.ts` へ切り出した。
- **逸脱の理由**: 計画が明示的に許容した条件（肥大時の切り出し）に該当。ドラフト（estimates.ts）・
  申請（applications.ts）と同じ `seed-dev-data/` 配下に揃え、dev 専用フィクスチャの所在を一元化した。

## 3. 完了メッセージから旧共有 seed の見積件数表示を削除（Step 5）

- **元の計画**: Step 5 は import・呼び出しの除去とコメント書き換えのみを記載。
- **実際の実装**: 依存切断に伴い、`Created ${estimateCount} estimates`（seedEstimates 由来）の
  ログ行も削除した。
- **逸脱の理由**: 呼び出し自体を除去したため、当該件数表示は成立しない。Step 6 で dev 専用の
  ドラフト件数・申請件数・番号帯・アカウント一覧に置き換えた。
