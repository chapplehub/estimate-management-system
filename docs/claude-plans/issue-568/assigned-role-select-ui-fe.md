# Issue #568: 従業員登録・更新画面に担当役割の設定UIを追加する（FE＋e2e） — 実装計画

## 概要

#565（担当役割割当BE）のフロントエンド＋e2e。従業員の登録・更新フォームに **担当役割セレクト**（全役割のドロップダウン・任意選択／解除可）を追加する。更新時は `EmployeeDTO.assignedRoleId` を preselect し、本人が旧役割の唯一メンバーである場合に **承認者不在ワーニング**（非ブロッキング）を反応的に表示する。BE 契約（`CreateEmployeeInput.roleId?` / `UpdateEmployeeInput.roleId?` / `EmployeeDTO.assignedRoleId: string | null` / `RoleQueryService.isSoleMember` / `findAll`）は #565 で確定済み。

**実装方式は TDD（red-green-refactor）を前提**とする。各ステップは失敗するテスト（コンポーネントテスト or e2e）を先に書き、実装で green にする流れで進める。

**リリース順序ハザード**: #565（PR #570）は「roleId 未指定＝解除」の意味論を持つため、本 #568 の FE（roleId フォーム欄）と **同時出荷が必須**。本計画の e2e Step（回帰テスト）がその唯一の網。

## 設計判断

### 役割セレクトの供給方式
- A1. `RoleSelectField` サーバスロットを新設（`DepartmentSelectField` に倣う）
- A2. `page.tsx` が `findAll` で全役割を取得し `{id,name}[]` を props でクライアントフォームへ渡す
- **採用: A2**。承認者不在ワーニングの反応性はフォームが値を所有していると最も堅牢。issue 本文「page.tsx で役割一覧を供給」とも一致。部署のスロット方式は「反応性不要」前提で選ばれたもので、roleId が要件的に異なることは正当な逸脱。

### 役割セレクトの描画配線
- 共通 `SelectField`（生 select・onChange 非公開）を再利用
- 権限セレクトと同じ `<select {...getSelectProps(fields.roleId)}>` インライン描画
- **採用: getSelectProps インライン**。`fields.roleId.value` を反応的に読む要件に対し、repo 内で実証済みなのは conform 配線フィールド（`getInputProps`/`getSelectProps`、`ReviseForm` 先例）のみ。生 select の反応性は未実証のため賭けない。先頭に `<option value="">（担当役割なし）</option>`、以降 `name` のみをラベルに `map`。

### roleId スキーマの型
- `employeeBaseSchema` に `roleId: z.string().optional()` を追加（create/update 両方が extend するため1箇所で足りる）
- `min(1)`・uuid 検証は付けない。conform が空文字を undefined 化する（[[conform-empty-string-to-undefined]]）ため `.optional()` 必須。空選択＝解除が BE の「未指定＝解除」と一致。存在検証はセレクトの選択肢が制約し、改竄は BE の `new RoleId()` が弾く（`departmentId` も schema では uuid 検証しない既存方針と整合）。

### 承認者不在ワーニングのデータフロー
- `[employeeCd]/page.tsx` で現在の `assignedRoleId` に対し `isSoleMember` を **1回スナップショット** → `isSoleMemberOfCurrentRole: boolean` をフォームへ。`assignedRoleId==null` ならクエリせず false。
- クライアントは `assignedRoleId != null && isSoleMemberOfCurrentRole && fields.roleId.value !== assignedRoleId` で反応的に表示。
- スナップショットで十分（非ブロッキング警告。陳腐化しても最終整合は承認時 `NO_APPROVER` が担保）。変更・解除どちらも「本人が旧役割から抜ける」点で同じなので条件は「値が元と異なる」の一本。

### ワーニング UI
- 琥珀色（`bg-yellow-50` `border-yellow-400` `text-yellow-800`）、`role="status"` `aria-live="polite"`（エラーの `role="alert"` とは別扱い）。
- 旧役割名を供給された一覧（id→name）から解決して明示。文言例:「⚠️ この従業員は現在「{旧役割名}」の唯一の担当者です。担当役割を変更・解除しても更新はできますが、この役割の承認が承認者不在になる可能性があります。」
- 非ブロッキング（更新ボタンを無効化しない・フォームエラーにしない）。値が元に戻れば消える。

### 権限（authorization）
- 担当役割セレクトも既存フィールドと同じ `disabled={isPending || !canUpdate}`（owner も自分の担当役割を編集可）。
- 担当役割だけ admin 限定にせず兄弟フィールド（特に既に owner 編集可の権限セレクト）と統一。自己エスカレーション懸念は権限セレクトにも既存で存在するため横断的な別課題。

### 役割オプションの表示
- ラベルは `role.name` のみ、並び順は `roleCd` 昇順。役割名が既に役職を内包し、`DepartmentSelectField`（name 単独＋cd 昇順）の先例と揃う。

### e2e のテストデータ（シード追加なし）
- (A)回帰は破棄可能な `EMP999901` チェーンを拡張、(B)警告は既存の唯一メンバー `EMP000004`（ROLE004）で非保存検証。DB 不変フィクスチャ（`EMP999001` 等）を汚さない。

### スコープ外
- 一覧の担当役割列は **#578** に分離（#567 で上位役割列も同時検討。名前解決方式が ADR-0013 と #565 判断の緊張点）。

### ADR / CONTEXT
- ADR 起票なし（各決定は FE/UI で可逆、非ブロッキング理由・#565 同時出荷理由は既に issue/CONTEXT に記録済み）。
- CONTEXT.md 更新なし（導入したのは UI アフォーダンスで新規ドメイン用語ではない）。

## ステップ

### Step 1: スキーマに roleId を追加
- 対象ファイル: `src/app/(features)/employees/_shared/schema.ts`
- 作業内容:
  - TDD: `employeeBaseSchema` の `roleId` について、未指定・空文字・有効値のパース結果を検証するスキーマテストを先に書く（conform 経路の空文字→undefined を意識）
  - `employeeBaseSchema` に `roleId: z.string().optional()` を追加
- コミットメッセージ: `feat: 従業員フォームスキーマに担当役割(roleId)を追加`

### Step 2: 登録フォームに担当役割セレクトを追加
- 対象ファイル: `src/app/(features)/employees/new/page.tsx`, `new/EmployeeCreateForm.tsx`, `new/EmployeeCreateForm.test.tsx`, `new/actions.ts`
- 作業内容:
  - TDD: `EmployeeCreateForm.test.tsx` に「担当役割セレクトが表示され、（担当役割なし）を含む役割オプションが並ぶ」テストを追加（red）
  - `new/page.tsx` で `PrismaRoleQueryService.findAll({ orderBy: { field: "roleCd", direction: "asc" } })` を取得し `{id,name}[]` を `EmployeeCreateForm` に渡す
  - `EmployeeCreateForm` に `getSelectProps(fields.roleId)` インラインの担当役割セレクト（先頭に空オプション「（担当役割なし）」）を追加
  - `actions.ts` の `createEmployee` で `submission.value.roleId` を Command に受け渡し
- コミットメッセージ: `feat: 従業員登録画面に担当役割セレクトを追加`

### Step 3: 更新フォームに担当役割セレクトと preselect を追加
- 対象ファイル: `src/app/(features)/employees/[employeeCd]/page.tsx`, `[employeeCd]/EmployeeUpdateForm.tsx`, `[employeeCd]/EmployeeUpdateForm.test.tsx`, `[employeeCd]/actions.ts`
- 作業内容:
  - TDD: `EmployeeUpdateForm.test.tsx` に「`assignedRoleId` が preselect される／`canUpdate=false` で disabled」テストを追加（red）
  - `Employee` prop 型に `assignedRoleId: string | null` を追加、`page.tsx` から DTO 経由で供給、役割一覧も供給
  - `EmployeeUpdateForm` に担当役割セレクト（`getSelectProps`・`defaultValue.roleId = assignedRoleId ?? ""`・`disabled={isPending || !canUpdate}`）を追加
  - `updateEmployee` actions で `roleId` を Command に受け渡し
- コミットメッセージ: `feat: 従業員更新画面に担当役割セレクトとpreselectを追加`

### Step 4: 承認者不在ワーニングを追加
- 対象ファイル: `src/app/(features)/employees/[employeeCd]/page.tsx`, `[employeeCd]/EmployeeUpdateForm.tsx`, `[employeeCd]/EmployeeUpdateForm.test.tsx`
- 作業内容:
  - TDD: `EmployeeUpdateForm.test.tsx` に「唯一メンバーがセレクトを変更/解除すると警告表示、元に戻すと消える／唯一メンバーでなければ出ない」テストを追加（red）
  - `page.tsx` で `assignedRoleId != null` のとき `RoleQueryService.isSoleMember(assignedRoleId, employeeId)` を1回呼び `isSoleMemberOfCurrentRole` をフォームへ渡す
  - `EmployeeUpdateForm` に反応的ワーニング（琥珀色・`role="status"`・旧役割名解決・非ブロッキング）を追加
- コミットメッセージ: `feat: 担当役割の承認者不在ワーニング(非ブロッキング)を追加`

### Step 5: e2e 回帰テスト（役割残存）を追加
- 対象ファイル: `src/app/(features)/employees/employees-crud.e2e.ts`
- 作業内容:
  - `EMP999901` の serial チェーンを拡張：作成時に担当役割セレクトで1つ選択 → 更新で名前のみ変更・保存 → 保存後の編集フォームで担当役割セレクトが選択済み残存を assert（リリースハザード F1 の唯一の網）
- コミットメッセージ: `test: 役割保有従業員の編集で担当役割が残存するe2e回帰を追加`

### Step 6: e2e 承認者不在ワーニング表示テストを追加
- 対象ファイル: `src/app/(features)/employees/employees-crud.e2e.ts`
- 作業内容:
  - `EMP000004`（ROLE004 唯一メンバー）の編集画面でセレクトを解除／別役割へ変更 → 警告表示を assert → 保存しない（DB 不変を維持）
- コミットメッセージ: `test: 担当役割の承認者不在ワーニング表示のe2eを追加`
