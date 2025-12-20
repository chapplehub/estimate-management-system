# Next.js 16 proxy.ts で Server Action リクエストをリダイレクトすると失敗する問題

## 概要

Next.js 16 の `proxy.ts`（旧 `middleware.ts`）で認証チェックを行い、未認証時に `NextResponse.redirect()` を返すと、**Server Action リクエストの場合にクライアント側でエラーが発生する**。

## エラー内容

```
Error: An unexpected response was received from the server.
```

## 原因

1. Server Action リクエストは `next-action` ヘッダーを持つ POST リクエストとして送信される
2. proxy.ts が `NextResponse.redirect()` を返すと、通常の HTTP リダイレクトレスポンスが返される
3. クライアント側の Server Action ハンドラーは特定の形式（ActionResult など）のレスポンスを期待している
4. HTTP リダイレクトレスポンスはこの形式と異なるため、パースに失敗する

### Server Action 内の redirect() が動く理由

Server Action 内で `redirect()` を呼ぶと、Next.js は **特殊な形式** でレスポンスを返す。クライアントはこの形式を理解してリダイレクトを実行できる。

しかし、proxy からの `NextResponse.redirect()` は**通常の HTTP リダイレクト**であり、Server Action クライアントが処理できない形式。

## 解決策

### 推奨: config.matcher の missing オプションを使用

```typescript
// src/proxy.ts
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|.*\\.png$).*)",
      missing: [
        { type: "header", key: "next-action" }, // Server Action を除外
      ],
    },
  ],
};
```

この方法の利点：
- Next.js の標準パターンに沿っている
- matcher レベルで除外されるため、proxy 関数自体が呼ばれない（効率的）
- 関数内のロジックがシンプルに保たれる

### 代替案: 関数内でヘッダーをチェック

```typescript
export async function proxy(request: NextRequest) {
  // Server Action リクエストはスキップ
  const isServerAction = request.headers.has("next-action");
  if (isServerAction) {
    return NextResponse.next();
  }

  // 通常の認証チェック
  const session = await getCurrentSession();
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(...);
  }
  return NextResponse.next();
}
```

## Server Action での認証チェック

proxy をスキップした Server Action では、Action 内で認証チェックを行う：

```typescript
// Server Action
export async function updateEmployee(...) {
  // 認証チェック - ここで redirect() を呼ぶのは OK
  await verifyOwnerOrAdmin(id);

  // ビジネスロジック
  // ...
}
```

Server Action 内の `redirect()` は正しい形式でレスポンスを返すため、クライアントが正常に処理できる。

## 参考

- [Next.js Discussion #64993](https://github.com/vercel/next.js/discussions/64993#discussioncomment-9286572) - 同様の問題が報告されている
- `src/proxy.ts` - 現在の実装
- `src/app/_lib/verifyAuthentication.ts` - Server Action 内での認証チェック
