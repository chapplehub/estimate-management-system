# Issue #197: 従業員一覧に部署関係の機能を追加する — 実装計画

## 概要

従業員一覧画面に部署関連の機能が不足している。現在、従業員テーブルには部署名が表示されず、部署によるフィルタリングもできない。Employee エンティティは既に departmentId を持ち、EmployeeDTO にも departmentId が含まれているため、データの関連付けは済んでいる。本 Issue では EmployeeDTO に departmentName を追加し、部署名カラムの追加と部署セレクトボックスによるフィルタリング機能を実装する。

## 設計判断

### 部署名の表示方法（ADR-0013）
- A. EmployeeDTO に departmentName を追加し、QueryService で JOIN して取得する
- B. ページの Server Component で部署一覧を取得し、Map で名前解決する
- C. マスタデータをログイン時にグローバルキャッシュする
- **採用: A**（CQRS の Read Model として自然。RoleDTO の positionName パターンと一貫性がある）

## ステップ

### Step 1: ADR-0013 を起票
- 対象ファイル:
  - `docs/adr/0013-list-dto-includes-related-names.md`
  - `docs/adr/INDEX.md`
- 作業内容:
  - 一覧画面の DTO にリレーション先の名前を含める方針を ADR として記録
  - INDEX.md にエントリを追加
- コミットメッセージ: `docs: ADR-0013 一覧画面のDTOにリレーション先の名前を含める`

### Step 2: EmployeeDTO に departmentName を追加し、QueryService で解決する
- 対象ファイル:
  - `src/server/subdomains/employee/application/queries/dto/EmployeeDTO.ts`
  - `src/server/subdomains/employee/application/queries/dto/EmployeeSearchCriteria.ts`
  - `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
- 作業内容:
  - `EmployeeDTO` に `departmentName: string` を追加
  - `EmployeeSearchCriteria` に `departmentId?: string` を追加
  - `PrismaEmployeeQueryService`:
    - `getSelectFields()` に `department: { select: { name: true } }` を追加
    - `toDTO()` で `departmentName` をマッピング
    - `buildWhereClause()` に departmentId フィルタ条件を追加
- 参考パターン: `PrismaRoleQueryService` の positionName 解決方式
- コミットメッセージ: `feat: EmployeeDTOにdepartmentNameを追加しQueryServiceで解決`

### Step 3: 従業員一覧ページに部署ドロップダウンフィルタと部署名カラムを追加
- 対象ファイル:
  - `src/app/(features)/employees/page.tsx`
  - `src/app/(features)/employees/_components/columns.tsx`
- 作業内容:
  - **page.tsx**:
    - `getActiveDepartmentsQueryFactory()` で有効な部署一覧を取得（ドロップダウン選択肢用）
    - `searchFields` に部署セレクトボックスを追加（`type: "select"`, `key: "departmentId"`）
    - `criteria` に `departmentId` を追加
    - `defaultSearchValues` に `departmentId` を追加
    - ※ 部署名の解決は EmployeeDTO が担うため、ページ側での Map 変換は不要
  - **columns.tsx**:
    - `departmentName` カラムを追加（「名前」カラムの後に配置）
- 参考パターン:
  - `src/app/(features)/roles/page.tsx` — セレクトボックスフィルタの実装パターン
  - `src/server/subdomains/department/application/factories/departmentQueryFactory.ts` — `getActiveDepartmentsQueryFactory()`
- コミットメッセージ: `feat: 従業員一覧に部署フィルタと部署名カラムを追加`

## 検証方法

1. `pnpm build` でビルドエラーがないことを確認
2. `pnpm lint` でリントエラーがないことを確認
3. `pnpm dev` で従業員一覧ページを開き:
   - テーブルに「部署」カラムが表示されること
   - 検索フォームに部署セレクトボックスが表示されること
   - 部署を選択して検索すると、該当部署の従業員のみ表示されること
   - 部署を未選択で検索すると、全従業員が表示されること
