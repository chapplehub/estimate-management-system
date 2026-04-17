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
| [0019](0019-add-varchar-and-check-constraints.md) | Stringカラムに@db.VarChar(N)、数値カラムにCHECK制約を追加する | 採用 | 2026-04-15 |

## アプリケーション（フロントエンド・認可）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0006](0006-admin-route-protection-in-proxy.md) | 管理者専用ルートの認可チェックをproxy.tsで行う | 採用 | 2026-03-26 |
| [0007](0007-use-sync-external-store-for-hydration-mismatch.md) | useSyncExternalStoreによるハイドレーションミスマッチの防止 | 採用 | 2026-03-26 |
| [0008](0008-position-filter-uses-id-not-cd.md) | 役割一覧の役職フィルタにpositionId（ID）を使用する | 採用 | 2026-04-03 |
| [0014](0014-modal-search-form-as-separate-component.md) | モーダル用検索フォームを既存SearchFormとは別コンポーネントにする | 採用 | 2026-04-13 |
| [0015](0015-selection-modal-self-contained-state.md) | SelectionModalが内部でデータ・選択状態を一括管理する | 採用 | 2026-04-13 |
| [0016](0016-exclude-filtering-on-client-side.md) | 選択モーダルの除外フィルタリングをクライアント側で行う | 採用 | 2026-04-13 |

## ドメイン（設計パターン）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0011](0011-domain-service-design-pattern-by-responsibility.md) | Domain Serviceの設計パターンを責務の性質で使い分ける | 採用 | 2026-04-08 |
| [0018](0018-separate-activate-deactivate-commands.md) | エンティティの有効/無効切り替えを専用コマンドで実装する | 採用 | 2026-04-14 |

## アプリケーション（クエリ・DTO）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0013](0013-list-dto-includes-related-names.md) | 一覧画面の DTO にリレーション先の名前を含める | 採用 | 2026-04-10 |

## テスト基盤

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0012](0012-e2e-test-db-separation-strategy.md) | E2Eテスト専用DB環境の構築方針 | 採用 | 2026-04-09 |
| [0017](0017-e2e-table-cell-selector-strategy.md) | E2Eテストのテーブルセル特定にヘッダー名ベースを使用する | 採用 | 2026-04-14 |
| [0020](0020-e2e-test-composition-and-execution-strategy.md) | E2Eテストの構成・実行戦略 | 採用 | 2026-04-17 |
