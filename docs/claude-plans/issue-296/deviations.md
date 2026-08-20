# Issue #296 計画からの逸脱記録

実装計画（revise-for-customer-domain-and-command.md）からの逸脱を記録する。

## 1. 改訂系譜の読み込み側写像を Step 5 から Step 1 へ前倒し

- **元の計画**: Step 5（インフラ）で「読み込み: revisionTarget → revisedFrom 写像」を実装
- **実際の実装**: Step 1 のコミットに EstimateMapper の include 追加と読み込み写像を含めた
- **逸脱の理由**: `EstimateVariation.reconstruct` に必須フィールド `revisedFrom` を追加した時点で
  マッパーがコンパイル不能になる（型カスケード）。`revisedFrom: null` の仮埋めで Step 5 まで
  先送りする案は、Step 5 を忘れた場合にサイレントなデータ欠落バグになるため、正しい写像を
  即時実装した。書き込み側（系譜行の upsert）は計画どおり Step 5 で実装

## 2. repository.delete() の改訂系譜先行削除（計画外の追加）

- **元の計画**: インフラ改修は「mapper の読み書き＋update の系譜 upsert」のみ
- **実際の実装**: `delete()` を「改訂系譜を先に明示削除 → estimate 削除」のトランザクションに変更
- **逸脱の理由**: テストで「改訂を含む見積の削除」が FK 違反
  （`estimate_variation_revisions_source_variation_id_fkey`）で失敗することが判明した。
  `sourceVariation` 側の FK は onDelete 未指定（Prisma デフォルト = Restrict）のため、
  カスケード削除の順序によっては revisedVariation 側の Cascade より先に source 行の削除が
  検査され違反になる。改訂系譜は両端とも同一見積内を指す（ADR-0044）ため、見積削除時に
  系譜ごと消えるのが正しく、リポジトリで順序を保証した。スキーマ変更（onDelete: Cascade 付与）
  は本イシューのスコープ外とし行わなかった
