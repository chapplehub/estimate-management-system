# Issue #478: ダッシュボードに共通販売単価一覧へのアクセスポイントを作る — 実装計画

## 概要

#477 で共通売単価マスタのフロント保守画面（`/common-selling-prices`）が追加されたが、ダッシュボード（`src/app/(features)/dashboard/page.tsx`）の `navigationItems` 配列に未登録のため、画面への導線がない。本 Issue では、ダッシュボードのナビゲーションカードに「共通販売単価管理」を1件追加し、ユーザーが一覧画面へ到達できるようにする。

ダッシュボードは共通メニュー定義ファイルを持たず、`page.tsx` 内の静的配列 `navigationItems`（`{ href, title, description }`）が単一の真実源で、JSX 側は `.map` でカードを描画している。よって追加は配列に1要素足すだけで、描画ロジックは一切変更不要。

## 設計判断

### カードのタイトル文言
- A. 共通売単価管理（既存メニューの「〜管理」体・#477コミット名の「共通売単価マスタ」と整合）
- B. 共通販売単価管理（Issueタイトルの「共通販売単価」表記に寄せる）
- 決定: **B「共通販売単価管理」**（ユーザー確認済み）

### 配列内の挿入位置
- 単価は商品に紐づくため、商品管理（`/products`）の直後に挿入。（ユーザー確認済み）

### E2E テストの範囲
- 共通売単価画面自体の E2E は本 Issue では作らず、ダッシュボードからの遷移確認のみ `dashboard.e2e.ts` に1ケース追加。（ユーザー確認済み）

## ステップ

### Step 1: ダッシュボードに共通販売単価管理カードを追加
- 対象ファイル: `src/app/(features)/dashboard/page.tsx`
- 作業内容:
  - `navigationItems` 配列の商品管理（`/products`、L25-29）要素の直後に以下を挿入:
    ```ts
    {
      href: "/common-selling-prices",
      title: "共通販売単価管理",
      description: "共通販売単価の一覧表示・編集を行います。",
    },
    ```
  - JSX（`.map` 描画）は変更不要。
- コミットメッセージ: `feat: ダッシュボードに共通販売単価一覧へのアクセスポイントを追加 (#478)`

### Step 2: ダッシュボードからの遷移 E2E を追加
- 対象ファイル: `src/app/(features)/dashboard/dashboard.e2e.ts`
- 作業内容:
  - 既存「ダッシュボード」`describe` 内に、共通販売単価一覧への遷移を確認するテストを1件追加（既存の従業員管理テストと同パターン）:
    - `getByRole("link", { name: "共通販売単価管理" })` が表示されることを確認
    - クリックして `/common-selling-prices` へ遷移することを確認（`toHaveURL(/\/common-selling-prices/)`)
    - 遷移後、一覧画面の見出し `getByRole("heading", { name: "共通売単価" })`（`common-selling-prices/page.tsx` L55 の h1）が表示されることを確認
- コミットメッセージ: `test: ダッシュボードから共通販売単価一覧への遷移E2Eを追加 (#478)`

## 検証

1. `pnpm lint` でリンタ通過を確認。
2. `pnpm dev` で起動し、`/dashboard` に「共通販売単価管理」カードが商品管理の直後に表示され、クリックで `/common-selling-prices` へ遷移することを目視確認。
3. `pnpm e2e`（テストデータ再シード + E2E実行）で `dashboard.e2e.ts` の追加ケースを含め全ケース green を確認。

## 補足

- 認証は既存どおり `verifySession()` のみ（一覧画面側もロール制御なし）。本 Issue で権限分離は扱わない。
- 作業完了時、計画からの逸脱があれば `docs/claude-plans/issue-478/deviations.md` に記録する。
