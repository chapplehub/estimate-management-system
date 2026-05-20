# Issue #274 実装の逸脱記録

計画（`plan.md`）および設計書（`docs/business/estimate/システム設計書(見積).md`）からの逸脱を記録する。

## 1. 作成者FKの参照先を User → Employee に置換

- **元の計画/設計**: 設計書 §11.4 では `Order.createdBy` / `OrderConfirmation.confirmedBy` / `OrderCancellation.cancelledBy` はいずれも `User` を参照していた。
- **実際の実装**: 3つとも `Employee` を参照するよう変更した。これに伴い `Employee` に逆リレーション `createdOrders` / `confirmedOrders` / `cancelledOrders` を追加した。
- **逸脱の理由**: #272 で `Estimate.createdBy` を `Employee` 参照に変更済みであり、業務エンティティは認証ユーザー(`User`, better-auth)を直接参照しない方針で統一されている。また §9 の部署権限チェックで `departmentId` を辿る必要があり、`Employee` 参照が必須。着手時にユーザー確認のうえ決定。

## 2. 業務日時カラムを createdAt に集約

- **元の計画/設計**: 設計書 §11.4 では `Order.orderDate` / `OrderConfirmation.confirmedAt` / `OrderCancellation.cancelledAt` を業務日時として個別に保持していた。
- **実際の実装**: これら3カラムを設けず、各テーブルの `createdAt` に集約した。納期 `OrderConfirmation.deliveryDate` は保持。
- **逸脱の理由**: イベントテーブル（確定/取消）の行は挿入と同時に確定し、`createdAt` が状態発生時刻そのものになる。業務日時を別カラムにすると同一トランザクション挿入で `createdAt` と冗長になりNULL排除/最小スキーマ方針に反する。`deliveryDate` は挿入時刻と無関係な未来日のため独立カラムで保持。着手時にユーザー確認のうえ決定。

## 3. 金額/数値の手書き CHECK 制約は追記なし

- **元の計画/Issueタスク**: Issue 実装タスクに「マイグレーション SQL に金額/数値の手書き CHECK 制約を追記する」が含まれていた。
- **実際の実装**: CHECK 制約を一切追記しなかった。
- **逸脱の理由**: 受注系・系譜の5モデルは金額/数量などの数値カラムを一切持たない（受注明細・金額は `EstimateVariation → EstimateItem` を辿って得る設計, §4.2）。CHECK の対象が存在しないため該当なし。Issue タスク項目は #272 からの定型的な引き継ぎであり、本 Issue には適用対象がないと判断（着手時にユーザー確認済み）。

## 4. 逆リレーション追加コミットを独立させず各モデル追加コミットに統合

- **元の計画**: `plan.md` の実装ステップでは「ステップ3: 逆リレーション追加」を独立コミットとしていた。
- **実際の実装**: 逆リレーションを各モデル追加コミットに分散させた（受注系3モデル＋Employee逆参照＋EstimateVariation.order を1コミット、系譜2モデル＋EstimateVariation の copy/revision 逆参照を1コミット）。
- **逸脱の理由**: Prisma はリレーションの双方向定義を必須とするため、片側のモデルだけを追加したコミットでは `prisma validate` が失敗する。各コミットを独立して valid に保つため、逆リレーションを対応するモデル追加コミットに含めた。

## 5. 全イベント/交差テーブルに updatedAt を付与

- **元の計画/設計**: 設計書 §11.4 / §11.2.1 の概念 Prisma では `OrderConfirmation` / `OrderCancellation` / `EstimateVariationCopy` / `EstimateVariationRevision` に `createdAt` のみを記載（`updatedAt` なし）。
- **実際の実装**: 4テーブルすべてに `updatedAt @updatedAt` を付与した。
- **逸脱の理由**: 既存リポジトリの全モデル（join テーブル含む）が `createdAt` + `updatedAt` を持つ慣習に揃えた。設計書の表記は概念上のものであり、実装規約（既存スキーマの一貫性）が優先される（§11 冒頭注記）。
