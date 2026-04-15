# Issue #241: 納品先の新規作成・編集・削除画面の実装 — 実装計画

## コンテキスト

Issue #240 で納品先の一覧・詳細（読み取り専用）画面を実装済み。本 Issue では得意先 CRUD（#239 / PR #248）をパターン参照元として、納品先の書き込み操作（新規作成・編集・削除・有効/無効切り替え）画面を追加する。

併せて、`UpdateDeliveryLocationCommand` と `UpdateCustomerCommand` の `isActive` フィールドがデッドコードであることが判明したため削除する（ADR-0018 で専用コマンド方式を採用済み、UI からは `ActivateXxx` / `DeactivateXxx` を使用）。

## 概要

1. Update コマンドから未使用の `isActive` フィールドを削除（DeliveryLocation + Customer）
2. 納品先の Activate/Deactivate コマンドを新規作成
3. リダイレクト理由定数・フラッシュメッセージを追加
4. 共有バリデーションスキーマを作成
5. 新規作成ページを実装
6. 詳細ページを編集フォーム付きにリライト
7. 削除フォームを追加
8. 有効/無効切り替えフォームを追加

## 設計判断

### 認可方式
- `verifySession()` のみ（管理者制限なし）
- 得意先 CRUD（PR #248）の最終形に準拠。Issue 本文は「管理者のみ」と記載があるが、パターン統一を優先
- 判断不要（既存パターン踏襲）

### 得意先セレクトの実装方式
- A. Slot パターン（`DepartmentSelectField` のような Server Component ラッパー）
- B. Props 渡し（`page.tsx` で取得して Form に渡す）
- 採用: B（得意先 CRUD パターン準拠。一覧ページでも同じクエリを使用済み）

### deliveryNotes の textarea
- `getTextareaProps`（Conform）を使用。`ProductCreateForm` で使用実績あり
- 判断不要（既存パターン踏襲）

## 参照パターン

| 対象 | 参照先 |
|------|--------|
| Create フォーム | `src/app/(features)/customers/new/CustomerCreateForm.tsx` |
| Update フォーム | `src/app/(features)/customers/[code]/CustomerUpdateForm.tsx` |
| Delete フォーム | `src/app/(features)/customers/[code]/CustomerDeleteForm.tsx` |
| Status フォーム | `src/app/(features)/customers/[code]/CustomerStatusForms.tsx` |
| Server Actions | `src/app/(features)/customers/[code]/actions.ts` |
| 共有スキーマ | `src/app/(features)/customers/_shared/schema.ts` |
| Activate/Deactivate コマンド | `src/server/subdomains/customer/application/commands/Activate*.ts` |
| textarea | `src/app/(features)/products/new/ProductCreateForm.tsx` |
| useServerForm | `src/app/_hooks/useServerForm.ts` |
| エラーハンドリング | `src/app/(features)/_shared/error-handler.ts` |

## ステップ

### Step 1: Update コマンドから未使用の isActive フィールドを削除
- 対象ファイル:
  - `src/server/subdomains/delivery-location/application/commands/UpdateDeliveryLocationCommand.ts`
  - `src/server/subdomains/delivery-location/application/commands/__tests__/UpdateDeliveryLocationCommand.test.ts`
  - `src/server/subdomains/customer/application/commands/UpdateCustomerCommand.ts`
  - `src/server/subdomains/customer/application/commands/__tests__/UpdateCustomerCommand.test.ts`
- 作業内容:
  - `UpdateDeliveryLocationInput` から `isActive?: boolean` を削除（L23）
  - `UpdateDeliveryLocationCommand.execute()` から `if (input.isActive !== undefined)` ブロックを削除（L59-65）
  - `UpdateCustomerInput` から `isActive?: boolean` を削除（L23）
  - `UpdateCustomerCommand.execute()` から `if (input.isActive !== undefined)` ブロックを削除（L61-67）
  - 両テストファイルから `isActive を変更できる` テストケースを削除
- コミットメッセージ: `refactor: UpdateDeliveryLocationCommand と UpdateCustomerCommand から未使用の isActive フィールドを削除`

### Step 2: 納品先の有効/無効切り替えコマンドを実装
- 対象ファイル:
  - `src/server/subdomains/delivery-location/application/commands/ActivateDeliveryLocationCommand.ts`（新規）
  - `src/server/subdomains/delivery-location/application/commands/DeactivateDeliveryLocationCommand.ts`（新規）
  - `src/server/subdomains/delivery-location/application/factories/activateDeliveryLocationCommandFactory.ts`（新規）
  - `src/server/subdomains/delivery-location/application/factories/deactivateDeliveryLocationCommandFactory.ts`（新規）
  - `src/server/subdomains/delivery-location/application/factories/index.ts`
- 作業内容:
  - `ActivateCustomerCommand` / `DeactivateCustomerCommand` をミラーリング
  - 入力: `{ id: string }`、`DeliveryLocationRepository` + `DeliveryLocationId` を使用
  - ファクトリは `PrismaDeliveryLocationRepository` を注入
  - `factories/index.ts` に 2 つのファクトリを追加エクスポート
- コミットメッセージ: `feat: 納品先の有効/無効切り替えコマンドを実装`

### Step 3: リダイレクト理由定数とフラッシュメッセージを追加
- 対象ファイル:
  - `src/shared/constants/redirect-reasons.ts`
  - `src/app/_components/redirect-reason-toast.tsx`
- 作業内容:
  - `REDIRECT_REASON` に追加: `DELIVERY_LOCATION_CREATED`, `DELIVERY_LOCATION_UPDATED`, `DELIVERY_LOCATION_DELETED`, `DELIVERY_LOCATION_ACTIVATED`, `DELIVERY_LOCATION_DEACTIVATED`
  - `FLASH_MESSAGES` に対応メッセージを追加（「納品先を登録しました。」等）
- コミットメッセージ: `feat: 納品先のリダイレクト理由定数とフラッシュメッセージを追加`

### Step 4: 共有バリデーションスキーマを作成
- 対象ファイル:
  - `src/app/(features)/delivery-locations/_shared/schema.ts`（新規）
- 作業内容:
  - `deliveryLocationBaseSchema`: `customerBaseSchema` ベース、`marginRate` を削除し `deliveryNotes`（max 500文字, optional）を追加
  - `deliveryLocationCodeSchema`: `customerCodeSchema` と同一パターン
  - 共通フィールド: name, postalCode, prefecture, address, phoneNumber, faxNumber, contactPerson, deliveryNotes
- コミットメッセージ: `feat: 納品先フォームの共有バリデーションスキーマを作成`

### Step 5: 新規作成ページを実装
- 対象ファイル:
  - `src/app/(features)/delivery-locations/new/page.tsx`（新規）
  - `src/app/(features)/delivery-locations/new/schema.ts`（新規）
  - `src/app/(features)/delivery-locations/new/actions.ts`（新規）
  - `src/app/(features)/delivery-locations/new/DeliveryLocationCreateForm.tsx`（新規）
- 作業内容:
  - `page.tsx`: Server Component。`searchCustomersQueryFactory()` で有効得意先を取得し、`customerOptions` として Form に props 渡し
  - `schema.ts`: `deliveryLocationBaseSchema.extend({ code: deliveryLocationCodeSchema, customerId: z.string(...) })`
  - `actions.ts`: `createDeliveryLocation` — `verifySession()` + `createDeliveryLocationCommandFactory()` + `handleCommandError`。リダイレクト先: `/delivery-locations?reason=delivery_location_created`
  - `DeliveryLocationCreateForm.tsx`: `CustomerCreateForm` ベース + 得意先セレクト（`<select>` で `customerOptions` を表示）+ `deliveryNotes`（`getTextareaProps` で textarea）
- コミットメッセージ: `feat: 納品先の新規作成ページを実装`

### Step 6: 詳細ページに編集フォームを追加
- 対象ファイル:
  - `src/app/(features)/delivery-locations/[code]/page.tsx`（リライト）
  - `src/app/(features)/delivery-locations/[code]/schema.ts`（新規）
  - `src/app/(features)/delivery-locations/[code]/actions.ts`（新規）
  - `src/app/(features)/delivery-locations/[code]/DeliveryLocationUpdateForm.tsx`（新規）
- 作業内容:
  - `page.tsx`: 読み取り専用 dl/dt/dd → 編集フォームベースにリライト。h1「納品先編集」+ Badge（有効/無効）。1ブロック「納品先情報」に統合
  - `schema.ts`: `updateDeliveryLocationSchema = deliveryLocationBaseSchema`（code は URL パラメータから取得）
  - `actions.ts`: `updateDeliveryLocation(code, prevState, formData)` — code を bind。`getDeliveryLocationByCodeQueryFactory()` で id 取得 → `updateDeliveryLocationCommandFactory()` で更新。リダイレクト先: `/delivery-locations/${code}?reason=delivery_location_updated`
  - `DeliveryLocationUpdateForm.tsx`: code は読み取り専用表示、親得意先はリンク表示（変更不可）、`deliveryNotes` は textarea
- コミットメッセージ: `feat: 納品先詳細ページに編集フォームを追加`

### Step 7: 詳細ページに削除フォームを追加
- 対象ファイル:
  - `src/app/(features)/delivery-locations/[code]/DeliveryLocationDeleteForm.tsx`（新規）
  - `src/app/(features)/delivery-locations/[code]/actions.ts`（追記）
  - `src/app/(features)/delivery-locations/[code]/page.tsx`（追記）
- 作業内容:
  - `DeliveryLocationDeleteForm.tsx`: `CustomerDeleteForm` ミラーリング。hidden input で `id` を送信
  - `actions.ts` に `deleteDeliveryLocation` を追加。リダイレクト先: `/delivery-locations?reason=delivery_location_deleted`
  - `page.tsx` にフォームコンポーネントを追加配置
- コミットメッセージ: `feat: 納品先詳細ページに削除フォームを追加`

### Step 8: 詳細ページに有効/無効切り替えフォームを追加
- 対象ファイル:
  - `src/app/(features)/delivery-locations/[code]/DeliveryLocationStatusForms.tsx`（新規）
  - `src/app/(features)/delivery-locations/[code]/actions.ts`（追記）
  - `src/app/(features)/delivery-locations/[code]/page.tsx`（追記）
- 作業内容:
  - `DeliveryLocationStatusForms.tsx`: `CustomerStatusForms` ミラーリング。hidden input で `id` と `code` を送信
  - `actions.ts` に `activateDeliveryLocation` / `deactivateDeliveryLocation` を追加。各リダイレクト先にそれぞれの reason を設定
  - `page.tsx` にステータスフォームを追加。レイアウト: ページ末尾に `flex gap-4` で StatusForms + DeleteForm を横並び配置（得意先パターン準拠）
- コミットメッセージ: `feat: 納品先詳細ページに有効/無効切り替えフォームを追加`

## 検証方法

1. `pnpm lint` — lint エラーがないこと
2. `pnpm test` — 既存テスト（UpdateDeliveryLocationCommand, UpdateCustomerCommand のテスト含む）が通ること
3. `pnpm dev` で以下を手動確認:
   - `/delivery-locations/new` で新規作成フォームが表示され、登録できる
   - 得意先セレクトで有効な得意先のみ選択できる
   - 必須項目（コード・名前・得意先）のバリデーションが動作する
   - コード重複時にエラーメッセージが表示される
   - `/delivery-locations/[code]` で編集フォームが表示され、更新できる
   - コードと得意先は編集画面で変更不可であること
   - 削除ボタンで削除できる
   - 有効/無効切り替えボタンが動作する
   - 各操作後にフラッシュメッセージが表示される
4. `pnpm e2e` — E2E テストがあれば通ること（本 Issue では E2E テスト新規作成はスコープ外）
