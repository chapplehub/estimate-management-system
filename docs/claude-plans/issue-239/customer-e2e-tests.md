# Issue #239: 得意先E2Eテスト作成 — 実装計画

## 概要

得意先機能のE2Eテストを2ファイルに分けて作成する。
- `customers-crud.e2e.ts` — CRUD操作・ステータス変更・削除制約・重複エラー
- `customers-detail.e2e.ts` — 詳細画面の表示・ナビゲーション（パンくず、納品先リンク遷移、404）

**前提**: 管理者制御が削除済み。全認証ユーザーが登録・更新・削除・ステータス変更を実行可能。

## 設計判断

### テストファイルの分割方針
- CRUD（ミューテーション操作とその結果検証）と、詳細画面の表示・ナビゲーション検証は性質が異なる
- `products-relations.e2e.ts` が関連エンティティ系テストを分離している前例に倣う
- 既存の `customers-list.e2e.ts` と合わせて3ファイル構成になる

### 削除制約テストの方法
- A. テスト内で得意先+納品先を作成し制約を検証 → 複雑
- B. シードデータ C001（納品先あり）に対して削除を試行し失敗を検証 → 非破壊的
- 推奨: B（C001の削除はFK制約で失敗するため、シードデータは損なわれず安全）

### 一般ユーザーテストの範囲
- admin/一般の画面差異は存在しない
- 作成→削除の簡易フローで「一般ユーザーもCRUD可能」を確認すれば十分

## ステップ

### Step 1: customers-crud.e2e.ts の作成
- 対象ファイル: `src/app/(features)/customers/customers-crud.e2e.ts`（新規作成）
- 作業内容:
  - departments-crud.e2e.ts / products-crud.e2e.ts のパターンに従って実装
  - テストデータ: `CUST901`（管理者serial用）、`CUST902`（一般ユーザーserial用）
- コミットメッセージ: `test: 得意先CRUD E2Eテストを作成`

### Step 2: customers-detail.e2e.ts の作成
- 対象ファイル: `src/app/(features)/customers/customers-detail.e2e.ts`（新規作成）
- 作業内容:
  - 詳細画面のナビゲーション・表示テスト
  - シードデータ（C001）を使用した非破壊テスト
- コミットメッセージ: `test: 得意先詳細画面E2Eテストを作成`

## テストケース詳細

### ファイル構成

```
customers-crud.e2e.ts    → CRUD操作・ステータス変更・制約・重複エラー
customers-detail.e2e.ts  → 詳細画面の表示・ナビゲーション
customers-list.e2e.ts    → 一覧画面の検索・表示（既存）
```

---

### customers-crud.e2e.ts（10テスト）

```
test.describe("得意先CRUD（管理者）")
  test.describe.serial("作成・更新・ステータス変更・削除テスト")
    test: 新規得意先を作成できる
    test: 得意先詳細を確認できる
    test: 得意先情報を更新できる
    test: 得意先を無効化できる
    test: 得意先を有効化できる
    test: 得意先を削除できる
  test: 納品先がある得意先は削除できない
  test: 重複する取引先コードでエラーが表示される

test.describe("得意先CRUD（一般ユーザー）")
  test.use({ storageState: "playwright/.auth/user.json" })
  test.describe.serial("一般ユーザーも作成・削除できる")
    test: 一般ユーザーが新規得意先を作成できる
    test: 一般ユーザーが得意先を削除できる
```

#### Serial: 作成・更新・ステータス変更・削除（6テスト）

**1. 新規得意先を作成できる**
- 一覧 → 「新規登録」クリック → `/customers/new`
- h1「得意先登録」の表示確認
- フォーム入力（全フィールド: 取引先コード=CUST901, 名前=E2Eテスト得意先, 郵便番号, 都道府県, 住所, 電話番号, FAX番号, 担当者, マージン率）
- 「登録」→ 一覧にリダイレクト → トースト「得意先を登録しました。」
- 検索で CUST901 が見つかること

**2. 得意先詳細を確認できる**
- `/customers/CUST901` に遷移
- h1「得意先編集」、Badge「有効」、h2「取引先情報」の表示確認
- フォームフィールドの値確認（`#code-display` がdisabled、各入力値が正しい）
- h2「配下の納品先」→「納品先が登録されていません」表示
- ボタン（更新、無効化、削除）が表示されること

**3. 得意先情報を更新できる**
- `/customers/CUST901` → `#code-display` がdisabled確認
- 名前・担当者・マージン率を変更 → 「更新」
- トースト「得意先情報を更新しました。」
- 変更値がフォームに反映されていること

**4. 得意先を無効化できる**
- 「無効化」ボタンクリック → トースト「得意先を無効化しました。」
- Badge「無効」、「有効化」ボタンに切り替わること

**5. 得意先を有効化できる**
- 「有効化」ボタンクリック → トースト「得意先を有効化しました。」
- Badge「有効」に戻ること

**6. 得意先を削除できる**
- 「削除」ボタンクリック → 一覧にリダイレクト → トースト「得意先を削除しました。」
- 検索で CUST901 が見つからないこと

#### 単独テスト（2テスト）

**7. 納品先がある得意先は削除できない**
- シードデータ C001（D001, D002あり）に対して「削除」
- alert表示、ページ遷移しないこと（FK制約エラー）

**8. 重複する取引先コードでエラーが表示される**
- `/customers/new` でコード=C001（既存）を入力 → 「登録」
- alert表示、`/customers/new` に留まること

#### 一般ユーザーテスト（2テスト）

**9. 一般ユーザーが新規得意先を作成できる**
- 一覧 → 「新規登録」が表示されること
- `/customers/new` → 取引先コード=CUST902, 名前を入力 → 「登録」
- トースト「得意先を登録しました。」

**10. 一般ユーザーが得意先を削除できる**
- `/customers/CUST902` → 「削除」ボタンが表示されること
- 「削除」クリック → トースト「得意先を削除しました。」

---

### customers-detail.e2e.ts（3テスト）

```
test.describe("得意先詳細")
  test: パンくずリンクから一覧に戻れる
  test: 配下の納品先リンクから遷移できる
  test: 存在しない得意先コードで404が表示される
```

**1. パンくずリンクから一覧に戻れる**
- `/customers/C001` → 「← 得意先一覧に戻る」クリック → `/customers` へ遷移

**2. 配下の納品先リンクから遷移できる**
- `/customers/C001` → 納品先テーブルの「D001」リンクをクリック
- `/delivery-locations/D001` に遷移すること

**3. 存在しない得意先コードで404が表示される**
- `/customers/NONEXIST` → response status 404

---

## 使用するシードデータ

| コード | 名前 | 用途 | 備考 |
|--------|------|------|------|
| CUST901 | E2Eテスト得意先 | 管理者CRUD serial用（テスト内で作成→削除） | seed不要 |
| CUST902 | E2E一般テスト得意先 | 一般ユーザーserial用（テスト内で作成→削除） | seed不要 |
| C001 | 株式会社山田製作所 | FK制約・パンくず・納品先リンクテスト | 既存seed（納品先D001,D002あり） |

**seed-e2e.ts の変更: 不要**

## 主要参照ファイル

| ファイル | 用途 |
|----------|------|
| `src/app/(features)/departments/departments-crud.e2e.ts` | テスト構造の参考パターン |
| `src/app/(features)/products/products-crud.e2e.ts` | ステータス変更の参考パターン |
| `src/app/(features)/customers/[code]/page.tsx` | 詳細/編集ページ（全ユーザー同一表示） |
| `src/app/(features)/customers/new/CustomerCreateForm.tsx` | 作成フォームのフィールドラベル |
| `src/app/(features)/customers/[code]/CustomerUpdateForm.tsx` | 更新フォーム（`#code-display`） |
| `src/app/_components/redirect-reason-toast.tsx` | トーストメッセージ文言 |

## UIセレクタ早見表

| 操作/要素 | セレクタ |
|-----------|----------|
| 一覧h1 | `getByRole("heading", { name: "得意先一覧" })` |
| 新規登録h1 | `getByRole("heading", { name: "得意先登録" })` |
| 編集h1 | `getByRole("heading", { name: "得意先編集" })` |
| コードdisabled | `page.locator("#code-display")` |
| 新規登録リンク | `getByRole("link", { name: "新規登録" })` |
| パンくず | `getByRole("link", { name: "← 得意先一覧に戻る" })` |
| 検索コード入力 | `getByLabel("コード")` |
| フォーム名前入力 | `getByLabel("名前")` |
| フォームコード入力 | `getByLabel("取引先コード")` |

## 検証方法

```bash
# テストDB初期化（初回のみ）
pnpm e2e:setup

# 得意先E2Eテストのみ実行
pnpm e2e -- --grep "得意先"

# 全E2Eテスト実行（他テストへの影響確認）
pnpm e2e
```
