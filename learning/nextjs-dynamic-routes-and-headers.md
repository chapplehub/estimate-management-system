# Next.js の動的ルートと headers()/cookies() の関係

作成日: 2025-12-19

## 概要

Next.js App Router で `headers()` や `cookies()` を使用すると、そのルートは自動的に動的ルート（Dynamic Route）になる。これは Next.js の仕様であり、意図した動作である。

## 詳細

### 動的関数とは

Next.js では以下の関数を「動的関数」と呼び、使用するとルートが動的になる:

- `headers()`
- `cookies()`
- `searchParams` prop
- `connection()` (Next.js 15+)

### なぜ動的になるのか

これらの関数は **リクエストごとに異なる値** を返す。

```typescript
// リクエストAのheaders
Cookie: session_token=abc123  // ユーザーA

// リクエストBのheaders
Cookie: session_token=xyz789  // ユーザーB
```

静的ルートはビルド時に1つのHTMLを生成して全ユーザーに配信するが、リクエストヘッダーの内容はビルド時には不明なため、静的生成は不可能。

### 図解

```
静的ルート（○）:
  ビルド時 → HTML生成 → 全ユーザーに同じHTMLを配信

動的ルート（ƒ）:
  リクエスト → headers読み取り → セッション確認 → ユーザーごとにHTML生成
```

### 実例: /employees ページ

```typescript
// page.tsx
const session = await verifySession();        // 内部で headers() を呼び出し
const isAdmin = session.user.role === "ADMIN"; // ユーザーによって異なる

// → 管理者には「新規登録」ボタンが見える
// → 一般ユーザーには見えない
```

呼び出しチェーン:
```
EmployeePage
  └→ verifySession()
       └→ getCurrentSession()
            └→ BetterAuthService.getCurrentSession()
                 └→ headers() ← ここで動的になる
```

### ビルド出力での確認

```
Route (app)
├ ○ /                    ← 静的（Static）
├ ƒ /employees           ← 動的（Dynamic）
├ ƒ /employees/[employeeCd]
└ ○ /signin              ← 静的
```

- `○` = 静的: ビルド時にプリレンダリング
- `ƒ` = 動的: リクエスト時にサーバーレンダリング

### 結論

認証が必要なページで `headers()` を使ってセッションを確認する場合、動的ルートになるのは正しい動作。ユーザーごとに異なるコンテンツを表示する必要があるため、静的にプリレンダリングすることはできない。

## 参考

- 関連ファイル:
  - `src/app/(features)/employees/page.tsx`
  - `src/app/_lib/verifyAuthentication.ts`
  - `src/server/shared/auth/better-auth/BetterAuthService.ts`
- Next.js 公式ドキュメント: Dynamic Functions
