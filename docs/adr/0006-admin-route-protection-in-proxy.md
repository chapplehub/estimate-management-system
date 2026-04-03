# ADR-0006: 管理者専用ルートの認可チェックをproxy.tsで行う

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-03-26 |
| 最終更新日 | 2026-03-26 |

## コンテキスト

`/employees/new`（従業員新規作成画面）は管理者のみがアクセスすべきページだが、ページレベルの認可チェックがなく、一般ユーザーでもアクセスできてしまっていた。Server Action（`createEmployeeAction`）内では`verifyAdmin()`で認可チェックしているため、実際のデータ作成は防がれるが、フォーム画面自体が表示される状態だった。

## 検討した選択肢

### A. `proxy.ts`に管理者専用ルートを定義する（採用）

```typescript
const adminRoutes = ["/employees/new"];

if (session && adminRoutes.includes(path) && !isAdmin(session)) {
  return NextResponse.redirect(new URL(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`, request.url));
}
```

### B. `page.tsx`で`verifyAdmin()`を呼ぶ（不採用）

```typescript
// src/app/(features)/employees/new/page.tsx
export default async function EmployeeNewPage() {
  await verifyAdmin();
  // ...
}
```

### C. `layout.tsx`で`verifyAdmin()`を呼ぶ（不採用）

```typescript
// src/app/(features)/employees/layout.tsx
export default async function EmployeesLayout({ children }) {
  // ルートに応じた認可チェック
}
```

## 決定

`proxy.ts`に管理者専用ルートの配列を定義し、認可チェックを行う。

## 根拠

### 認証/認可の一貫性

proxy.tsは既に認証チェック（未ログインユーザーのリダイレクト）を担っている。認可チェック（権限のないユーザーのリダイレクト）も同じレイヤーに置くことで、リクエストの認証・認可フローが一箇所で完結する。

```
リクエスト → proxy.ts（認証 + 認可） → ページレンダリング
```

### ページレンダリング前にブロックできる

proxy.ts（Next.js 16のミドルウェア相当）はページのServer Componentが実行される前に動作する。不正なアクセスをページレンダリングの前段でブロックでき、不要なDB問い合わせやコンポーネントのレンダリングが発生しない。

### 不採用理由

- **選択肢B（page.tsx）**: 各ページに`verifyAdmin()`を追加する必要があり、管理者専用ページが増えるたびに追加漏れのリスクがある。また、ページのレンダリングが開始された後にリダイレクトするため、無駄な処理が発生する
- **選択肢C（layout.tsx）**: employeesのlayout.tsxは一覧・詳細・新規作成で共有されるが、一覧と詳細は一般ユーザーもアクセス可能であり、layoutレベルでの一律チェックは不適切。ルートに応じた条件分岐をlayoutに入れると責務が複雑化する

## 影響

- 管理者専用ルートを追加する際は`proxy.ts`の`adminRoutes`配列に追加するだけでよい
- Server Action内の`verifyAdmin()`は多層防御として引き続き残す（proxyをバイパスされた場合の安全策）
