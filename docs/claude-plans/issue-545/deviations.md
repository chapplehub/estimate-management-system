# Issue #545 実装の逸脱記録

## 1. スコープ外のインフラ層改修（リポジトリの差分sync化 + delete追加 + interfaceへのdelete追加）

### 元の計画 / Issue 文言

Issue #545 の「含む」スコープは以下の3点のみを挙げていた:

> - ドメイン編集操作（`editPeriod` / `endDatePeriod` / `deletePeriod` / `currentValidPeriod`）
> - application/commands（Register / Edit / Revise / EndDate / Delete + 共有ヘルパ）
> - application/factories（DI・pricingQueryFactory への配線含む）

インフラ層（`PrismaDeliveryLocationSellingPriceRepository` / `DeliveryLocationSellingPriceRepository`
インターフェース）の改修は Issue 本文に一切記載がなかった。

### 実際の実装

以下のインフラ層改修を本 Issue に追加した（計画時にユーザー承認済み）:

- **リポジトリ interface**: `delete(aggregate, expectedVersion): Promise<void>` を追加。
  `update` の doc を append-only → 差分 sync 前提へ更新。
- **Prisma 実装**: `update` の期間行同期を `appendPeriodRows`（追記専用）から `syncPeriodRows`
  （差分 upsert + 集約から消えた id の削除）へ切替。`delete` を親 version 条件付き `deleteMany` +
  `assertVersionBumped` で実装。`PERIOD_TABLE` を static 定数化し、insert 専用の append `writePeriods`
  と行変換 `toWriteRows` を分離。クラス doc を差分 sync 前提へ改稿。
- **リポジトリテスト**: 差分 sync（将来行の in-place 編集反映・消えた行の削除・最終行削除で0件の空配列
  バインド）、`delete` の cascade / 古い version での ConflictError / delete 後の再 insert 成功、を追加。

### 逸脱の理由

調査の結果、既存の `PrismaDeliveryLocationSellingPriceRepository` は **追記専用実装**
（`appendPeriodRows` / `ON CONFLICT (id) DO NOTHING`）だった。これは過去に納品先別集約の変更操作が
`addPeriod`（追加）のみで、子が id 単位で内容不変だった前提に基づく。

本 Issue で追加する `editPeriod`（将来行の内容差し替え）・`endDatePeriod`（終了日書き換え）・
`deletePeriod`（行削除）は、いずれも**既存行の in-place 更新・削除**を伴う。追記専用のままでは:

- `editPeriod` / `endDatePeriod`: 既存 id の値変更が `DO NOTHING` で握り潰され、**黙って永続化されない**
- `deletePeriod`: 集約から消えた行が DB に残り続け、**削除が反映されない**
- 最終行削除（空集約）: 親行を掃除する `delete` メソッド自体が存在しない（空シェルが残る）

したがってインフラ層の改修は、本 Issue が「含む」とした書き込みコマンドを**実際に機能させるための必須作業**
であり、これ無しでは commands / factories が完成しても書き込みが成立しない。共通ヘルパ
`sellingPricePeriodPersistence` には差分同期版 `syncPeriodRows` が既に存在し得意先別 #505 が使用中の
ため、ヘルパ自体の改修は不要で、納品先別リポジトリの呼び先を切り替えるだけで足りた。

計画作成時にこの隠れた必須作業をユーザーへ提示し、本 Issue に含める承認を得た。
