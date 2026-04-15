# Issue #239: 得意先の新規作成・編集・削除画面の実装 — 実装計画

## 概要

Issue #238 で実装済みの得意先一覧・詳細（読み取り専用）画面に対して、書き込み系操作（新規作成・編集・削除・有効/無効切り替え）のフロントエンド画面を追加する。

- `/customers/new` — 新規作成ページ（フォーム + Server Action）
- `/customers/[code]` — 詳細ページに編集フォーム・削除フォーム・有効/無効切り替えボタンを追加
- 一覧ページに「新規登録」ボタンを追加
- リダイレクト理由定数 + フラッシュメッセージの追加
- 有効/無効切り替え用の専用コマンド（バックエンド）

既存パターン（employees, products）を踏襲し、管理者のみ操作可能とする。

## 設計判断

### バリデーションスキーマの分割方針
- 既存パターン踏襲（`_shared/schema.ts` + 各ページの `schema.ts`）のため判断不要

### isActive の切り替え方式
- A. 編集フォーム内にチェックボックスとして含める
- **B. 有効/無効の切り替えを別アクション（ボタン）として実装する（採用）**
- 採用理由: Product パターンとの一貫性、DDD 原則（「情報の編集」と「状態の切り替え」は異なるドメイン操作）、今後他機能にも展開予定
- ADR-0018 として記録する

## 参照パターン

| パターン | 参照先 |
|---------|--------|
| 作成フォーム | `src/app/(features)/employees/new/` |
| 編集・削除フォーム | `src/app/(features)/employees/[employeeCd]/` |
| 有効/無効切り替え | `src/app/(features)/products/[productCd]/ProductStatusForms.tsx` |
| Activate/Deactivateコマンド | `src/server/subdomains/product/application/commands/Activate*.ts` / `Deactivate*.ts` |
| 共有スキーマ | `src/app/(features)/employees/_shared/schema.ts` |
| useServerForm | `src/app/_hooks/useServerForm.ts` |
| エラーハンドリング | `src/app/(features)/_shared/error-handler.ts` |
| リダイレクト理由 | `src/shared/constants/redirect-reasons.ts` |

## 既存ドメイン層

- 変更不要: `createCustomerCommandFactory()` / `updateCustomerCommandFactory()` / `deleteCustomerCommandFactory()`
- 変更不要: `getCustomerByCodeQueryFactory()`
- 変更不要: Value Objects — CompanyCode, CompanyName, PostalCode, Prefecture, Address, PhoneNumber, FaxNumber, MarginRate
- **新規作成**: `ActivateCustomerCommand` / `DeactivateCustomerCommand` + factory

## ステップ

### Step 1: ADR-0018 の作成

- 対象ファイル:
  - `docs/adr/0018-separate-activate-deactivate-commands.md`（新規作成）
  - `docs/adr/INDEX.md`（既存修正）
- 作業内容:
  - 「エンティティの有効/無効切り替えを専用コマンドで実装する」ADR を作成
  - 既存の Product パターンを正式な設計方針として文書化
  - INDEX.md に追記
- コミットメッセージ: docs: ADR-0018 有効/無効切り替えの専用コマンド化を採用

### Step 2: ActivateCustomerCommand / DeactivateCustomerCommand の実装

- 対象ファイル:
  - `src/server/subdomains/customer/application/commands/ActivateCustomerCommand.ts`（新規作成）
  - `src/server/subdomains/customer/application/commands/DeactivateCustomerCommand.ts`（新規作成）
  - `src/server/subdomains/customer/application/factories/activateCustomerCommandFactory.ts`（新規作成）
  - `src/server/subdomains/customer/application/factories/deactivateCustomerCommandFactory.ts`（新規作成）
  - `src/server/subdomains/customer/application/factories/index.ts`（既存修正: export 追加）
- 作業内容:
  - Product パターン（`ActivateProductCommand` / `DeactivateProductCommand`）を踏襲
  - 入力型: `{ id: string }`
  - 処理: リポジトリから取得 → `customer.activate()` / `customer.deactivate()` → 保存
  - Customer Entity の `activate()` / `deactivate()` メソッドは既存
  - factory で `PrismaCustomerRepository` を注入
- コミットメッセージ: feat: 得意先の有効/無効切り替えコマンドを実装

### Step 3: リダイレクト理由定数とフラッシュメッセージの追加

- 対象ファイル:
  - `src/shared/constants/redirect-reasons.ts`
  - `src/app/_components/redirect-reason-toast.tsx`
- 作業内容:
  - `REDIRECT_REASON` に `CUSTOMER_CREATED`, `CUSTOMER_UPDATED`, `CUSTOMER_DELETED`, `CUSTOMER_ACTIVATED`, `CUSTOMER_DEACTIVATED` を追加
  - `FLASH_MESSAGES` に対応するメッセージを追加:
    - CREATED: 「得意先を登録しました。」
    - UPDATED: 「得意先情報を更新しました。」
    - DELETED: 「得意先を削除しました。」
    - ACTIVATED: 「得意先を有効化しました。」
    - DEACTIVATED: 「得意先を無効化しました。」
- コミットメッセージ: feat: 得意先のリダイレクト理由定数とフラッシュメッセージを追加

### Step 4: 共有バリデーションスキーマの作成

- 対象ファイル:
  - `src/app/(features)/customers/_shared/schema.ts`（新規作成）
- 作業内容:
  - `customerBaseSchema` を定義（name, postalCode, prefecture, address, phoneNumber, faxNumber, contactPerson, marginRate）
  - `customerCodeSchema` を定義（code: 1-20文字、英数字・ハイフン・アンダースコア）
  - バリデーションルールはドメイン Value Object に合わせる:
    - code: `/^[A-Za-z0-9\-_]+$/`, 1-20文字
    - name: 1-100文字
    - postalCode: 7桁の数字（ハイフン除去後）
    - prefecture: `PREFECTURES` 定数からの enum
    - address: 1-200文字
    - phoneNumber / faxNumber: 10-11桁の数字（ハイフン除去後）
    - marginRate: 0〜100 の数値（`z.coerce.number()` で文字列→数値変換）
- コミットメッセージ: feat: 得意先フォームの共有バリデーションスキーマを作成

### Step 5: 新規作成ページの実装

- 対象ファイル:
  - `src/app/(features)/customers/new/schema.ts`（新規作成）
  - `src/app/(features)/customers/new/actions.ts`（新規作成）
  - `src/app/(features)/customers/new/CustomerCreateForm.tsx`（新規作成）
  - `src/app/(features)/customers/new/page.tsx`（新規作成）
- 作業内容:
  - **schema.ts**: `customerBaseSchema.extend({ code: customerCodeSchema })` で作成スキーマを定義
  - **actions.ts**: `createCustomer` Server Action（`verifyAdmin()` → `parseWithZod()` → `createCustomerCommandFactory().execute()` → `revalidatePath` → `redirect`）
  - **CustomerCreateForm.tsx**: `useServerForm` フックを使用したフォーム。フィールド: code, name, postalCode, prefecture（セレクト）, address, phoneNumber, faxNumber, contactPerson, marginRate
  - **page.tsx**: Server Component。`verifyAdmin()` でアクセス制御、フォームをレンダリング
- コミットメッセージ: feat: 得意先の新規作成ページを実装

### Step 6: 詳細ページに編集フォームを追加

- 対象ファイル:
  - `src/app/(features)/customers/[code]/schema.ts`（新規作成）
  - `src/app/(features)/customers/[code]/actions.ts`（新規作成）
  - `src/app/(features)/customers/[code]/CustomerUpdateForm.tsx`（新規作成）
  - `src/app/(features)/customers/[code]/page.tsx`（既存修正）
- 作業内容:
  - **schema.ts**: `customerBaseSchema` をそのまま更新スキーマとして使用（isActive は編集フォームから除外）
  - **actions.ts**: `updateCustomer(code, prevState, formData)` Server Action（`.bind(null, code)` でコードを渡す）
  - **CustomerUpdateForm.tsx**: `useServerForm` フック使用。code は読み取り専用表示、その他は作成フォームと同じフィールド（`defaultValue` で既存値をセット）
  - **page.tsx**: `verifySession()` → `isAdmin(session)` で `canUpdate` / `canDelete` を判定。`canUpdate` の場合に `CustomerUpdateForm` を表示
- コミットメッセージ: feat: 得意先詳細ページに編集フォームを追加

### Step 7: 詳細ページに削除フォームを追加

- 対象ファイル:
  - `src/app/(features)/customers/[code]/CustomerDeleteForm.tsx`（新規作成）
  - `src/app/(features)/customers/[code]/actions.ts`（既存修正: `deleteCustomer` を追加）
  - `src/app/(features)/customers/[code]/page.tsx`（既存修正: 削除フォーム表示）
- 作業内容:
  - **CustomerDeleteForm.tsx**: `useActionState` で `deleteCustomer` を呼び出す。hidden input で ID を渡す。確認付き削除ボタン（employees パターン踏襲）
  - **actions.ts**: `deleteCustomer` Server Action を追加（`verifyAdmin()` → `deleteCustomerCommandFactory().execute({ id })` → `revalidatePath` → `redirect`）
  - **page.tsx**: `canDelete` の場合に `CustomerDeleteForm` を表示
- コミットメッセージ: feat: 得意先詳細ページに削除フォームを追加

### Step 8: 詳細ページに有効/無効切り替えフォームを追加

- 対象ファイル:
  - `src/app/(features)/customers/[code]/CustomerStatusForms.tsx`（新規作成）
  - `src/app/(features)/customers/[code]/actions.ts`（既存修正: `activateCustomer` / `deactivateCustomer` を追加）
  - `src/app/(features)/customers/[code]/page.tsx`（既存修正: ステータス切り替えフォーム表示）
- 作業内容:
  - **CustomerStatusForms.tsx**: `ProductStatusForms` パターン踏襲。`useActionState` を使用。有効時は「無効化」ボタン、無効時は「有効化」ボタンを表示
  - **actions.ts**: `activateCustomer` / `deactivateCustomer` Server Action を追加（`verifyAdmin()` → factory → `revalidatePath` → `redirect`）
  - **page.tsx**: `canUpdate` の場合に `CustomerStatusForms` を表示
- コミットメッセージ: feat: 得意先詳細ページに有効/無効切り替えフォームを追加

### Step 9: 一覧ページに新規登録ボタンを追加

- 対象ファイル:
  - `src/app/(features)/customers/page.tsx`（既存修正）
- 作業内容:
  - `isAdmin(session)` を使って管理者のみに「新規登録」ボタン（Linkコンポーネント、href="/customers/new"）を表示
  - ヘッダー部分（`<h1>` の横）に配置（employees パターン踏襲）
- コミットメッセージ: feat: 得意先一覧ページに新規登録ボタンを追加

### Step 10: Lint チェックと最終確認

- 作業内容:
  - `pnpm lint` を実行してエラーがないことを確認
  - エラーがあれば修正
- コミットメッセージ: （lint エラーがあった場合のみ）fix: lint エラーの修正

## 検証方法

1. `pnpm dev` で開発サーバーを起動
2. ブラウザで以下を確認:
   - `/customers` — 新規登録ボタンが表示される（管理者ログイン時）
   - `/customers/new` — フォームが表示され、必須項目のバリデーションが動作する
   - 新規作成 → 一覧にリダイレクト + フラッシュメッセージ
   - `/customers/[code]` — 編集フォームが表示され、更新できる（code は変更不可）
   - 有効/無効切り替えボタンが状態に応じて表示され、切り替え後にフラッシュメッセージが表示される
   - 削除ボタンで確認後に削除 → 一覧にリダイレクト + フラッシュメッセージ
3. `pnpm lint` でエラーなし
