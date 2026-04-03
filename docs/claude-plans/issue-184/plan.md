# Issue #184: RoleQueryServiceにfindByRoleCdメソッドを追加 — 実装計画

## 概要

RoleQueryServiceインターフェースおよびPrismaRoleQueryServiceに、役割コード（RoleCd）による単一取得メソッド `findByRoleCd` を追加する。RoleCdはPrismaスキーマで `@unique` 制約があるため、`findUnique` を使用して単一のRoleDTOまたはnullを返す。

## ステップ

### Step 1: RoleQueryServiceインターフェースにfindByRoleCdを追加 & PrismaRoleQueryServiceに実装
- 対象ファイル:
  - `src/server/subdomains/role/application/queries/RoleQueryService.ts`
  - `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts`
- 作業内容: インターフェースに `findByRoleCd(roleCd: string): Promise<RoleDTO | null>` を追加し、PrismaRoleQueryServiceに `findUnique` を使った実装を追加
- コミットメッセージ: feat: RoleQueryServiceにfindByRoleCdメソッドを追加

### Step 2: GetRoleByRoleCdQueryクラスとファクトリ関数を追加
- 対象ファイル:
  - `src/server/subdomains/role/application/queries/GetRoleByRoleCdQuery.ts`（新規）
  - `src/server/subdomains/role/application/factories/roleQueryFactory.ts`
- 作業内容: 既存のGetRoleByIdQueryパターンに倣い、クエリクラスとファクトリ関数を作成
- コミットメッセージ: feat: GetRoleByRoleCdQueryクラスとファクトリ関数を追加

### Step 3: ユニットテストを追加
- 対象ファイル:
  - `src/server/subdomains/role/application/queries/__tests__/GetRoleByRoleCdQuery.test.ts`（新規）
- 作業内容: 既存のGetRoleByIdQuery.test.tsパターンに倣い、存在するRoleCd・存在しないRoleCdの両ケースをテスト
- コミットメッセージ: test: GetRoleByRoleCdQueryのユニットテストを追加

### Step 4: lint・テスト実行による検証
- 作業内容: `pnpm lint` と `pnpm test` を実行して全体の整合性を確認
