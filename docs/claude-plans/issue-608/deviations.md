# Issue #608 実装の計画からの逸脱記録

## 1. `codes` を `readonly string[]` ではなく可変 `string[]` にした（Step 1）

- **元の計画**: `defineTestCodes` の派生索引 `codes` を全コード配列として提供（不変性は明記せず）。
- **実際の実装**: `codes` の型を `readonly string[]` ではなく可変 `string[]` にした。
- **理由**: 消費側は `where: { roleCd: { in: TEST_ROLE_CDS } }` の形で Prisma に渡す。Prisma の
  `in` は可変 `string[]` を要求し、`readonly string[]` は代入不可（TS2322）。全消費者に `[...codes]`
  のスプレッドを強いると差分が増えるため、派生索引側を可変で返す。テストヘルパー用途であり、
  配列を破壊的操作する消費者は存在しない前提。

## 2. Step 3 に isSoleMember を加えて衝突集合3ファイルを一括移行した

- **元の計画**: Step 3 は衝突2ファイル（`UpdateRoleCommand.test.ts` /
  `PrismaEmployeeQueryService.roleNames.test.ts`）のみを移行。
- **実際の実装**: `PrismaRoleQueryService.isSoleMember.test.ts` も Step 3 に含め、3ファイルを一括移行。
- **理由**: 実害の衝突は2組ある——`ROLE971-973`（UpdateRoleCommand × roleNames）と
  `EMP990710-711`（roleNames × isSoleMember）。後者を消すには isSoleMember の移行が必須で、
  これを Step 4 に残すと「実害の解消」を謳う Step 3 のコミット時点で EMP 衝突が残存する。
  衝突集合を1コミットで閉じるため前倒しした。isSoleMember の残りの移行作業は Step 4 から除外。
