# 認証サービスの責務分離と変更容易性

## 概要

認証サービスを設計する際の責務分離と、変更容易性に関する設計判断についての学び。

## 1. 認証操作とセッション読み取りの区分

認証サービスには性質の異なる2つの責務がある：

### 認証操作（signIn/signOut）

| 特性 | 説明 |
|------|------|
| 性質 | 状態変更を伴う操作 |
| セキュリティ重要度 | 高い（認証フロー、クッキー設定など） |
| 推奨実装 | Server Action経由でサーバーサイドに閉じる |
| 抽象化 | IAuthServiceで抽象化する価値が高い |

### セッション情報の読み取り（getCurrentSession/useSession）

| 特性 | 説明 |
|------|------|
| 性質 | 読み取り専用（表示目的） |
| セキュリティ重要度 | 低い（既に認証済みの情報を読むだけ） |
| 推奨実装 | 用途に応じて使い分け |
| 抽象化 | シンプルなファサードで十分 |

### セッション読み取りの使い分け

```
【Server Component / Server Action】
- getCurrentSession() を使用（サーバーサイド）
- 注意: headers()を呼ぶため動的レンダリングになる

【Client Component（表示用）】
- useSession() を使用（クライアントサイド）
- 静的レンダリング（フルルートキャッシュ）を維持できる
```

### フルルートキャッシュとの関係

レイアウトでgetCurrentSession()を呼ぶと：
- 内部でheaders()が呼ばれる
- そのレイアウト配下のすべてのルートが動的レンダリングになる
- Next.jsのフルルートキャッシュが無効になる

解決策：
- ユーザー名表示などの「表示用読み取り」はClient Componentでusessionを使う
- レイアウト自体は静的なまま保てる

## 2. 認証技術と変更容易性

### 層による影響範囲の違い

| コンポーネント | 層 | 変更時の影響 |
|--------------|-----|-------------|
| セッション管理、DB操作 | インフラ層 | 大（ビジネスロジック全体） |
| signIn/signOut | アプリケーション層 | 中（ユースケース） |
| useSession（表示用） | プレゼンテーション層 | 小（UIコンポーネント数箇所） |

### 設計判断

**サーバーサイド（認証操作）**:
- IAuthServiceによる抽象化は価値が高い
- 認証技術の変更時、実装クラスの差し替えで対応可能
- インターフェースを維持することで呼び出し側への影響を最小化

**クライアントサイド（表示用読み取り）**:
- 過度な抽象化（インターフェース定義など）は不要
- シンプルなファサードで十分
- 変更時の影響範囲が限定的なため

### 推奨パターン

```typescript
// src/app/_lib/auth-client.ts
// シンプルなファサード（1ファイルに実装詳細を閉じ込める）
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export const useSession = authClient.useSession;
```

これにより：
- 呼び出し側は `import { useSession } from "@/app/_lib/auth-client"` のみ
- better-authの実装詳細は1ファイルに閉じ込められる
- 認証技術移行時はこのファイルだけ変更すれば良い

## 結論

- **認証操作**: サーバーサイドに集約 + IAuthServiceで抽象化（変更容易性を確保）
- **表示用読み取り**: クライアントSDK + シンプルなファサード（過剰な抽象化は不要）
- 責務の性質に応じて適切な抽象化レベルを選択することが重要

## 関連ファイル

- `src/server/shared/auth/index.ts` - 認証サービス公開API
- `src/server/shared/auth/IAuthService.ts` - 認証サービスインターフェース
- `src/app/_lib/auth-client.ts` - クライアント用ファサード（新規作成）
- `learning/auth-onion-architecture.md` - 関連する設計判断
