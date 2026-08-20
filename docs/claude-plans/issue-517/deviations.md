# Issue #517: 計画からの逸脱記録

## 対象ファイルの追加（12 → 14ファイル）

- **元の計画内容**: 衝突しうる対象は「6名×12ファイルのみ」と断定し、pricing のコマンドテスト10ファイル + 編集読みモデルテスト2ファイルを修正対象とした。
- **実際の実装内容**: develop（#516 マージ後）の取り込み後、`PrismaCommonSellingPriceListQueryService.test.ts` と `PrismaCostPriceListQueryService.test.ts` の一覧読みモデルテストペアでも同一の name unique 制約違反が非決定的に発生することを確認し、追加で修正した（計14ファイル）。修正方式は `makeProduct` ヘルパー内で name に code を接尾する形（計画の「code 連動でファイル固有化」方針と同一）。
- **逸脱の理由**: 計画時の重複抽出スクリプトが `new ProductName("リテラル")` 直書きのみを正規表現で拾っており、`makeProduct(code, name)` のようにヘルパー引数経由で名前を渡すパターンを見逃していた。「12ファイルのみ」という断定はスキャン手法の限界を含んでいた。#516 が `PrismaCostPriceListQueryService.test.ts` にテストを追加したことで実行時間が延び、既存ペアの衝突が顕在化した（衝突自体はマージ前から潜在）。
