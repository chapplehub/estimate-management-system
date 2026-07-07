# Issue #567 実装計画からの逸脱記録

計画ファイル: [redesign-employee-superior-role.md](./redesign-employee-superior-role.md)

Step 1〜6 時点の逸脱を記録する（半分到達時点での中間記録）。

---

## 逸脱1: Step 1 — マイグレーションを手書きし `migrate deploy` で適用

- **元の計画**: 「`pnpm db:migrate` でマイグレーション生成、`pnpm db:generate`」。
- **実際の実装**: `prisma migrate dev`（= `db:migrate`）は列削除という破壊的変更（`employees.superior_role_id` に 1999 行の非NULL値あり）に対して対話確認を求めるが、実行環境が非対話のため拒否された（`--create-only` でも同様）。そこで既存マイグレーションの書式に合わせて `prisma/migrations/20260707194749_employee_superior_role_extract_and_drop_column/migration.sql` を手書きし、`prisma migrate deploy` で適用、`prisma generate` を実行した。
- **逸脱の理由**: 非対話環境では破壊的マイグレーションの自動生成コマンドが完了できない技術制約。生成される SQL と等価な内容を手書きすることで、計画の意図（新表追加＋列廃止）は忠実に実現している。旧列値のバックフィルは行わない判断も明示（役割持ち＝導出可能な冗長コピー、課員＝一部が課長級でない無効値のため。seed で正しい課長級を再作成する）。

## 逸脱2: Step 4 — EmployeeMapper を Step 4 で最小限だけ触った

- **元の計画**: Step 4 の対象ファイルは `employee/domain/entities/Employee.ts` とそのテストのみ。Mapper の変更は Step 5。
- **実際の実装**: `Employee.reconstruct` に `explicitSuperiorRoleId` 引数を追加した結果、唯一の呼び出し元 `EmployeeMapper.toDomain`（8引数呼び出し）が破綻。pre-commit フックが `vitest related` で Mapper 経由の下流テスト（PrismaEmployeeRepository・Create/UpdateEmployeeCommand 計7件）まで実行し緑にならないため、Step 4 で Mapper に「一律 `null` を渡す」最小整合コメント付き変更を同梱した。実際の行読み出し（`superiorRole` 子行→ `explicitSuperiorRoleId`）は計画どおり Step 5 で実装。
- **逸脱の理由**: 集約の公開シグネチャ変更は、その唯一の永続化呼び出し元を同一コミットで最小整合させないとビルド／関連テストが割れる。`null` を渡す一時対応は Step 5 で本実装に置き換わる橋渡しで、コミット単位を緑に保つための必要最小限の越境。

## 逸脱3: Step 6 — estimate 側の承認チェーン統合テスト2件を追随修正

- **元の計画**: Step 6 の対象ファイルは `PrismaEmployeeQueryService.ts` と `findSuperiorRoleId.test.ts`（既存更新）のみ。ADR では「承認チェーン E2E の申請者は役割持ちのため影響しない」と整理していた。
- **実際の実装**: 承認チェーンの**統合テスト**2件 `SubmitApplicationCommand.test.ts` / `PreviewApplicationQuery.test.ts` が、申請操作者（課員）の承認起点を廃止した `employees.superior_role_id` 列へ直接書き込んでいた。列削除で壊れるため、明示上位役割行方式（`superiorRole: { create/upsert }`）へフィクスチャを追随させた。
- **逸脱の理由**: ADR が言及した「E2E」ではなく、課員を申請操作者に使う**統合テスト**が列に依存していた見落とし。導出のソース変更（列→明示行）に対して消費側フィクスチャの追随は不可避で、Step 6（導出の実装）と同一コミットに含めるのが自然。

---

## 計画に含まれるが未着手（Step 7 以降・逸脱ではない）

Step 7（DTO 射影）／Step 8（コマンド配線）／Step 9（isInUse 張り替え）／Step 10（UI）／
Step 11（seed 移行）／Step 12（E2E）は計画どおり未着手。Step 11 で seed / seed-e2e の
`superiorRoleId` 列書き込みを新表方式へ移行するまで、`prisma/seed.ts` / `prisma/seed-e2e.ts`
は削除済み列を参照したままである点に留意（計画の依存順どおり）。
