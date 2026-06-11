# Issue #305: 楽観ロックを department サブドメインへ適用する（ADR-0039 横断展開）

## Context

ADR-0039 で楽観ロック（optimistic concurrency control）の横断方針が決定済み。`department` テーブルへの `version Int @default(1)` 列は #301 の7テーブル一括マイグレーションで追加済み（列は使われるまで不活性）。本イシューは department の `UpdateDepartmentCommand` 経路へ段階展開する。

問題: 現状の更新は「findById → メモリ上で変更 → `save`(upsert)」型で、保存時の競合チェックが無い。2人が同じ部署の編集画面を開いて順に保存すると、後勝ちで片方の変更が静かに消える（lost update）。

方式（ADR-0039）: 編集画面表示時の `version` をフォーム hidden input で往復させ、リポジトリを `insert` / `update(aggregate, expectedVersion)` に分割。`updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })` の条件付き UPDATE で「比較→更新」を DB 上で原子化し、`count === 0` を `ConflictError` として throw する。

**唯一の移行済みリファレンス**: `PrismaEstimateRepository`（estimate 縦切り、#301/#310）。department は子集約を持たない単一テーブル版として同じパターンを写し取る。`role` 等のマスタ系は未移行（`save` のまま）。

なお estimate は presentation 層（Server Action / フォーム）が未実装のため、`ConflictError` をユーザー向け文言に表面化する `handleCommandError` の分岐は #310 では未到達だった。UI を持つ department が初めてこのピースを埋める。

## 実装ステップ（1 ステップ = 1 コミット）

### Step 1: ドメイン層リポジトリインターフェースの `save` を `insert`/`update` に分割
- `src/server/subdomains/department/domain/repositories/DepartmentRepository.ts`
  - `save(department)` を削除し、`insert(department)` / `update(department, expectedVersion)` に分割
  - `update` の JSDoc に expectedVersion の意味（編集画面表示時のトークン、不一致で ConflictError）を記載
  - `delete` / `findById` / `findByDepartmentCd` / `findChildren` / `findRootDepartments` は不変

### Step 2: Prisma リポジトリ実装の insert/update 分割＋条件付き UPDATE
- `src/server/subdomains/department/infrastructure/prisma/PrismaDepartmentRepository.ts`
  - `insert`: `prisma.department.create(...)`
  - `update`: 条件付き `updateMany({ where: { id, version: expectedVersion }, data: { ...toPrismaUpdate, version: { increment: 1 } } })`、`count === 0` で `ConflictError`（ADR-0039 細目5 の文言）、保存後を `findUnique` で読み直して返却
  - `ConflictError` を `@server/shared/errors/ApplicationError` から import

### Step 3: クエリ側 DTO に version を追加
- `DepartmentDTO.ts`: `version: number`
- `PrismaDepartmentQueryService.ts`: `getSelectFields()` に `version: true`、`toDTO` の引数型・返り値に `version`

### Step 4: コマンド層の expectedVersion 素通し
- `UpdateDepartmentCommand.ts`: `UpdateDepartmentInput` に `version: number`、末尾を `update(department, input.version)` に
- `CreateDepartmentCommand.ts`: `save(...)` → `insert(...)`

### Step 5: プレゼンテーション層（フォーム往復・Zod・競合メッセージ）
- `[departmentCd]/schema.ts`: `version: z.coerce.number()` 追加
- `[departmentCd]/DepartmentUpdateForm.tsx`: prop 型・defaultValue に version、hidden input 追加
- `[departmentCd]/actions.ts`: `submission.value` から version 分解しコマンドへ
- `_shared/error-handler.ts`: `handleCommandError` に `ConflictError → error.message` 分岐を追加（横断ポリシー ADR-0039 細目4/5）

### Step 6: テスト
- 既存 `UpdateDepartmentCommand.test.ts`: 全 `execute` に `version: 1` 補完、stale version → ConflictError の素通し検証を1件追加
- 既存 `DepartmentCdDuplicationCheckDomainService.test.ts`: `repository.save` → `repository.insert`
- 新規 `PrismaDepartmentRepository.test.ts`: insert→findById ラウンドトリップ、楽観ロック（update 連鎖）、stale トークン逐次再現（lost update なし）

## 検証
- `pnpm lint` / `pnpm test`（vitest は実 DB 統合）
- `save` 廃止で expectedVersion 未渡しがコンパイルエラーになること

## 受け入れ条件との対応
- version 不一致で ConflictError・後勝ち喪失なし → Step 2 + Step 6
- `save` 廃止・未渡しがコンパイルエラー → Step 1/2/4
- 編集ウィンドウのフォーム往復保護 → Step 5
- lost update 防止テストの存在 → Step 6
