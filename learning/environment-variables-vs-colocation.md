# 環境変数とコロケーションの使い分け

## 概要

「コロケーション（一緒に使うものは一緒のところに置く）」という原則を理解した上で、「なぜ環境変数は一か所で管理するのか？」という疑問が生まれた。

この2つの原則は**相反しない**。それぞれ異なる目的で使い分ける。

---

## 環境変数で管理する理由

### 1. **環境によって値が変わるから**

同じコードを異なる環境で動かすとき、設定値だけ変える必要がある：

```
開発環境: DATABASE_URL="postgresql://localhost:5432/estimate_dev"
本番環境: DATABASE_URL="postgresql://prod-server:5432/estimate_prod"
テスト環境: DATABASE_URL="postgresql://localhost:5432/estimate_test"
```

**原則:** コードは1つ、設定値だけ環境ごとに変える → **環境変数**

### 2. **秘密情報だから**

```typescript
// ❌ コードに直接書く（Gitにコミットされる = 危険）
const DATABASE_URL = "postgresql://user:password123@localhost:5432/db";

// ✅ 環境変数から読む（.env.localはGitに含めない）
const DATABASE_URL = process.env.DATABASE_URL;
```

**原則:** パスワードやAPIキーは **Gitにコミットしてはいけない** → 環境変数で管理

### 3. **デプロイ先で設定を注入できるから**

Vercel、AWS、Dockerなどのデプロイ先は「環境変数を外部から注入する仕組み」を提供している：

```bash
# Vercel CLI
vercel env add DATABASE_URL

# Docker
docker run -e DATABASE_URL="..." my-app
```

**原則:** コードを変更せずに、デプロイ先で設定を上書きできる → **12 Factor Appの原則**

---

## コロケーションとの関係

コロケーション原則は正しいが、**環境変数とは相反しない**。

### コロケーションが適用される例（コードの構造）

```
app/employees/
├─ page.tsx              # 従業員一覧画面
├─ new/
│  └─ EmployeeCreateForm.tsx  # 新規登録フォーム（この画面でしか使わない）
└─ _lib/
   └─ actions.ts         # Server Actions（このfeatureでしか使わない）
```

→ **使う場所の近くに置く**（コロケーション）

**理由:**
- コンポーネント、ヘルパー関数、型定義など **コードの構造**
- 環境によって変わらない
- 特定のfeatureでしか使わない

### 環境変数が適用される例（設定値）

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // ← 環境変数から読む
}
```

→ **値が環境によって変わる**ので、コードに埋め込めない

**理由:**
- DB接続先、APIキー、秘密鍵など **環境によって変わる設定値**
- 秘密情報を含む
- 複数の場所から参照される（アプリ全体で共通）

---

## もし環境変数を使わなかったら？

### ❌ 悪い例：コードに直接書く

```typescript
// infrastructure/database.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://user:pass@localhost:5432/estimate_dev"
    }
  }
});
```

**問題点:**
- 本番環境にデプロイするとき、コードを書き換える必要がある
- パスワードがGitにコミットされる（セキュリティリスク）
- 開発者ごとにDB接続先が違う場合、全員が同じ設定を強制される

### ✅ 良い例：環境変数を使う

```typescript
// infrastructure/database.ts
const prisma = new PrismaClient(); // process.env.DATABASE_URL を自動的に読む
```

**メリット:**
- コードは変更不要
- 秘密情報はGitに含めない
- 各開発者・各環境で異なる設定を使える

---

## 結論：使い分けの基準

| 管理方法 | 対象 | 使い分けの基準 |
|---------|------|---------------|
| **コロケーション**（近くに置く） | コンポーネント、ヘルパー関数、型定義など | **コードの構造** - 特定のfeatureでのみ使う |
| **環境変数**（一か所で管理） | DB接続先、APIキー、秘密鍵など | **環境によって変わる設定値** - 秘密情報を含む |

**両者は相反しない：**
- コード構造 → コロケーション
- 設定値 → 環境変数

**DATABASE_URLを環境変数にする理由まとめ:**
1. 開発・テスト・本番で値が変わる
2. パスワードを含むので秘密情報
3. デプロイ先で外部注入したい
4. アプリ全体で共通して使う（コロケーションの対象外）

---

## 実装例：今回のプロジェクト

### 環境変数ファイルの構成

```
web/
├─ .env                 # Prisma用（基本的に使わない）
├─ .env.local          # 実際に使う秘密情報（Gitに含めない）
├─ .env.example        # テンプレート（Gitにコミットする）
└─ .gitignore          # .env* を除外、.env.example のみ許可
```

### .env.local（実際に使う）

```bash
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/estimate_management_dev?schema=public"
AUTH_SECRET="iDfHPJn0KTe7F4bzUvkRfJZYgAentfv8//Owa44rqls="  # openssl rand -base64 32 で生成
NEXTAUTH_URL="http://localhost:3000"
```

### .env.example（テンプレート）

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/estimate_management_dev?schema=public"
AUTH_SECRET="your-secret-here"  # openssl rand -base64 32 で生成してください
NEXTAUTH_URL="http://localhost:3000"
```

### なぜ2つ必要？

| ファイル | 用途 | Git管理 | 中身 |
|---------|------|---------|------|
| `.env.local` | 実際に使う | **含めない** | 本物の秘密鍵 |
| `.env.example` | テンプレート | **コミットする** | ダミー値（ガイド用） |

**シナリオ:**
1. 新しい開発者がリポジトリをクローン
2. `.env.example` を見る → 「AUTH_SECRETが必要なんだな」と分かる
3. `.env.example` をコピーして `.env.local` を作る
4. `openssl rand -base64 32` で自分の秘密鍵を生成して置き換える

---

## 参考

- [The Twelve-Factor App - III. Config](https://12factor.net/config)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
