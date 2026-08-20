# Issue #502 実装の計画からの逸脱記録

計画: `cost-price-domain-ops-and-commands.md`

## 逸脱1: 原価リポジトリ `update` の差分sync化（計画外の必須作業）

- **元の計画**: スコープはドメイン保守操作・5コマンド・factories のみ。リポジトリは「共通売単価と同型」
  を前提に変更対象に含めていなかった（「seed は生 Prisma、Mapper は reconstruct 経由のため無影響」とのみ記載）。
- **実際の実装**: `PrismaCostPriceRepository.update` を append-only（`ON CONFLICT (id) DO NOTHING` /
  `appendPeriodRows`）から差分 sync（`syncPeriodRows`）へ切り替えた。あわせて共通売単価リポジトリテストの
  差分sync検証3件（編集 in-place 永続化・削除の永続化・空集約 delete）をミラーした。
  （コミット `feat: 原価リポジトリのupdateを差分sync化`）
- **逸脱の理由**: 原価リポジトリは periods が不変（`addPeriod` のみ）だった**読み系実装時点（#511）の
  append-only 形**のまま port されていた。ドメインに `editPeriod`/`endDatePeriod`/`deletePeriod` を
  追加しても、リポジトリが既存行のミューテート・削除を永続化しないため、編集・適用終了・削除コマンドが
  実際には機能しなかった（Edit コマンドの統合テストが「改定後の再読込で単価が変わらない」で赤になり発覚）。
  共通売単価リポジトリは既に `syncPeriodRows` 対応済みで、**完全同型（ADR-20260627-a5c）にするための
  機械的な穴埋め**にすぎない。原価固有の非同型な業務ルールではないため、単価改定切り出しの保険は不発動。

## 逸脱2: develop（#519 / #516）の実装途中マージ

- **元の計画**: 想定なし。
- **実際の実装**: Step 2 完了時点で pre-commit（全体テスト）が `ReviseCommon/CustomerSellingPricePeriodCommand`
  の `ProductName` unique 制約衝突で赤になりコミットが阻止された。原因は #519（テストの ProductName 重複・
  並列実行での非決定的失敗）が develop にマージ済みで未取り込みだったこと。develop を取り込んで解消した
  （マージコミット + Step1/2 作業の stash→pop で再適用）。#516（原価一覧画面）も同時に取り込まれた。
- **逸脱の理由**: フレークの根治が develop 側にあり、取り込まないと以降のコマンド統合テストが全て
  pre-commit で阻止されるため。マージ後、#519 が新規追加した原価テストの `addPeriod` 呼び出し2箇所へも
  参照日ガード対応（referenceDate 付与）を機械追加した。

## 逸脱3: Step 1・Step 2 のコミット統合

- **元の計画**: Step 1（addPeriod 参照日ガード）と Step 2（保守操作）を別コミットにする。
- **実際の実装**: ドメイン層の書き込み機能として1コミットに統合した。
- **逸脱の理由**: 逸脱2の develop 取り込みで Step1/2 の作業を stash→merge→pop した結果、`CostPrice.ts` の
  差分が単一ハンク（クラス本体の連続領域）に融合し、安全なハンク分割（壊れない中間コミットの再現）が
  不能になったため。意味的まとまり（集約の write 機能）として1コミットにする方が履歴として健全と判断。

## 逸脱なしの確認

- Step 5（単価改定）が計画上の「保険発動点」だったが、原価固有の非同型な業務ルールは1つも現れず、
  共通売単価との完全同型を保ったまま完遂した。単価改定 + `currentValidPeriod` の別 issue 切り出しは不要。
