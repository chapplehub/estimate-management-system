# better-auth 認証フローと 401 エラーの原因調査

## 概要

better-auth を使用したログイン処理で 401 UNAUTHORIZED が返される問題を調査。原因はパスワードが平文で保存されていたこと。調査の過程で better-auth の認証フローと Next.js App Router の Route Handler の仕組みを理解した。

## 認証フローの全体像

```
signin-form.tsx (UI)
    │
    │ authClient.signIn.email() を呼び出し
    ▼
auth-client.ts (クライアントSDK)
    │
    │ POST /api/auth/sign-in/email を送信
    ▼
src/app/api/auth/[...all]/route.ts (ルーティング入り口)
    │
    │ Next.js が POST 関数を自動実行
    ▼
src/server/auth.ts (better-auth 設定・認証ロジック)
    │
    ▼
PostgreSQL (user, account テーブル)
```

## Next.js App Router の Route Handler

### `[...all]` キャッチオールルート

`src/app/api/auth/[...all]/route.ts` の `[...all]` は Next.js のキャッチオールルート。

```
/api/auth/sign-in/email  → route.ts が処理
/api/auth/sign-up/email  → route.ts が処理
/api/auth/sign-out       → route.ts が処理
/api/auth/session        → route.ts が処理
```

すべてのパスが同じ `route.ts` に到達し、better-auth がURLパスを解析して適切な処理を実行する。

### `export const { POST, GET }` の意味

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

これは **Next.js App Router の規約**:

- `route.ts` で `GET`, `POST`, `PUT`, `DELETE` などの名前で関数をエクスポートする
- Next.js が対応する HTTP メソッドのリクエストを**自動的に**その関数にルーティングする
- 明示的な呼び出しやインポートは不要

```typescript
// toNextJsHandler(auth) は以下のようなオブジェクトを返す
{
  GET: async (request) => { /* better-authの処理 */ },
  POST: async (request) => { /* better-authの処理 */ }
}
```

## 401 エラーの原因

### 問題

account テーブルの `password` フィールドに平文パスワード（`pass123!`）が保存されていた。

### なぜ 401 になったか

better-auth は内部で `verifyPassword()` を使用してハッシュ比較を行う:

```typescript
// better-auth 内部の処理イメージ
const isValid = await verifyPassword({
  hash: account.password,  // DBから取得した値（平文だった）
  password: inputPassword  // ユーザー入力
});
```

平文はハッシュ形式ではないため、比較に失敗して 401 が返された。

### 解決策

`prisma/seed.ts` を修正し、`better-auth/crypto` の `hashPassword` 関数を使用:

```typescript
import { hashPassword } from "better-auth/crypto";

const hashedPassword = await hashPassword("pass123!");

await tx.account.create({
  data: {
    // ...
    password: hashedPassword,  // ハッシュ化されたパスワード
  },
});
```

## 教訓

1. **認証ライブラリのパスワード保存方式を理解する**: better-auth は自動的にハッシュ化を行うため、手動でDBにデータを挿入する場合も同じハッシュ関数を使用する必要がある

2. **seed スクリプトは認証ライブラリの API を使用する**: 可能であれば `auth.api.signUpEmail()` を使用するか、少なくとも `hashPassword()` を使用する

3. **Next.js Route Handler の規約を理解する**: `export const GET/POST` は Next.js が自動でルーティングする仕組み

## 参考

- 関連ファイル:
  - `src/app/api/auth/[...all]/route.ts`
  - `src/server/auth.ts`
  - `src/app/_lib/auth-client.ts`
  - `src/app/auth/signin-form.tsx`
  - `prisma/seed.ts`
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [better-auth ドキュメント](https://www.better-auth.com/docs)
