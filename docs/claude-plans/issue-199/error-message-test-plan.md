# Issue #199: エラーメッセージ表示に関するテストの実装 — 実装計画

## 概要

「エラーメッセージは発生源でテストする」原則に基づき、全テストファイルにエラーメッセージのハードコード文字列アサーションを追加する。テスト修正完了後にtesting-backend Skillとdev-guidelinesのルールを更新する。

### 原則

- **発生源のエラー**: 型 + ハードコード文字列でテスト
- **バブルアップするエラー**: テスト不要（発生源で検証済み）
- **動的値を含むメッセージ**: 静的部分のみ部分一致でテスト
- **共有定数でのテスト**: 禁止（実装の配線テストになるため）

### ENTITY_NAME一覧（NotFoundEntityError用）

| エンティティ | ENTITY_NAME | NotFoundメッセージ（部分一致で使う部分） |
|---|---|---|
| Customer | `得意先` | `得意先が見つかりません` |
| Employee | `従業員` | `従業員が見つかりません` |
| Department | `部署` | `部署が見つかりません` |
| DeliveryLocation | `納品先` | `納品先が見つかりません` |
| Role | `役割` | `役割が見つかりません` |
| Position | `役職` | `役職が見つかりません` |

## 設計判断

なし（議論済み・ADR-0011で記録済み）

## 逸脱記録

コミット時に計画からの逸脱を検知した場合は `docs/claude-plans/issue-199/deviations.md` に記録する。

## ステップ

### Step 1: 共有Value Objectテストにメッセージアサーション追加

- 対象ファイル:
  - `src/server/shared/domain/values/__tests__/PostalCode.test.ts`
  - `src/server/shared/domain/values/__tests__/PhoneNumber.test.ts`
  - `src/server/shared/domain/values/__tests__/FaxNumber.test.ts`
  - `src/server/shared/domain/values/__tests__/CompanyCode.test.ts`
  - `src/server/shared/domain/values/__tests__/CompanyName.test.ts`
  - `src/server/shared/domain/values/__tests__/Address.test.ts`
  - `src/server/shared/domain/values/__tests__/Prefecture.test.ts`
- 作業内容:
  - 各`toThrow(ValidationError)`の直後にメッセージアサーションを追加
  - PostalCode: `"郵便番号は7文字以上で入力してください"`, `"郵便番号は7文字以内で入力してください"`, `"郵便番号は7桁の数字で入力してください（例: 1234567）"`
  - PhoneNumber: `"電話番号は10文字以上で入力してください"`, `"電話番号は11文字以内で入力してください"`, `"電話番号は10〜11桁の数字で入力してください"`
  - FaxNumber: `"FAX番号は10文字以上で入力してください"`, `"FAX番号は10〜11桁の数字で入力してください"`
  - CompanyCode: `"取引先コードは必須です"`, `"取引先コードは20文字以内で入力してください"`, `"取引先コードは英数字・ハイフン・アンダースコアのみ使用できます"`
  - CompanyName: `"会社名は必須です"`, `"会社名は100文字以内で入力してください"`
  - Address: `"住所は必須です"`, `"住所は200文字以内で入力してください"`
  - Prefecture: `"都道府県は必須です"`, `"有効な都道府県名を入力してください"`
- 検証: `pnpm vitest run src/server/shared/domain/values/__tests__`
- コミットメッセージ: `test: 共有Value Objectテストにエラーメッセージアサーション追加 (#199)`

### Step 2: Employee系Value Objectテストの補完

- 対象ファイル:
  - `src/server/subdomains/employee/domain/values/__tests__/EmployeeCd.test.ts`
  - `src/server/subdomains/employee/domain/values/__tests__/Password.test.ts`
- 作業内容:
  - EmployeeCd: メッセージ未設定のケース2箇所を追加
    - line 71「数値部分が6桁でない（7桁）」→ `"社員コードは EMP + 6桁の数字である必要があります"`
    - line 87「形式が完全に間違っている場合」→ `"社員コードは必須です"` or フォーマットエラー（入力値による）
  - Password: line 107「スペースのみの場合」→ `"パスワードは10文字以上で入力してください"`
- 検証: `pnpm vitest run src/server/subdomains/employee/domain/values/__tests__`
- コミットメッセージ: `test: Employee系VOテストのエラーメッセージアサーション補完 (#199)`

### Step 3: Department系Value Objectテストの補完

- 対象ファイル:
  - `src/server/subdomains/department/domain/values/__tests__/DepartmentCd.test.ts`
  - `src/server/subdomains/department/domain/values/__tests__/DepartmentName.test.ts`
  - `src/server/subdomains/department/domain/values/__tests__/Abbreviation.test.ts`
- 作業内容:
  - DepartmentCd: fromNumber(0)→`"部署コードは 1 〜 999 の範囲である必要があります"`, fromNumber(1000)→同上, DEPT000→`"部署コードは 1 以上である必要があります"`, 形式エラー系→`"部署コードは DEPT + 3桁の数字である必要があります"`
  - DepartmentName: 空白のみ→`"部署名は必須です"`
  - Abbreviation: 空白のみ→`"部署略称は必須です"`
- 検証: `pnpm vitest run src/server/subdomains/department/domain/values/__tests__`
- コミットメッセージ: `test: Department系VOテストのエラーメッセージアサーション補完 (#199)`

### Step 4: Position系・Role系Value Objectテストの補完

- 対象ファイル:
  - `src/server/subdomains/position/domain/values/__tests__/PositionCd.test.ts`
  - `src/server/subdomains/position/domain/values/__tests__/PositionName.test.ts`
  - `src/server/subdomains/role/domain/values/__tests__/RoleCd.test.ts`
  - `src/server/subdomains/role/domain/values/__tests__/RoleName.test.ts`
- 作業内容:
  - PositionCd: fromNumber系→`"役職コードは 1 〜 999 の範囲である必要があります"`, POS000→`"役職コードは 1 以上である必要があります"`, 形式エラー系→`"役職コードは POS + 3桁の数字である必要があります"`
  - PositionName: 空白のみ→`"役職名は必須です"`
  - RoleCd: fromNumber系→`"役割コードは 1 〜 999 の範囲である必要があります"`, ROLE000→`"役割コードは 1 以上である必要があります"`, 形式エラー系→`"役割コードは ROLE + 3桁の数字である必要があります"`
  - RoleName: 空白のみ→`"役割名は必須です"`
- 検証: `pnpm vitest run src/server/subdomains/position/domain/values/__tests__ src/server/subdomains/role/domain/values/__tests__`
- コミットメッセージ: `test: Position系・Role系VOテストのエラーメッセージアサーション補完 (#199)`

### Step 5: Customer系Value Object + Commandテスト

- 対象ファイル:
  - `src/server/subdomains/customer/domain/values/__tests__/MarginRate.test.ts`
  - `src/server/subdomains/customer/application/commands/__tests__/CreateCustomerCommand.test.ts`
  - `src/server/subdomains/customer/application/commands/__tests__/DeleteCustomerCommand.test.ts`
  - `src/server/subdomains/customer/application/commands/__tests__/UpdateCustomerCommand.test.ts`
- 作業内容:
  - MarginRate: 範囲外→`"マージン率は0〜100%の範囲で指定してください"`, NaN/Infinity→`"マージン率は有効な数値で指定してください"`
  - CreateCustomerCommand: 重複→`"既に存在する取引先コードです"`
  - DeleteCustomerCommand: NotFound→`"得意先が見つかりません"`
  - UpdateCustomerCommand: NotFound→`"得意先が見つかりません"`
- 検証: `pnpm vitest run src/server/subdomains/customer`
- コミットメッセージ: `test: Customer系テストにエラーメッセージアサーション追加 (#199)`

### Step 6: DeliveryLocation系Value Object + Commandテスト

- 対象ファイル:
  - `src/server/subdomains/delivery-location/domain/values/__tests__/DeliveryNotes.test.ts`
  - `src/server/subdomains/delivery-location/application/commands/__tests__/CreateDeliveryLocationCommand.test.ts`
  - `src/server/subdomains/delivery-location/application/commands/__tests__/DeleteDeliveryLocationCommand.test.ts`
  - `src/server/subdomains/delivery-location/application/commands/__tests__/UpdateDeliveryLocationCommand.test.ts`
- 作業内容:
  - DeliveryNotes: 空文字→`"配送備考は必須です"`, 501文字→`"配送備考は500文字以内で入力してください"`
  - CreateDeliveryLocationCommand: 重複→`"既に存在する取引先コードです"`, 親NotFound→`"得意先が見つかりません"`, 親無効→`"無効化された得意先には納品先を追加できません"`
  - DeleteDeliveryLocationCommand: NotFound→`"納品先が見つかりません"`
  - UpdateDeliveryLocationCommand: NotFound→`"納品先が見つかりません"`
- 検証: `pnpm vitest run src/server/subdomains/delivery-location`
- コミットメッセージ: `test: DeliveryLocation系テストにエラーメッセージアサーション追加 (#199)`

### Step 7: Department系Commandテスト

- 対象ファイル:
  - `src/server/subdomains/department/application/commands/__tests__/CreateDepartmentCommand.test.ts`
  - `src/server/subdomains/department/application/commands/__tests__/DeleteDepartmentCommand.test.ts`
  - `src/server/subdomains/department/application/commands/__tests__/UpdateDepartmentCommand.test.ts`
- 作業内容:
  - CreateDepartmentCommand: 重複→`"既に存在する部署コードです"`, 親NotFound→`"親部署が存在しません"`, 親無効→`"無効な部署を親部署に設定することはできません"`
  - DeleteDepartmentCommand: NotFound→`"部署が見つかりません"`, 子部署あり→`"子部署が存在するため、この部署を削除できません。先に子部署を削除してください。"`
  - UpdateDepartmentCommand: NotFound→`"部署が見つかりません"`, 子部署有効→`"有効な子部署が存在するため、この部署を無効化できません"`, 自己参照→`"自分自身を親部署にすることはできません"`, 親NotFound→`"親部署が存在しません"`, 親無効→`"無効な部署を親部署に設定することはできません"`, 循環→`"循環参照が発生するため、この親部署は設定できません"`
- 検証: `pnpm vitest run src/server/subdomains/department/application/commands/__tests__`
- コミットメッセージ: `test: Department系Commandテストにエラーメッセージアサーション追加 (#199)`

### Step 8: Employee系Commandテスト

- 対象ファイル:
  - `src/server/subdomains/employee/application/commands/__tests__/CreateEmployeeCommand.test.ts`
  - `src/server/subdomains/employee/application/commands/__tests__/DeleteEmployeeCommand.test.ts`
  - `src/server/subdomains/employee/application/commands/__tests__/UpdateEmployeeCommand.test.ts`
- 作業内容:
  - CreateEmployeeCommand: CD重複→`"既に存在する従業員CDです"`, Email重複→`"既に存在するメールアドレスです"`, 認証失敗→`"認証ユーザーの作成に失敗しました"`
  - DeleteEmployeeCommand: NotFound→`"従業員が見つかりません"`, 認証削除失敗→`"認証ユーザーの削除に失敗しました"`
  - UpdateEmployeeCommand: NotFound→`"従業員が見つかりません"`, Email重複→`"既に存在するメールアドレスです"`
- 検証: `pnpm vitest run src/server/subdomains/employee/application/commands/__tests__`
- コミットメッセージ: `test: Employee系Commandテストにエラーメッセージアサーション追加 (#199)`

### Step 9: Role系Commandテスト

- 対象ファイル:
  - `src/server/subdomains/role/application/commands/__tests__/CreateRoleCommand.test.ts`
  - `src/server/subdomains/role/application/commands/__tests__/DeleteRoleCommand.test.ts`
  - `src/server/subdomains/role/application/commands/__tests__/UpdateRoleCommand.test.ts`
- 作業内容:
  - CreateRoleCommand: CD重複→`"既に存在する役割コードです"`, 名前重複→`"既に存在する役割名です"`, 役職NotFound→`"役職が存在しません"`
  - DeleteRoleCommand: NotFound→`"役割が見つかりません"` ※下位役割エラー（line 85-86）は既にメッセージテスト済み
  - UpdateRoleCommand: NotFound→`"役割が見つかりません"`, 名前重複→`"既に存在する役割名です"`, 自己参照→`"自分自身を上位役割にすることはできません"`, 循環→`"循環参照が発生するため、この上位役割は設定できません"` ※line 204のSuperiorRoleValidation由来エラーはバブルアップなのでメッセージテスト不要
- 検証: `pnpm vitest run src/server/subdomains/role/application/commands/__tests__`
- コミットメッセージ: `test: Role系Commandテストにエラーメッセージアサーション追加 (#199)`

### Step 10: testing-backend Skill・dev-guidelinesのルール更新

- 対象ファイル:
  - `.claude/skills/testing-backend/SKILL.md`
  - `docs/dev-guidelines.md`
- 作業内容:
  - 「エラーテストはエラー型のみ検証する（メッセージは検証しない）」ルールを廃止
  - 新ルール:「エラーの発生源では型 + ハードコード文字列でメッセージもテストする。バブルアップするエラーはテスト不要」
  - Good/Badのコード例を更新
  - VO・Command・Domain Serviceそれぞれの方針を明記
- 検証: ルール変更後に `pnpm test` で全テスト通過を確認
- コミットメッセージ: `docs: エラーメッセージテストルールを「発生源でテストする」方針に更新 (#199)`
