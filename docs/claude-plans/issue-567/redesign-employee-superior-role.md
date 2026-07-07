# Issue #567: 従業員の上位役割を再設計する（EmployeeSuperiorRole 抽出・担当役割からの導出・役割なし従業員の明示設定UI） — 実装計画

## 概要

従業員の**上位役割**（承認チェーンの起点）を再設計する。現行 `Employee.superiorRoleId`（nullable 列）は、役割持ちには「担当役割の上位役割」の非正規化コピーを、課員には明示値を混在保持している。これを次の形に整理する：

- **役割持ち**：上位役割を保存せず、`EmployeeQueryService.findSuperiorRoleId`（唯一の消費点）の内側で「担当役割 → 役割の上位役割」を**読み取り時導出**する。承認サブドメイン（estimate）は無改修。
- **課員**：明示値のみ新表 `EmployeeSuperiorRole`（`employeeId @id`・1:0..1）へ抽出する（NULL 徹底排除）。明示できるのは**課長級**（役職階層の葉）に限る。
- 不変条件 **I1「担当役割あり ⇒ 上位役割行なし」** を Employee 集約が構造的に強制する。
- 課員の上位役割を設定する**登録・更新UI**を追加する（任意入力）。

設計判断の根拠は **ADR-20260707-k4e** および CONTEXT.md「従業員の上位役割」に記録済み。

**実装方式**：バックエンドの Domain / Application / Query 各層は **TDD（レッド→グリーン→リファクタ）** で進める（`testing-backend` 規約・統合テストは ADR-0012）。スキーマ・seed・UI は該当層のテスト規約（Vitest コンポーネントテスト／E2E）に従う。

## 設計判断

グリル（2026-07-07）で確定済み。詳細は ADR-20260707-k4e 参照。ここでは要点のみ再掲する（本計画で新たな判断は追加しない）。

### 課員の上位役割の候補制約 — 決定: 課長級のみ
- A. 任意の管理役割を許す / **B. 課長級（役職階層の葉＝下位役職を持たない役職の役割）に限る**
- 決定理由: 課員の一次承認者は構造上その直属の課長。役割持ちが「役職の 1 段上」から始まるのと対称。任意ティアは課長スキップの不整合を生む。既存データ（seed-e2e の一部課員が部長級を指す）は誤りとして是正する。

### 課長級判定の述語 — 決定: 役職階層の葉判定
- 役職名・CD 直書きではなく「その役割の役職が下位役職を持たない（葉）か」で判定。将来 係長 追加時に葉が自動追従する。

### 課長級制約の強制箇所 — 決定: ドメインサービス＋コマンド呼び出し
- (a) 集約に事実注入 / **(b) ドメインサービス＋コマンド** / (c) アプリ層コマンドで直接
- 決定理由: 役割階層の 1 段上制約を担う既存 `SuperiorRoleValidationDomainService` と構造的に同型。同じ流儀に揃える。サービスは repos の近い role サブドメインへ配置し、employee コマンドから呼ぶ。

### 課員の上位役割の保存時必須性 — 決定: 任意
- 未設定を合法状態とし、申請時の既存の弾き（申請エラー）へ委ねる。CONTEXT「未設定の課員は申請できない」に準拠。

### 役割持ちの登録・更新時の上位役割送信契約 — 決定: 未送信＋コマンド無視＋集約 I1
- 役割持ち時はフィールドを **CSS 非表示でなくアンマウント**（残存値の送信を防ぐ）→ 未送信（undefined）。null 明示送信はしない。コマンドは roleId 存在時 superiorRoleId を読まない。集約 I1 が行の不存在を構造保証（多層防御）。

## ステップ

### Step 1: Prisma スキーマ — EmployeeSuperiorRole 追加・Employee.superiorRoleId 列廃止
- 対象ファイル: `prisma/schema.prisma`, `prisma/migrations/*`
- 作業内容:
  - `model EmployeeSuperiorRole { employeeId @id, roleId FK, timestamps }` を追加（Employee は集約ルート・`onDelete: Cascade`、Role はマスタ・`Restrict`）。
  - `Employee.superiorRoleId` 列・`@relation("EmployeeSuperiorRole")`・`@@index([superiorRoleId])` を削除。Role 側の逆参照 `employeesAsSuperior` を新表経由へ張り替え。
  - `pnpm db:migrate` でマイグレーション生成、`pnpm db:generate`。
- コミットメッセージ: `feat: EmployeeSuperiorRole 表を追加し Employee.superiorRoleId 列を廃止する`

### Step 2: PositionRepository に役職階層の葉判定を追加（TDD）
- 対象ファイル: `role/domain/repositories/PositionRepository.ts`, `role/infrastructure/prisma/PrismaPositionRepository.ts`, 統合テスト
- 作業内容:
  - Red: 「下位役職を持たない役職＝葉」を判定するメソッド（例 `isLeafPosition(positionId)`）の統合テストを書く。
  - Green: `superiorPositionId = X` を持つ行の不在で葉を判定する実装。
- コミットメッセージ: `feat: 役職階層の葉判定を PositionRepository に追加する`

### Step 3: 課長級検証ドメインサービス（TDD）
- 対象ファイル: `role/domain/services/{新規}ValidationDomainService.ts`, テスト, 呼び出し用ファクトリ配線は Step 8 で
- 作業内容:
  - Red: 「指定役割が課長級（葉役職に属する）でなければ `BusinessRuleViolationError`」のテスト。既存 `SuperiorRoleValidationDomainService` と同型の兄弟。
  - Green: `RoleRepository.findById` で役職を引き、`PositionRepository.isLeafPosition` で葉判定する実装。
- コミットメッセージ: `feat: 課員の上位役割を課長級に限る検証ドメインサービスを追加する`

### Step 4: Employee 集約に上位役割行と不変条件 I1（TDD）
- 対象ファイル: `employee/domain/entities/Employee.ts`, テスト
- 作業内容:
  - Red: I1（担当役割あり⇒上位役割行なし）と、`changeRole(非null)` が明示上位役割を自動クリア／`changeSuperiorRole` が役割持ちに対し非null を拒否、を検証するテスト。
  - Green: `_explicitSuperiorRoleId: RoleId | null` を追加、`create`/`reconstruct` 拡張、`changeSuperiorRole` ガード、`changeRole` 自動クリアを実装。
- コミットメッセージ: `feat: Employee 集約に上位役割行と不変条件（担当役割あり⇒上位役割行なし）を持たせる`

### Step 5: EmployeeRepository / Mapper で上位役割行を 0/1 件同期（TDD）
- 対象ファイル: `employee/infrastructure/prisma/PrismaEmployeeRepository.ts`, `employee/infrastructure/mappers/EmployeeMapper.ts`, 統合テスト
- 作業内容:
  - Red: 課員の明示行の作成・置換・解除（0/1 件同期）と、役割持ちには行を作らないことの統合テスト。
  - Green: 保存時に `EmployeeSuperiorRole` を 0/1 件へ upsert/delete、再構築時に明示行を集約へマップ。
- コミットメッセージ: `feat: EmployeeRepository が課員の上位役割行を 0/1 件同期する`

### Step 6: findSuperiorRoleId を読み取り時導出へ（TDD）
- 対象ファイル: `employee/infrastructure/queries/PrismaEmployeeQueryService.ts`, `findSuperiorRoleId.test.ts`（既存更新）
- 作業内容:
  - Red: 「担当役割あり → 役割の上位役割／担当役割なし → 明示行の値／どちらも無 → null」を検証するよう既存統合テストを更新。
  - Green: 単一クエリで `employeeRoles.role.superiorRoleId` と明示行を引き、分岐して返す実装。インタフェース（`string | null`）は不変で estimate 無改修。
- コミットメッセージ: `refactor: 上位役割を findSuperiorRoleId 内で読み取り時導出する（estimate 無改修）`

### Step 7: EmployeeDTO に課員の明示上位役割を射影（TDD）
- 対象ファイル: `employee/application/queries/dto/EmployeeDTO.ts`, `PrismaEmployeeQueryService.ts`（`getSelectFields`/`toDTO`）, テスト
- 作業内容:
  - Red: フォーム preselect 用に、課員は明示上位役割 ID・役割持ちは null を返すことのテスト（承認用の導出 `findSuperiorRoleId` とは別読み）。
  - Green: `getSelectFields` に明示行 join を追加、`toDTO` で射影。
- コミットメッセージ: `feat: EmployeeDTO に課員の明示上位役割を射影する`

### Step 8: Create/UpdateEmployeeCommand で上位役割受け渡し＋課長級検証呼び出し（TDD）
- 対象ファイル: `employee/application/commands/{Create,Update}EmployeeCommand.ts`, 各ファクトリ, テスト
- 作業内容:
  - Red: superiorRoleId 入力の受け渡し、課長級でなければ弾く、roleId 存在時は superiorRoleId を無視（正規化）、のコマンドテスト。
  - Green: Input に `superiorRoleId?` を追加、Step 3 のドメインサービスをファクトリで注入・呼び出し、集約へ受け渡し。
- コミットメッセージ: `feat: 従業員コマンドで上位役割を受け渡し課長級検証を呼ぶ`

### Step 9: RoleRepository.isInUse を EmployeeSuperiorRole へ張り替え（TDD）
- 対象ファイル: `role/infrastructure/prisma/PrismaRoleRepository.ts`, テスト
- 作業内容:
  - Red: 課員の上位役割として参照中の役割が使用中扱いになることのテスト。
  - Green: 被参照チェックに `EmployeeSuperiorRole` を追加（列削除で消えた旧 FK 参照の張り替え）。
- コミットメッセージ: `refactor: 役割の被参照チェックを EmployeeSuperiorRole へ張り替える`

### Step 10: 登録・更新画面に課員の上位役割フィールド
- 対象ファイル: `employees/_shared/schema.ts`, `employees/new/EmployeeCreateForm.tsx`, `employees/[employeeCd]/EmployeeUpdateForm.tsx`, 各 `page.tsx`, `actions.ts`, コンポーネントテスト
- 作業内容:
  - schema に `superiorRoleId?`（任意・空文字→undefined）を追加。
  - 担当役割＝（なし）のときだけ上位役割 `<select>`（課長級候補のみ）を**アンマウント制御で**表示、役割選択時は「担当役割から自動導出」注記に切替。未設定時は非ブロッキング警告（申請不可）。
  - `page.tsx` が課長級ロール候補を葉ティア絞り込みで供給＋課員の現在値を preselect。
- コミットメッセージ: `feat: 従業員登録・更新画面に課員の上位役割設定UIを追加する`

### Step 11: seed / seed-e2e を新表へ移行し課員を課長級へ付け替え
- 対象ファイル: `prisma/seed.ts`, `prisma/seed-e2e.ts`
- 作業内容:
  - 役割持ちは上位役割行を作らない。課員のみ `EmployeeSuperiorRole` 行を作成。
  - `seed-e2e`: 開発課長（POS001→開発部長）等を追加し、開発部・総務部の課員を同部署の課長級へ付け替え（現行の部長級・越境を是正）。dev seed は課長を既に持つため行の張り先のみ調整。
- コミットメッセージ: `refactor: seed を EmployeeSuperiorRole へ移行し課員を課長級へ揃える`

### Step 12: E2E — 課員の上位役割設定フロー＋既存 CRUD の追従
- 対象ファイル: `employees/employees-crud.e2e.ts` ほか（`create-e2e-test` 規約）
- 作業内容:
  - 課員（担当役割なし）での上位役割の設定・更新・解除を検証する E2E を追加。
  - 既存 CRUD E2E が新フィールドの表示/非表示で壊れないことを確認・追従。
- コミットメッセージ: `test: 課員の上位役割設定の E2E を追加する`
