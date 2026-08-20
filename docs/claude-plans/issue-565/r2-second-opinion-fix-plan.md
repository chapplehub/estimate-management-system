# Issue #565 セカンドオピニオン（Sonnet 再レビュー）修正計画

PR #570 の「🔁 セカンドオピニオン: Sonnet による再レビュー（深さ medium）」で新規検出された
`delete()` の EmployeeRole 子行未処理による FK 違反バグを対象とする。

調査の結果、報告は**実在するバグ**と確認済み（バケツ①correctness / severity 参考: High）。

## 調査結論（報告の裏取り）

| 検証項目 | 結果 |
|---|---|
| FK 制約 | `employee_roles_employee_id_fkey` は `ON DELETE RESTRICT ON UPDATE CASCADE`（`prisma/migrations/20260406071314_migrate_id_to_uuid/migration.sql:119`） |
| relationMode | `schema.prisma` 未指定 → デフォルト `foreignKeys` = DB 制約がそのまま有効 |
| 症状 | 担当役割を持つ従業員を素の `prisma.employee.delete` で削除すると `P2003`（FK 違反）でクラッシュ |
| 実害経路1 | `DeleteEmployeeCommand.ts:42` — 役割保有従業員の削除。seed（`seed.ts:1397`）で実在生成されるため本番相当データで即発火 |
| 実害経路2 | `CreateEmployeeCommand.ts:84` — 認証ユーザー作成失敗時のロールバック `delete()` も FK 違反で落ち、`ValidationError` が投げられず Employee + EmployeeRole が孤児化（ロールバック不全） |
| 既存テスト | `PrismaEmployeeRepository.test.ts:148` の delete テストは役割**なし**従業員のみ検証しており、本ケースをすり抜ける |

## 修正方針の選定: ON DELETE CASCADE（employee 辺のみ）

「`$transaction` + `deleteMany`」案と「`ON DELETE CASCADE`」案を比較し、**CASCADE を採用**する。

### 採用理由

1. **現状の RESTRICT は設計ではなく Prisma デフォルトの素通り**
   本リポジトリは子行を親と心中させる意図があるとき必ず `onDelete: Cascade` を明示している（`schema.prisma` に30箇所以上）。`EmployeeRole.employee` リレーション（`schema.prisma:79`）は `onDelete` 未記載のため、デフォルト `Restrict` が出力されただけ。意図的な業務ガードではない。

2. **この辺は「マスタ参照RESTRICT組」ではなく「集約所有CASCADE組」**
   `employee_roles` の FK は2本。
   - **→ Role 側**（`employee_roles_role_id_fkey`）: RESTRICT が正しい（使用中の Role を消させないマスタ保護）。**変更しない。**
   - **→ Employee 側**（`employee_roles_employee_id_fkey`）: Employee が集約ルート、EmployeeRole はその所有子（`update()` が子行を同期、DTO が `assignedRoleId` を保持）。従業員本体を消すなら担当割当も一緒に消えるのが自然 → CASCADE 相当。

3. **クラスとして閉じる**
   DB を単一の真実にすることで `DeleteEmployeeCommand` / `CreateEmployeeCommand` ロールバック / 将来の管理スクリプト・生 SQL 削除まで全経路が自動保護される。アプリ層 `deleteMany` 案はこのメソッドのみを直すためバグの種類が残る。方針「PostgreSQL ネイティブ機能優先」とも整合。

### 却下案（transaction + deleteMany）が勝つ条件
「従業員削除時であっても担当役割の解除は明示的・監査可能なドメイン操作として通したい（DB に黙って消させたくない）」という業務要件がある場合のみ。現状そのルールの痕跡はなく、`update()` が既に子行を無言で `deleteMany` しているため整合しない。→ 却下。

## 変更対象

| # | 対象 | 内容 |
|---|---|---|
| 1 | `prisma/schema.prisma:79` | `EmployeeRole.employee` リレーションに `onDelete: Cascade` を追加（`role` 辺は RESTRICT のまま） |
| 2 | マイグレーション新規1本 | `employee_roles_employee_id_fkey` を DROP → `ON DELETE CASCADE` で再作成。`role_id_fkey` は不変 |
| 3 | `PrismaEmployeeRepository.ts:82` `delete()` | 変更なし（1行の素の `delete` のまま。CASCADE が DB 側で子行を処理） |
| 4 | `PrismaEmployeeRepository.test.ts` | 回帰テスト追加（下記） |

## 想定テスト（回帰）

`PrismaEmployeeRepository.test.ts` の `describe("delete")` に追加:

- **役割保有従業員を削除できる**: `Employee.create(..., assignedRoleId)` で保存 → `insert` で EmployeeRole 子行が1件作られることを確認 → `repository.delete()` が例外なく成功 → `employee` 行が `null`、かつ該当 `employeeRole` 子行も0件（CASCADE で消えたこと）を確認。
- 既存の「役割なし従業員を削除できる」テストは緑のまま維持。

## 留意点

- マイグレーション適用後、`pnpm db:generate` で Prisma Client を再生成する。
- Role 側 FK を巻き込まないよう、マイグレーション SQL は `employee_roles_employee_id_fkey` のみを対象にする（`prisma migrate dev` の自動生成 diff が role 辺に触れていないことをレビューで確認）。
- テストクリーンアップ（`test.ts:26-30`）は現状「子行→従業員→役割」の順で手動削除しているが、CASCADE 化後も従業員削除で子行が消えるため矛盾はしない。既存クリーンアップは変更不要。
