# 認証機能とオニオンアーキテクチャ

## 概要

フロントエンド(app/)とバックエンド(server/)を分離したモノレポ構成において、認証機能をオニオンアーキテクチャに準拠させる際の設計判断と実装方法について学んだ。

## 背景・問題点

### 元の状況
- フロントエンドはUIのみ、データ取得・更新はserver側のApplication層を呼ぶ設計
- 認証機能で `authClient.signIn.email()` をフロントエンドから直接呼んでいた

### 問題点
1. **実装詳細の漏洩**: フロントエンドに Better Auth の実装詳細が漏れていた
2. **設計の不整合**: 他の操作は Server Action → Application層 経由なのに、認証だけ直接API呼び出し

## 解決策

### ディレクトリ構造

認証サービスを `server/shared/auth/` に集約：

```
src/server/shared/auth/
├── index.ts                     # 公開API（getCurrentSession, signIn, signOut）
├── types.ts                     # AuthSession, AuthUser 型定義
├── IAuthService.ts              # インターフェース
└── better-auth/
    ├── auth.ts                  # Better Auth 設定（公式ドキュメント準拠の命名）
    └── BetterAuthService.ts     # IAuthService の実装
```

### 設計判断

#### 1. 認証は「横断的関心事」
- 特定のサブドメインではなく、全サブドメインが使う共有サービス
- `server/subdomains/auth/` ではなく `server/shared/auth/` に配置

#### 2. インターフェースによる抽象化
- `IAuthService` でメソッドを定義
- `BetterAuthService` で Better Auth 固有の実装
- フロントエンドは公開API（`getCurrentSession`, `signIn`, `signOut`）のみ使用

#### 3. Server Action 経由の認証
- フロントエンド → Server Action → 認証サービス
- `nextCookies` プラグインで Server Action 内でクッキー自動設定
- クライアントSDK（authClient）は不要に

#### 4. auth インスタンスの非公開化
- `index.ts` から `auth` をエクスポートしない
- `/api/auth/*` の route.ts も不要になる可能性（要検証）
- 完全に実装詳細を隠蔽

### 認証フローの変化

```
【Before】
フロントエンド
    → authClient.signIn.email()  ← Better Auth の実装詳細が漏れている
    → /api/auth/sign-in/email
    → Better Auth

【After】
フロントエンド
    → Server Action (signinAction)
    → signIn() (公開API)
    → auth.api.signInEmail() (内部で隠蔽)
    → Better Auth + nextCookies でクッキー自動設定
```

## ファイル命名規則

- Better Auth の設定ファイルは公式ドキュメントに準拠して `auth.ts` とする（`config.ts` ではない）

## 注意点

- OAuth/ソーシャルログイン、メール検証、パスワードリセット等を将来実装する場合は `/api/auth/*` エンドポイントが必要になる可能性がある
- その場合でも `auth` インスタンス自体は公開せず、必要なハンドラーのみをエクスポートする設計を検討する

## 参考

- 関連ファイル:
  - `src/server/shared/auth/index.ts`
  - `src/server/shared/auth/IAuthService.ts`
  - `src/server/shared/auth/better-auth/auth.ts`
  - `src/server/shared/auth/better-auth/BetterAuthService.ts`
  - `src/app/(features)/(auth)/signin/actions.ts`
- [Better Auth ドキュメント](https://www.better-auth.com/docs)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
