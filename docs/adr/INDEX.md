# ADR Index

## 運用

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0000](0000-adr-management-policy.md) | ADRの管理運用方針 | 採用 | 2026-04-03 |

## ドメイン（承認フロー）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0001](0001-shared-application-table.md) | 申請テーブルを見積・価格で共通化する | 採用 | 2026-03-30 |
| [0002](0002-pre-generate-approval-steps.md) | 承認ステップを申請時に全ステップ事前生成する | 採用 | 2026-03-30 |
| [0003](0003-always-require-superior-approval.md) | 高位役職者の申請でも常に上位役割に承認を求める | 採用 | 2026-03-30 |
| [0004](0004-consumables-skip-approval.md) | 消耗品のみの見積は金額に関係なく承認不要とする | 採用 | 2026-03-30 |
| [0005](0005-restart-approval-after-rejection.md) | 差戻後の再申請は承認フローを最初からやり直す | 採用 | 2026-03-30 |

## インフラストラクチャ（データベース・ID）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0009](0009-migrate-id-generation-from-cuid2-to-uuidv7.md) | ID生成方式をCUID2からUUIDv7に移行する | 採用 | 2026-04-04 |
| [0010](0010-migrate-datetime-to-timestamptz.md) | 全テーブルのDateTimeカラムをtimestamptzに移行する | 採用 | 2026-04-04 |

## アプリケーション（フロントエンド・認可）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0006](0006-admin-route-protection-in-proxy.md) | 管理者専用ルートの認可チェックをproxy.tsで行う | 採用 | 2026-03-26 |
| [0007](0007-use-sync-external-store-for-hydration-mismatch.md) | useSyncExternalStoreによるハイドレーションミスマッチの防止 | 採用 | 2026-03-26 |
| [0008](0008-position-filter-uses-id-not-cd.md) | 役割一覧の役職フィルタにpositionId（ID）を使用する | 採用 | 2026-04-03 |
