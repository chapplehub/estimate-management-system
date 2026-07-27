# Next.js 16 proxy.ts での better-auth セッション検証方法の選択

## 概要

Next.js 16 の proxy.ts（旧 middleware.ts）で認証チェックを行う際、どのセッション検証方法を使うべきかを検討し、セキュリティを優先して `auth.api.getSession()` を採用することにした。

## 詳細

### proxy.ts はサーバーサイドで実行される

- proxy.ts（旧 middleware.ts）はサーバーサイド（Node.js/Edge Runtime）で実行される
- クライアントサイドの SDK（`authClient` from `better-auth/react`）は使用不可
- `authClient.getSession()` はブラウザで fetch を使ってサーバーに問い合わせる仕組みなので、サーバーサイドでは動作しない

### better-auth のセッション検証方法（proxy/middleware 用）

| 方法                        | 実行環境         | 特徴                                               |
| --------------------------- | ---------------- | -------------------------------------------------- |
| `getSessionCookie(request)` | サーバー         | Cookie 存在チェックのみ。軽量だがセキュリティは楽観的 |
| `auth.api.getSession()`     | サーバー         | DB 検証。セキュア                                   |
| `authClient.getSession()`   | クライアントのみ | proxy では使用不可                                  |

### 選択肢

- **軽量を優先**: `getSessionCookie(request)` from `better-auth/cookies`
- **セキュリティを優先**: `auth.api.getSession()`（現在の実装）

### 結論

本プロジェクトではセキュリティを優先し、`getCurrentSession()`（内部で `auth.api.getSession()`）を使用する。

### 追記（2026-07-27・ADR-20260727-gk3）

**この選択は「proxy を認証・認可の正本とする」という意味ではない。** 正本は各実行境界（page / Server Action）にあり、proxy は未認証アクセスを早期に弾く前捌きへ降格した。Server Action は matcher の `next-action` 除外（#25）により proxy を通らないため、そもそも proxy だけでは網羅できない。

降格後の役割（前捌き）から見れば、ここでの DB 検証は**余剰であって齟齬ではない**——安全側に外れているだけで、本 ADR と矛盾しない。したがって本ノートの結論は撤回されていない。ただし prefetch のたびに DB を叩く負荷は未計測であり、`getSessionCookie()`（楽観チェック）へ落とすかは実測してから判断する（#648）。

## 参考

- https://www.better-auth.com/docs/integrations/next#nextjs-16-proxy
- https://www.better-auth.com/docs/reference/faq
- `src/proxy.ts` - 現在の実装
- `src/server/shared/auth/better-auth/BetterAuthService.ts` - getCurrentSession の実装
