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
| [0021](0021-use-check-constraints-not-create-domain.md) | 数値・文字列の制約にCREATE DOMAINを使わずCHECK制約を継続する | 採用 | 2026-05-20 |
| [0031](0031-aggregate-reconstitution-exception-via-single-file-eslint-override.md) | 集約再構築の例外経路をMapper限定のESLintオーバーライドで開ける | 採用 | 2026-06-02 |
| [0032](0032-identity-preserving-diff-upsert-for-multilevel-aggregate-update.md) | 多階層集約の更新はidentity保持の差分upsertを命令的トランザクションで行う | 採用 | 2026-06-02 |
| [0035](0035-numbering-concurrency-max-plus-one-unique-manual-retry.md) | 採番の同時並行一意性をMAX(sequence)+1 + unique制約 + 手動リトライで担保する | 採用 | 2026-06-06 |
| [0039](0039-cross-cutting-optimistic-locking-via-aggregate-root-version.md) | 楽観ロックは集約ルートの version 列＋フォーム往復＋リポジトリ insert/update 分割で横断適用する | 採用 | 2026-06-11 |
| [0041](0041-variation-copy-natural-key.md) | 見積複製系譜表のキーをサロゲートidではなく自然キー(copiedVariationId)にする | 採用 | 2026-06-11 |

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
| [0022](0022-money-pattern-for-domain-amounts.md) | ドメインの金額表現に Money パターン（整数最小単位 + Currency）を採用する | 採用 | 2026-05-23 |
| [0023](0023-domain-policies-directory-for-calculation-rules.md) | ドメイン計算規約は domain/policies/ の Policy クラスとして配置する | 採用 | 2026-05-23 |
| [0024](0024-fiscal-year-as-shared-value-object.md) | 年度 (FiscalYear) を独立 VO として shared/domain/values/ に配置する | 採用 | 2026-05-23 |
| [0025](0025-jst-fixed-pure-function-in-domain-layer.md) | ドメイン層での日時境界判定は JST 固定の純関数で行う | 採用 | 2026-05-23 |
| [0026](0026-numbering-value-object-exposes-parse-only.md) | 採番系の値オブジェクトは parse のみを公開し、払い出しはリポジトリ層に分離する | 採用 | 2026-05-23 |
| [0027](0027-aggregate-boundary-enforcement-by-barrel-and-eslint.md) | 集約境界をバレル + ESLint で構造的に強制する | 採用 | 2026-06-01 |
| [0028](0028-auto-recalculation-on-mutators-for-aggregated-totals.md) | 集計値を持つ集約は全 mutator で自動再計算を強制する | 採用 | 2026-06-01 |
| [0029](0029-domain-structural-invariants-vs-usecase-event-constraints.md) | ドメイン層は構造的不変条件のみ、業務イベント制約はユースケース層に置く | 採用 | 2026-06-01 |
| [0030](0030-pass-cross-cutting-context-via-method-arguments.md) | 集約内で横断的に必要なコンテキストは子に保持させず引数で渡す | 採用 | 2026-06-01 |
| [0033](0033-persist-aggregated-totals-and-skip-recalculation-on-reconstitution.md) | 集計値を永続化し、再構築時には再計算せず保存値から復元する | 採用 | 2026-06-02 |
| [0034](0034-memo-null-elimination-empty-value-null-object.md) | メモ任意項目を null ではなく空値 Null Object で表現する | 採用 | 2026-06-03 |
| [0036](0036-aggregate-creation-via-in-aggregate-factory.md) | 集約外からの新規集約生成は集約内ドメインファクトリ経由で行う | 採用 | 2026-06-06 |
| [0040](0040-duplication-genealogy-as-sibling-artifact-persisted-via-insert-with-copies.md) | 見積複製の系譜を集約外の兄弟成果物として扱い insertWithCopies でアトミック永続化する | 採用 | 2026-06-11 |
| [0042](0042-duplication-requires-at-least-one-variation.md) | 見積複製(C6)は最低1バリエーションの選択を要求する（§5.2 と §C1 の調停） | 採用 | 2026-06-11 |
| [0043](0043-flatten-company-subtype-inheritance-into-aggregate-tables.md) | 取引先は CTI（基底テーブル継承）を廃し、サブタイプ平坦化で「集約 = 1 テーブル」にする | 採用 | 2026-06-11 |
| [0044](0044-revision-genealogy-inside-aggregate-and-frozen-as-derived-state.md) | 改訂系譜は集約の内側に置き、凍結は系譜からの導出状態とする | 採用 | 2026-06-12 |
| [0045](0045-submission-type-as-immutable-variation-attribute.md) | 提出区分はバリエーション単位の不変保存属性とする | 採用 | 2026-06-12 |
| [0046](0046-revised-variation-rejects-bulk-replace-allow-granular-adjustment.md) | 改訂先バリエーションは C4 全置換を拒否し、調整は粒度別メソッドに限定する | 採用 | 2026-06-12 |
| [0047](0047-set-line-as-priced-leaf-table-plus-set-group-satellite.md) | 見積のセット商品明細を価格付き末端行1表＋セット群衛星＋所属交差表でモデル化する | 採用 | 2026-06-13 |
| [0048](0048-estimate-line-product-attributes-read-through-then-snapshot-on-commit.md) | 見積明細の商品由来属性（コード・区分）は編集中マスタ read-through・確定時スナップショット凍結とする | 採用（機構先送り） | 2026-06-15 |
| [0049](0049-header-setters-noop-on-equal-to-allow-deadline-department-edit-under-revision-freeze.md) | 見積ヘッダーのセッターを同値 no-op 化し、改訂凍結下でも締切日・部署の編集を成立させる | 採用 | 2026-06-15 |

## アプリケーション（コマンド）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0037](0037-application-command-result-union-for-predictable-outcomes.md) | アプリケーション層コマンドは予測可能な業務結果を判別共用体(Result)で返し、想定外のみ throw する | 置き換え済み（→ 0038） | 2026-06-09 |
| [0038](0038-unify-failures-as-exceptions-and-limit-unions-to-multiple-normal-outcomes.md) | 失敗はすべて例外に統一し、判別共用体は「複数の正常な結末」の戻り値設計に限定する | 採用 | 2026-06-10 |

## アプリケーション（クエリ・DTO）

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0013](0013-list-dto-includes-related-names.md) | 一覧画面の DTO にリレーション先の名前を含める | 採用 | 2026-04-10 |
| [0050](0050-list-representative-variation-selection-as-read-model-concern.md) | 見積一覧の代表バリエーションを「ACTIVE 優先の最小 → 全体の最小」で選び、read model に閉じる | 採用 | 2026-06-15 |

## テスト基盤

| # | タイトル | ステータス | 起票日 |
|---|---------|-----------|--------|
| [0012](0012-e2e-test-db-separation-strategy.md) | E2Eテスト専用DB環境の構築方針 | 採用 | 2026-04-09 |
| [0017](0017-e2e-table-cell-selector-strategy.md) | E2Eテストのテーブルセル特定にヘッダー名ベースを使用する | 採用 | 2026-04-14 |
| [0020](0020-e2e-test-composition-and-execution-strategy.md) | E2Eテストの構成・実行戦略 | 採用 | 2026-04-17 |
