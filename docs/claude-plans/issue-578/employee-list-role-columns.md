# Issue #578: 従業員一覧に担当役割（＋上位役割）の列を追加する — 実装計画

## Context

従業員一覧（`/employees`）には現在、担当役割・上位役割の列が無い。#565 は登録・更新フォーム文脈でのみ役割を扱い、一覧DTO（`EmployeeDTO`）には「役割名はフォーム供給の一覧から解決する」という理由で**役割名を意図的に載せなかった**。

#578 が初めて**一覧表示要件**を持ち込むため、役割名の解決方式を決める必要があった。ここに ADR-0013（一覧DTOにリレーション先の名前をJOINで載せる）と #565 の非搭載判断の緊張関係がある。

**ユーザー決定**:
- 役割名解決方式 = **案B（DTOにJOIN）**。ADR-0013 の標準パターンに統一（既存 `departmentName` と同方式）。#565 の非搭載判断は「表示要件が無かった時点の判断」として上書きする。
- 列スコープ = **担当役割列＋上位役割列の両方**。#567（`EmployeeSuperiorRole` 抽出・上位役割の読み取り時導出）は**CLOSED＝完了済み**で、導出ロジック（`findSuperiorRoleId`）・子表が確定しているため、上位役割列を本イシューで同時実装できる。

**目標**: 従業員一覧に「担当役割」「上位役割」列を追加し、案Bで名前を解決。E2Eで表示を検証する。

## 設計判断

### 役割名の解決方式（Issueの核心 decision）
- A. 一覧 `page.tsx` で全役割を取得し `Map<id,name>` を組んでFE側で解決（list DTO 不変）
- B. `EmployeeDTO` に `assignedRoleName` / `superiorRoleName` を JOIN して載せる
- **決定: B**（ユーザー選択）。ADR-0013 準拠、`departmentName` と一貫、変更がQueryServiceに局所化。#565 のDTOコメント（「役割名はフォーム供給の一覧から解決するため持たない」）は表示要件の発生に伴い更新する。

### 上位役割名の導出方式
- 表示する「上位役割」= 従業員の上位役割（承認起点＝`findSuperiorRoleId` と同じ導出分岐）。担当役割あり→その役割の上位役割名、課員→明示 `EmployeeSuperiorRole` の役割名、どちらも無→null。
- `findSuperiorRoleId`（ID専用・承認消費点）とは別に、`toDTO` 内で JOIN 済み行から**名前を導出**する。
  - A. `toDTO` にインライン導出（2分岐）
  - B. 共通ヘルパーへ抽出
  - **推奨: A（インライン）**。`findSuperiorRoleId` は別クエリ・ID返却でデータ形状が異なり、既存コードも `explicitSuperiorRoleId` に「承認起点の導出とは別読み」と明記済み。表示用と承認用の分離という既存方針に沿う。導出は2分岐と小さく、共通化の便益が薄い。

### 役割なし（null）の表示
- 担当役割なし（課員）／上位役割なし（社長）は列に `-` を表示。ADR-0013 が許容する departments の `-` 慣習に合わせる。`columns.tsx` の cell レンダラで `?? "-"`。

### #567 との整合
- 本イシューで案Bを採用。上位役割列も同じ案Bで実装するため、#567 と方式が揃う（列デザインの二度手間なし）。

## ステップ

### Step 1: BE — 一覧DTOに担当役割名・上位役割名を載せる（案B）
- 対象ファイル:
  - `src/server/subdomains/employee/application/queries/dto/EmployeeDTO.ts`
  - `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
  - `src/server/subdomains/employee/infrastructure/queries/__tests__/PrismaEmployeeQueryService.assignedRoleId.test.ts`（等、既存テストパターンに倣い新規 or 追記）
- 作業内容:
  - `EmployeeDTO` に `assignedRoleName: string | null` と `superiorRoleName: string | null` を追加。`assignedRoleId` のコメントを「名前は一覧表示のため `assignedRoleName` に載せる／フォームの現在値復元はIDを使う」に更新。
  - `getSelectFields()` を拡張:
    - `employeeRoles.select` に `role: { select: { name: true, superiorRole: { select: { name: true } } } }`
    - `superiorRole.select`（EmployeeSuperiorRole）に `role: { select: { name: true } }`
  - `toDTO()` の引数型と本体を拡張:
    - `assignedRoleName = employee.employeeRoles[0]?.role.name ?? null`
    - `superiorRoleName`: 担当役割あり → `employeeRoles[0].role.superiorRole?.name ?? null`／課員 → `employee.superiorRole?.role?.name ?? null`（`findSuperiorRoleId` L74-81 と同分岐）
  - 単体テスト: 役割持ち（担当名＝役割名、上位名＝役割の上位役割名）・課員（担当 null、上位＝明示役割名）・社長（担当名あり、上位 null）の3系統を検証。既存 `*.assignedRoleId.test.ts` / `*.explicitSuperiorRoleId.test.ts` のパターン踏襲。
- コミットメッセージ: `feat: 従業員一覧DTOに担当役割名・上位役割名を載せる（案B/ADR-0013）`

### Step 2: FE — 一覧に担当役割・上位役割の列を追加
- 対象ファイル: `src/app/(features)/employees/_components/columns.tsx`
- 作業内容:
  - 「部署」列の後（または「権限」列の前）に列を2つ追加:
    - `{ accessorKey: "assignedRoleName", header: "担当役割", cell: ({ row }) => row.original.assignedRoleName ?? "-" }`
    - `{ accessorKey: "superiorRoleName", header: "上位役割", cell: ({ row }) => row.original.superiorRoleName ?? "-" }`
  - `page.tsx` は変更不要（DTOをそのまま流す＝ADR-0013 の狙い）。
- コミットメッセージ: `feat: 従業員一覧に担当役割・上位役割の列を追加（FE）`

### Step 3: E2E — 列表示アサーション追加
- 対象ファイル: `src/app/(features)/employees/employees-list.e2e.ts`
- 作業内容:
  - ヘッダー名からカラム位置を動的特定する既存パターン（「権限で検索できる」テスト L61-64 参照）に倣い、`EMP000004`（担当=開発部長／上位=営業本部長）で両列に役割名が出ることを検証するテストを追加。
  - 課員 `EMP000006`（担当=`-`／上位=営業課長）で null 表示と明示上位役割の表示も検証（余力あれば1テストに含める）。
  - 対象コードで検索して1行に絞り、`td:nth-child(担当役割列index)` / `td:nth-child(上位役割列index)` のテキストをアサート。
- コミットメッセージ: `test: 従業員一覧の担当役割・上位役割列のE2Eアサーションを追加`

## 検証

- `pnpm test`（単体）: Step 1 の QueryService 導出テストが通ること。事前に schema 変更は無いため `pnpm test:setup` 不要。
- `pnpm lint` / 型チェック: DTO 追加フィールドの型整合。
- `pnpm e2e -- employees-list`（該当specのみ。全体はCIに任せる）: 追加した列アサーションが通ること。事前に `pnpm e2e:seed` でシード最新化。
- 任意: `verify-frontend`（dev server + playwright MCP）で `/employees` を開き、担当役割・上位役割列と `-` 表示を目視確認。

## 補足
- E2Eフィクスチャ（`prisma/seed-e2e.ts`）の役割階層: ROLE004(開発部長)→上位 ROLE002(営業本部長)、ROLE005(営業課長)→上位 ROLE003(営業部長)、ROLE001(社長)→上位 null。課員 EMP000006(DEPT001)→明示上位 ROLE005(営業課長)。既存データで両列を検証可能、シード変更は不要。
