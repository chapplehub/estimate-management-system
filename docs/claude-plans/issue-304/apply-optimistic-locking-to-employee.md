# Issue #304: 楽観ロックを employee サブドメインへ適用する（ADR-0039 横断展開） — 実装計画

## 概要

ADR-0039 の横断ポリシーに基づき、employee サブドメインの更新コマンドへ楽観ロックを適用する。#316（customer 適用、コミット 281b296）のパターンを忠実に移植する。

- `EmployeeRepository` の `save` を `insert` / `update(employee, expectedVersion)` に分割
- Prisma 実装は条件付き `updateMany`（`WHERE id AND version` + `version: { increment: 1 }`）、count = 0 で `ConflictError`
- `UpdateEmployeeCommand` の Input に `expectedVersion` を追加して素通し
- `EmployeeDTO` に `version` を追加し、編集フォームの hidden input + Zod で往復させる

新規 ADR は不要（ADR-0039 の忠実な横断展開であり、新しい設計判断を含まない）。CONTEXT.md への用語追加も不要（楽観ロックはドメイン語彙ではなく横断技術ポリシー）。

### 事前調査で確認済みの前提

- `employee` テーブルの `version Int @default(1)` 列は #301 のマイグレーションで追加済み
- employee に Activate/Deactivate コマンドは存在しない（対象は `UpdateEmployeeCommand` のみ）
- `DeleteEmployeeCommand` は対象外（Delete 系横断イシューで扱う。#316 でも delete は version を読んでいない）
- `save` の呼び出し元は `CreateEmployeeCommand` / `UpdateEmployeeCommand` の2箇所のみ
- 編集ページは `GetEmployeeByEmployeeCdQuery` → `EmployeeDTO` で version が流れる
- `User.role` / `User.email` の更新経路は `UpdateEmployeeCommand` のみ（バイパス経路なし）

## 設計判断

### User 同期（email/role）の楽観ロック保護方式

`UpdateEmployeeCommand` は employee 行の保存後に `UserManagementService` 経由で User テーブルを非トランザクションで更新する。role は User の属性だが employee 編集フォームで一緒に編集されるため、保護が必要。

- A. 実行順序への依存を受容し、明示化する — employee 行の条件付き UPDATE が先に走るため、stale フォームは `ConflictError` で User 同期に到達しない。この順序が保護の前提であることをコードコメントで明記し、コマンド単体テスト（`ConflictError` 時に `UserManagementService` が呼ばれない）で順序を固定する
- B. 本イシューで User を Employee 集約に取り込む — 根本解決だが認証基盤との境界をまたぐ大改修でスコープ逸脱
- 採用: A。B の集約境界再設計は #317 として起票済み

### フォームテストの範囲

`EmployeeUpdateForm.test.tsx` が既に存在する（customer には無かった employee 固有の資産）。

- A. version の hidden input の存在検証まで追加する — フォーム往復はチェーンの中で唯一型に守られない箇所であり、テストで補強する
- B. 既存テストが通るよう修正するだけ（#316 との対称性）
- 採用: A

### コミット分割

- A. 1コミット縦切り — `save` 廃止→コマンド→アクション→フォームが型でつながるコンパイル原子的な変更であり、#316 の customer 適用も1コミット（`feat: customer サブドメインへ楽観ロックを適用する（ADR-0039）`）だった
- B. `save` を温存して段階コミット — 各コミットは動くが、楽観ロックの効かない経路が一時併存し中間状態に意味がない
- 採用: A

### その他（先例踏襲のため判断不要）

- 命名: コマンド Input は `expectedVersion`、フォーム/Zod は `version`（`UpdateCustomerCommand.ts` / customer `schema.ts` 踏襲）
- Prisma 実装: 平坦集約のためトランザクション不要。単発 `updateMany` + 更新後の読み直し（`PrismaCustomerRepository.ts:31-46` と同型）
- `ConflictError` メッセージ: ADR-0039 細目5の文言「他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。」
- DTO: 一覧・詳細共用の `EmployeeDTO` 1本に `version: number` を追加（`CustomerDTO.ts:17` 踏襲）
- Zod: `z.coerce.number().int()`（customer `schema.ts:11-13` 踏襲）

## ステップ

以下は作業順序であり、コミットは Step 6 完了時の1回（設計判断「コミット分割」参照）。

### Step 1: リポジトリインターフェース分割

- 対象ファイル: `src/server/subdomains/employee/domain/repositories/EmployeeRepository.ts`
- 作業内容:
  - `save` を削除し `insert(employee)` / `update(employee, expectedVersion: number)` を定義（JSDoc は `CustomerRepository.ts` 踏襲）

### Step 2: Prisma リポジトリ実装

- 対象ファイル: `src/server/subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository.ts`
- 作業内容:
  - `save`（upsert 分岐）を廃止し、`insert` = `create`、`update` = 条件付き `updateMany` + count = 0 で `ConflictError` + 読み直し

### Step 3: コマンド対応

- 対象ファイル: `src/server/subdomains/employee/application/commands/UpdateEmployeeCommand.ts`, `CreateEmployeeCommand.ts`
- 作業内容:
  - `UpdateEmployeeInput` に `expectedVersion: number` を追加し `update()` へ素通し
  - employee 行の `update()` が User 同期より先に走る順序が User 側保護の前提であることをコメントで明記（#317 参照）
  - `CreateEmployeeCommand` を `insert` へ切替

### Step 4: クエリ側 DTO

- 対象ファイル: `src/server/subdomains/employee/application/queries/dto/EmployeeDTO.ts`, `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
- 作業内容:
  - `EmployeeDTO` に `version: number` を追加し、クエリサービスでマッピング

### Step 5: プレゼンテーション層

- 対象ファイル: `src/app/(features)/employees/[employeeCd]/schema.ts`, `EmployeeUpdateForm.tsx`, `actions.ts`
- 作業内容:
  - `updateEmployeeSchema` に `version: z.coerce.number().int()` を追加
  - フォームの defaultValue に `version: String(employee.version)`、hidden input を配置（`CustomerUpdateForm.tsx:41,59` 踏襲）
  - アクションで version を読み `expectedVersion` としてコマンドへ渡す

### Step 6: テスト

- 対象ファイル: `src/server/subdomains/employee/infrastructure/prisma/__tests__/PrismaEmployeeRepository.test.ts`, `src/server/subdomains/employee/application/commands/__tests__/UpdateEmployeeCommand.test.ts`（および Create 側の既存テスト修正）, `src/app/(features)/employees/[employeeCd]/EmployeeUpdateForm.test.tsx`
- 作業内容:
  - リポジトリ統合テスト: stale トークン逐次再現（`update(v1)` 成功 → 再度 `update(v1)` が `ConflictError`、先行変更が残存）
  - コマンド単体テスト: `expectedVersion` の素通し検証 + `ConflictError` 時に `UserManagementService` が呼ばれないことの検証（順序固定）
  - フォームテスト: version の hidden input の存在検証を追加
- コミットメッセージ: `feat: employee サブドメインへ楽観ロックを適用する（ADR-0039）`
  - ボディに設計判断（User 同期の順序依存の明示化と #317 起票、1コミット縦切りの理由）を記載

## 受け入れ条件（Issue より）

- [ ] 対象コマンドで version 不一致時に `ConflictError` が発生し、後勝ちによる静かな変更喪失が起きない
- [ ] `save` が廃止され、更新経路で expectedVersion を渡さないコードがコンパイルエラーになる
- [ ] 編集ウィンドウ（画面表示時点の version）がフォーム往復で保護される
- [ ] lost update 防止を示すテストが存在する

## 関連

- 親: #301（ADR-0039・7テーブル一括マイグレーション・estimate 縦切り）
- 先例: #316（customer 適用、コミット 281b296）
- 派生: #317（Employee と User の集約境界再設計 — 本イシューのグリルで起票）
