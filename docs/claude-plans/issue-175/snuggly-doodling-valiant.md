# Issue #175: 役割管理画面のフロントエンド実装（Presentation層）

## Context

PR #181 で実装済みのバックエンド（Domain/Application/Infrastructure層）に対して、Next.js App Router を用いた CRUD 管理画面を構築する。既存の部署管理・従業員管理と同じパターンに従う。

**固有の課題**: 役職選択に連動した上位役割の動的フィルタリング。課長を選ぶと上位役割は部長の役割のみ表示、社長を選ぶと上位役割は非表示、という制約をUIで実現する必要がある。

## 設計判断

### 1. 上位役割の動的フィルタリング方式

**採用**: 全データ事前ロード + クライアントサイドフィルタリング

- `new/page.tsx`（Server Component）で全Positionと全Roleを取得
- Client Componentにpropsとして渡す
- `useState` で選択中の役職を管理し、`useMemo` で上位役割候補をフィルタ
- 理由: 固定4役職 + 役割数も少数 → サーバーリクエスト不要

**作成ページ**: Position変更時にSuperior Role選択肢を動的に切り替え（slot パターン不可 → 直接 `<select>` をClient Component内に配置）

**編集ページ**: Position不変なので、事前にサーバー側で上位役割候補を計算してpropsで渡す（動的フィルタ不要）

### 2. roleCd から RoleDTO の取得

**採用**: `RoleQueryService.findByRoleCd(roleCd)` を使用

- #184 で `RoleQueryService` に `findByRoleCd` メソッドが追加される前提
- 部署管理の `PrismaDepartmentQueryService.findByDepartmentCd()` と同一パターン
- 詳細ページ (`[roleCd]/page.tsx`) と更新アクション (`[roleCd]/actions.ts`) で使用
- `PrismaRoleQueryService` を直接インスタンス化して呼び出す

### 3. Conform と制御select の共存

Position `<select>` は `onChange` ハンドラが必要（動的フィルタ用）。Conform の `getSelectProps` は使わず、`name` 属性を直接設定。Conform は FormData からバリデーションするため問題なし。

## 実装ステップ

### Step 1: 共通基盤（リダイレクト理由・Zodスキーマ）

**修正するファイル:**
- `src/shared/constants/redirect-reasons.ts` — `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED` 追加
- `src/app/_components/redirect-reason-toast.tsx` — 役割用フラッシュメッセージ3件追加

**新規ファイル:**
- `src/app/(features)/roles/_shared/schema.ts` — 基本Zodスキーマ（name, superiorRoleId）

### Step 2: 一覧ページ

**新規ファイル:**
- `src/app/(features)/roles/layout.tsx` — メタデータ設定（部署layoutと同形式）
- `src/app/(features)/roles/_components/columns.tsx` — DataTableカラム定義（roleCd, name, positionName, superiorRoleName）
- `src/app/(features)/roles/page.tsx` — 一覧ページ

一覧ページの実装ポイント:
- `searchRolesQueryFactory` で検索実行
- 検索フィールド: 役割名（部分一致）、役割コード（完全一致）、役職（select）
- 役職selectの選択肢は `getAllPositionsQueryFactory` で取得
- `RoleDTO` は `positionName`, `superiorRoleName` を含むため Map 構築不要

### Step 3: 新規作成ページ

**新規ファイル:**
- `src/app/(features)/roles/new/schema.ts` — 作成用スキーマ（base + roleCd + positionId）
- `src/app/(features)/roles/new/actions.ts` — createRole サーバーアクション
- `src/app/(features)/roles/new/page.tsx` — 作成ページラッパー
- `src/app/(features)/roles/new/RoleCreateForm.tsx` — 作成フォーム（動的フィルタリング含む）

RoleCreateForm の実装ポイント:
```
Props: positions: {id, name, superiorPositionId}[], allRoles: {id, name, positionId}[]
State: selectedPositionId (useState)
Derived: superiorRoleOptions (useMemo) — 選択した役職の上位役職に属する役割のみ
```
- 役職変更時: 上位役割selectをリセット（`key={selectedPositionId}` で再マウント）
- 上位役職がnull（社長）の場合: 上位役割selectを非表示
- `name` 属性で Conform に値を渡す（`getSelectProps` 不使用）

Server Action (`createRole`):
- `verifyAdmin()` → `parseWithZod` → `createRoleCommandFactory().execute()` → `revalidatePath` → `redirect`
- `superiorRoleId`: undefined → null 変換

### Step 4: 詳細・編集・削除ページ

**新規ファイル:**
- `src/app/(features)/roles/[roleCd]/schema.ts` — 更新用スキーマ（= baseスキーマ）
- `src/app/(features)/roles/[roleCd]/actions.ts` — updateRole, deleteRole サーバーアクション
- `src/app/(features)/roles/[roleCd]/page.tsx` — 詳細ページ
- `src/app/(features)/roles/[roleCd]/RoleUpdateForm.tsx` — 更新フォーム
- `src/app/(features)/roles/[roleCd]/RoleDeleteForm.tsx` — 削除フォーム

詳細ページの実装ポイント:
- `PrismaRoleQueryService.findByRoleCd(roleCd)` で RoleDTO 取得（部署管理と同一パターン）
- `getAllPositionsQueryFactory` で全Position取得 → 当該roleの上位役職ID特定
- 上位役職IDがある場合: `getRolesByPositionQueryFactory` で上位役割候補を取得しpropsへ
- `canUpdate`, `canDelete` は `isAdmin(session)` で判定

RoleUpdateForm:
- roleCd: 読み取り専用（disabled input）
- positionName: 読み取り専用（disabled input）
- name: 編集可能
- superiorRoleId: 事前計算済みの候補からselect（候補なしなら非表示）
- `useServerForm` + `updateRole.bind(null, role.roleCd)`

RoleDeleteForm:
- `DepartmentDeleteForm` と同一パターン
- `useActionState(deleteRole, { success: true })`
- hidden input で id 送信

### Step 5: ダッシュボード導線追加

**修正するファイル:**
- `src/app/(features)/dashboard/page.tsx` — `navigationItems` に役割管理カード追加

## 検証方法

1. `pnpm build` — ビルド成功確認
2. `pnpm dev` で以下を手動確認:
   - ダッシュボードから役割管理へ遷移
   - 一覧表示（検索・フィルタ動作）
   - 新規作成（役職選択 → 上位役割フィルタリング動作）
   - 詳細表示（roleCdクリックで遷移）
   - 編集（名前・上位役割の変更）
   - 削除（使用中の役割はエラー表示）
3. `pnpm lint` — lint通過確認

## ファイル一覧

| ファイル | 操作 | Step |
|---------|------|------|
| `src/shared/constants/redirect-reasons.ts` | 修正 | 1 |
| `src/app/_components/redirect-reason-toast.tsx` | 修正 | 1 |
| `src/app/(features)/roles/_shared/schema.ts` | 新規 | 1 |
| `src/app/(features)/roles/layout.tsx` | 新規 | 2 |
| `src/app/(features)/roles/_components/columns.tsx` | 新規 | 2 |
| `src/app/(features)/roles/page.tsx` | 新規 | 2 |
| `src/app/(features)/roles/new/schema.ts` | 新規 | 3 |
| `src/app/(features)/roles/new/actions.ts` | 新規 | 3 |
| `src/app/(features)/roles/new/page.tsx` | 新規 | 3 |
| `src/app/(features)/roles/new/RoleCreateForm.tsx` | 新規 | 3 |
| `src/app/(features)/roles/[roleCd]/schema.ts` | 新規 | 4 |
| `src/app/(features)/roles/[roleCd]/actions.ts` | 新規 | 4 |
| `src/app/(features)/roles/[roleCd]/page.tsx` | 新規 | 4 |
| `src/app/(features)/roles/[roleCd]/RoleUpdateForm.tsx` | 新規 | 4 |
| `src/app/(features)/roles/[roleCd]/RoleDeleteForm.tsx` | 新規 | 4 |
| `src/app/(features)/dashboard/page.tsx` | 修正 | 5 |

## 主要参考ファイル

- `src/app/(features)/departments/` — 全体構造のテンプレート
- `src/app/_hooks/useServerForm.ts` — フォーム状態管理フック
- `src/app/(features)/_shared/error-handler.ts` — ドメインエラー変換
- `src/server/subdomains/role/application/factories/index.ts` — バックエンドファクトリ
- `src/server/subdomains/position/application/factories/positionQueryFactory.ts` — Position取得
