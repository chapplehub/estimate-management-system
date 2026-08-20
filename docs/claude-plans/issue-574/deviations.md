# Issue #574 実装計画からの逸脱記録

## 1. 整形ヘルパの共有化先ディレクトリ

- **元の計画**: 共有位置を「`estimate-applications/_lib/labels.ts` 等（詳細と一覧の共通親）」と例示。
- **実際の実装**: `src/app/(features)/estimate-applications/_shared/labels.ts` に移設。
- **逸脱の理由**: 計画は「等」で正確な位置を未確定にしていた。既存リポジトリに機能ローカルな共有ヘルパの
  イディオムとして `estimates/_shared/`（例: `setComponentExpansion.ts`）が存在するため、`_lib` ではなく
  `_shared` サブフォルダに揃えた。global な `@/app/_lib` へは昇格せず、見積申請機能に閉じる方針は計画通り。

## 2. 承認ステップ状態バッジの tone 割り当て（計画の空白を補完）

- **元の計画**: Step 1 で「`ApprovalStepStatus` の全 code → tone をテスト化」と方針のみ規定し、各値の tone は未明示。
- **実際の実装**: `NOT_STARTED=neutral / AWAITING=info / APPROVED=success / REJECTED=warning`。
- **逸脱の理由**: 計画未確定の配色を、申請状態バッジ（`PENDING=info / APPROVED=success / REJECTED=warning /
  WITHDRAWN=neutral`）およびバリエーション申請状態の既存 `badgeToneOf` と同じ色語彙で整合させた
  （「緑=承認済・琥珀=差戻・青=進行中・灰=不活性」の共通語彙）。新規判断ではなく既存語彙への追従。
