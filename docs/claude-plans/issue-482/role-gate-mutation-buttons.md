# Issue #482: 共通売単価 保守画面 — 一般ユーザーに編集系ボタンを表示しない（role 出し分け） — 実装計画

## Context

共通売単価 保守画面の詳細（`/common-selling-prices/[productCd]`）では、ミューテーション系ボタン
（新規追加 / 編集 / 適用終了 / 削除）が **role に関係なく常時表示**されている。一般ユーザーが押すと
サーバーアクションの `verifyAdmin()` が `redirect("/signin?reason=forbidden")` で弾くため操作自体は
防げているが、「押せるのに弾かれる」UX になっている。

ADR-0020 判断5 は「一般ユーザー用の閲覧画面でも編集系ボタンが表示されないこと」を必須としており、
現状はこの要件を満たしていない。本 Issue でフロント側のボタン出し分けを追加し、要件を満たす。
認可の正本はサーバー側 `verifyAdmin()`（変更しない＝二重防御の維持）、フロントの出し分けは UX 補助。

関連: #481（E2E テスト）は本修正の完了を前提に書くため、本 Issue を先行させる。

## 設計判断

### isAdmin の導出と受け渡し方式
- 既存パターン踏襲のため判断不要。`departments/[departmentCd]/page.tsx:12,22` と同様に
  `const session = await verifySession();` → `isAdmin(session)` で導出し、
  client wrapper（`PeriodDetailPanel`）に boolean prop として渡す。
- `verifySession()` は `cache()` 済み（`src/app/_lib/verifyAuthentication.ts:15`）のため、
  現状の `await verifySession()`（戻り値破棄）を「戻り値受け取り」に変えても追加コストなし。

### 非管理者時の「操作」列の扱い
- **列ごと非表示にする**（ユーザー確認済み）。
- 非管理者では `操作` 列の `<th>` と各行の `<td>` を描画しない。全行が `—` になる列を残さず、
  閲覧専用としてスッキリさせる。`新規追加` ボタン（パネルヘッダ）も非表示にする。

### 下流コンポーネントへの role 伝播
- 不要。`PeriodForm` / `PeriodDeleteConfirm` は `PeriodDetailPanel` 内のボタン経由でしか
  `mode` が遷移せず開けない。ボタンを描画しなければフォームも到達不能。prop 追加は
  `PeriodDetailPanel` のみで閉じる。

## ステップ

### Step 1: 詳細ページで isAdmin を導出し PeriodDetailPanel へ渡す
- 対象ファイル: `src/app/(features)/common-selling-prices/[productCd]/page.tsx`
- 作業内容:
  - `import { isAdmin } from "@server/shared/auth";` を追加
  - `await verifySession();` を `const session = await verifySession();` に変更
  - `const admin = isAdmin(session);` を算出（関数名 `isAdmin` と衝突するため変数名は `admin`）
  - `<PeriodDetailPanel detail={detail} />` を `<PeriodDetailPanel detail={detail} isAdmin={admin} />` に変更
- コミットメッセージ: `fix: 共通売単価詳細ページで管理者判定を PeriodDetailPanel に渡す (#482)`

### Step 2: PeriodDetailPanel で非管理者時にミューテーション UI を非表示
- 対象ファイル: `src/app/(features)/common-selling-prices/[productCd]/PeriodDetailPanel.tsx`
- 作業内容:
  - `Props` に `isAdmin: boolean` を追加し、関数引数で受け取る
  - パネルヘッダの `新規追加` ボタンを `isAdmin && (...)` で条件描画
  - テーブルヘッダの `操作` `<th>` を `isAdmin && (...)` で条件描画
  - 各行の `操作` `<td>`（`PeriodDeleteConfirm` 分岐・編集/適用終了/削除ボタン・`—` 表示を含む全体）を `isAdmin && (...)` で条件描画
  - `auth = authorityFor(...)` や `mode` ロジックは温存（非管理者では UI が出ないため影響なし）
- コミットメッセージ: `fix: 共通売単価 保守画面で一般ユーザーに編集系ボタンを表示しない (#482)`

## 変更しないもの（明示）

- `[productCd]/actions.ts` の各アクション冒頭 `verifyAdmin()` — 認可の正本として維持（二重防御）。
- `PeriodForm.tsx` / `PeriodDeleteConfirm.tsx` — props 変更なし。
- E2E / 単体テスト — 本 Issue では追加しない（「ボタン非表示」テストは #481 の範囲）。

## 受け入れ条件との対応

- [ ] 一般ユーザーで詳細画面 → `新規追加`・`操作` 列ごと非表示（閲覧のみ） … Step 1 + Step 2
- [ ] 管理者では従来どおり全ボタンが状態別（`authorityFor`）に表示 … `isAdmin && (...)` 条件のみ追加で既存挙動温存
- [ ] サーバー側 `verifyAdmin()` 維持 … 変更しない

## 検証方法

1. `pnpm lint` / `pnpm build`（型エラー確認: `isAdmin` prop の追加・必須化）
2. dev server + Playwright MCP（`/verify-frontend` 手順）で実機確認:
   - 管理者ログイン → `/common-selling-prices/{productCd}` → `新規追加`・各行の編集/適用終了/削除が状態別に表示
   - 一般ユーザーログイン → 同画面 → `新規追加` ボタン・`操作` 列（ヘッダ＋セル）が一切非表示、商品情報・適用期間明細は閲覧可能
3. （参考）一般ユーザーで万一サーバーアクションを直接叩いても `verifyAdmin()` の redirect が効くこと＝二重防御の維持
