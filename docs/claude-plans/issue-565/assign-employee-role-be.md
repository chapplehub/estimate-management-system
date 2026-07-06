# Issue #565: 従業員登録・更新画面にて担当役割を設定できるようにする（BE） — 実装計画

## 概要

従業員の**担当役割（EmployeeRole）**を登録・更新画面から設定できるようにする**BE のみ**の実装。Employee 集約に担当役割を単一 `RoleId | null` として持たせ（多対多スキーマ維持＋アプリ層で高々1件・ADR-20260706-c89）、作成・更新コマンドで割当／置換／解除を行う。あわせて FE が依存する読み取り契約（`EmployeeDTO.assignedRoleId` と役割の唯一メンバー判定クエリ）を BE で確定させる。

- **スコープ外（別イシュー）**: 上位役割まわり一式（`EmployeeSuperiorRole` 抽出・`findSuperiorRoleId` 導出・役割なし従業員の明示UI）は **#567**。フォーム・`page.tsx`・`actions`・承認者不在ワーニング表示・e2e は **#568**。本計画では**上位役割・`findSuperiorRoleId`・スキーマ抽出には一切触れない**。
- **実装方式**: 各ステップは `/tdd`（Red → Green → Refactor）で進める。テストを先に書き、失敗を確認してから実装する。DDD レイヤリング（ドメイン → インフラ → アプリ → 読み取り）の順で下位から積む。

## 設計判断

会話（2026-07-06 グリル）で確定済みの判断を記録する。新規の判断は追加しない。

### 担当役割の「高々1件」の表現場所
- A. 多対多スキーマ（EmployeeRole）維持＋アプリ層（Employee 集約）で高々1件に制約
- B. 単一FK `Employee.roleId` へスキーマを作り替える
- 決定: **A**（承認クエリを巻き込む移行コストの非対称性・将来の兼務緩和に対する非可逆性回避）。**ADR-20260706-c89** に起票済み。

### 集約での担当役割の保持形
- 単一 `RoleId | null` で保持（「高々1件」を型で表現）。配列にはしない。

### 割当の振る舞い
- Create は任意（役割なし従業員＝課員を許容）／ Update は置換・解除。
- 割当先に制約を置かない（どの従業員にどの役割でも可・同一役割を複数従業員が持つのも可）。役割存在チェックは FK に委ね、アプリ層の明示検証は行わない。
- 「役割の唯一メンバーを外すと承認者不在になる」ケースへの**ハードガードは設けない**（承認整合は承認時の `NO_APPROVER` が担保）。警告表示は #568（FE）で、その判定データのみ本イシームで供給。

### 読み取り契約（FE=#568 が依存・BE で確定）
- `EmployeeDTO` へは `assignedRoleId: string | null` の**1フィールドのみ**追加（役割名はフォーム供給の一覧から解決＝二重ソース回避）。
- 役割の唯一メンバー判定は読み取り事実であり、ドメインではなく `RoleQueryService`（role サブドメインのメンバー判定ファミリ）に置く。

### 楽観ロック
- `EmployeeRole` 子行の同期は Employee 集約の versioned update 経路の内側で行い、`Employee.version`（ADR-0039）で直列化する（employee 楽観ロックの特殊事情に準拠）。

## ステップ

### Step 1: Employee 集約に担当役割を追加（ドメイン）
- 対象ファイル:
  - `src/server/subdomains/employee/domain/entities/Employee.ts`
  - `src/server/subdomains/employee/domain/entities/__tests__/Employee.test.ts`
- 作業内容:
  - （Red）`assignedRoleId` の保持・`create`（任意）・`reconstruct`・割当/変更/解除メソッド・ゲッターのテストを追加。
  - （Green）private フィールド `_assignedRoleId: RoleId | null` を追加。`create` に任意の担当役割を受け取れるようにし、`reconstruct` に `assignedRoleId` 引数を追加。`assignRole(roleId)` / `clearRole()`（または `changeRole(roleId | null)`）と `assignedRoleId` ゲッターを実装。`RoleId` は `@subdomains/role/domain/values/RoleId` を利用。
- コミットメッセージ: `feat: Employee 集約に担当役割（単一RoleId・高々1件）を追加`
  - body: 多対多スキーマ維持＋アプリ層で高々1件に制約（ADR-20260706-c89）。集約は単一 RoleId|null で保持し型で1件を表現。

### Step 2: 担当役割の永続化（Mapper・Repository で子行同期）
- 対象ファイル:
  - `src/server/subdomains/employee/infrastructure/mappers/EmployeeMapper.ts`
  - `src/server/subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository.ts`
  - `src/server/subdomains/employee/infrastructure/prisma/__tests__/PrismaEmployeeRepository.test.ts`
- 作業内容:
  - （Red）insert/update/findById で `EmployeeRole` 子行が 0/1 件に同期されること（割当あり→1件、なし→0件、置換→旧削除+新作成、解除→削除）を検証する統合テストを追加。
  - （Green）`toDomain` を `employeeRoles` を含む型に対応させ、担当役割を `reconstruct` に渡す。`findById`/`findByEmployeeCd` 等の Prisma クエリに `include: { employeeRoles: true }` を追加。`insert`/`update` で担当役割を `employeeRole` へ同期（update は versioned update と同一経路・同一トランザクション内で `deleteMany({employeeId})` → 必要なら `create`）。
- コミットメッセージ: `feat: 従業員担当役割の永続化（EmployeeRole 子行の0/1件同期）`
  - body: 子行同期は Employee の versioned update 内で行い version（ADR-0039）で直列化。置換は旧行削除＋新行作成で表現。

### Step 3: 作成・更新コマンドに担当役割を配線（アプリ）
- 対象ファイル:
  - `src/server/subdomains/employee/application/commands/CreateEmployeeCommand.ts`
  - `src/server/subdomains/employee/application/commands/UpdateEmployeeCommand.ts`
  - `src/server/subdomains/employee/application/commands/__tests__/CreateEmployeeCommand.test.ts`
  - `src/server/subdomains/employee/application/commands/__tests__/UpdateEmployeeCommand.test.ts`
- 作業内容:
  - （Red）作成時に担当役割あり/なしの両方、更新時に置換・解除のテストを追加。割当先の存在検証は行わない（FK 委譲）方針をテストで固定。
  - （Green）`CreateEmployeeInput` に `roleId?: string`、`UpdateEmployeeInput` に `roleId?: string`（未指定＝解除 or 現状維持は会話方針＝置換・解除に合わせる）を追加。`Employee.create`/割当メソッドへ受け渡す。既存の DI（factory）は新規依存が無いため変更しない見込み。
- コミットメッセージ: `feat: 従業員 作成・更新コマンドに担当役割の割当を追加`
  - body: 割当先の制約・存在検証は置かず FK に委ねる（会話方針）。ハードガードなし＝承認整合は承認時の NO_APPROVER が担保。

### Step 4: 読み取り DTO に担当役割IDを追加（読み取り契約）
- 対象ファイル:
  - `src/server/subdomains/employee/application/queries/dto/EmployeeDTO.ts`
  - `src/server/subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService.ts`
  - `src/server/subdomains/employee/infrastructure/queries/__tests__/`（`PrismaEmployeeQueryService.assignedRoleId.test.ts` など新規）
- 作業内容:
  - （Red）`findById`/`findByEmployeeCd` が担当役割ありで `assignedRoleId` を、なしで `null` を返すテストを追加。
  - （Green）`EmployeeDTO` に `assignedRoleId: string | null` を追加。`getSelectFields()` に `employeeRole`（`select: { roleId }`）を join し、`toDTO` で 0/1 件から `assignedRoleId` を導出（役割名・役職IDは載せない）。
- コミットメッセージ: `feat: EmployeeDTO に担当役割ID(assignedRoleId)を追加`
  - body: 編集画面の現在値復元に必要十分な1フィールドのみ。役割名はフォーム供給の一覧から解決するため DTO に持たせない（二重ソース回避）。

### Step 5: 役割の唯一メンバー判定クエリを追加（承認者不在ワーニング用データ）
- 対象ファイル:
  - `src/server/subdomains/role/application/queries/RoleQueryService.ts`（interface）
  - `src/server/subdomains/role/infrastructure/queries/PrismaRoleQueryService.ts`
  - `src/server/subdomains/role/infrastructure/queries/__tests__/`（新規テスト）
- 作業内容:
  - （Red）`isSoleMember(roleId, employeeId)`（役割の唯一のメンバーが当該従業員のとき true）のテストを追加。メンバー0/1/複数の各境界を検証。
  - （Green）既存の `findRoleIdsWithMembers` / `hasMember` と同じメンバー判定ファミリとして `isSoleMember`（実装は `employeeRole.count({ roleId })` 等で判定）を追加。#568 の FE が「役割変更 × isSoleMember(旧役割)」で非ブロッキング警告を出す土台。
- コミットメッセージ: `feat: RoleQueryService に役割の唯一メンバー判定(isSoleMember)を追加`
  - body: 承認者不在ワーニング（#568 FE）の判定データ。読み取り事実のため QueryService に配置しコマンドでは拒否に用いない。

## 補足

- コミットは上記ステップ単位（意味のあるまとまり）で刻む。一括実装しない（CLAUDE.md 規約）。
- 計画と異なる対応をした場合は `docs/claude-plans/issue-565/deviations.md` に記録する。
- 参考テンプレート/隣接実装: 役割サブドメイン（`SuperiorRoleValidationDomainService`・`PrismaRoleQueryService` のメンバー判定）、既存 Employee CRUD 一式。
