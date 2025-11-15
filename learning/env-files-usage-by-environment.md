# 環境ごとの .env ファイルの使い分け

## 概要

「本番環境でも `.env.local` を使うのか？」という疑問から、環境ごとに異なる環境変数の設定方法を整理した。

**結論:** 開発環境では `.env.local` を使うが、本番環境ではプラットフォームの環境変数設定機能を使うのが一般的。

---

## 環境ごとの環境変数の設定方法

### 開発環境（ローカルPC）

```
web/
├─ .env.local        # ← これを使う（秘密情報）
└─ .env.example      # テンプレート（Gitにコミット）
```

**設定方法:**
```bash
# .env.local を作成
DATABASE_URL="postgresql://localhost:5432/estimate_dev"
AUTH_SECRET="iDfHPJn0KTe7F4bzUvkRfJZYgAentfv8//Owa44rqls="
```

Next.jsが自動的に読み込む。

---

### 本番環境（Vercel、AWS、Dockerなど）

**重要:** `.env.local` ファイルは存在しない or 使わない

代わりに、**デプロイ先のプラットフォームで環境変数を設定**する。

---

## 本番環境での設定方法（パターン別）

### パターン1: プラットフォームを使う場合（一般的）

```
Vercel / AWS / Docker など
↓
プラットフォームの環境変数設定機能を使う
↓
.env.production ファイルは不要（あっても上書きされる）
```

#### Vercel の場合

```bash
# 方法1: Vercel CLI
vercel env add AUTH_SECRET production
vercel env add DATABASE_URL production

# 方法2: Vercelダッシュボード
# Project Settings → Environment Variables
AUTH_SECRET = "本番用の秘密鍵"
DATABASE_URL = "postgresql://prod-server:5432/..."
```

#### AWS の場合

```bash
# EC2 / ECS
export AUTH_SECRET="本番用の秘密鍵"
export DATABASE_URL="postgresql://..."

# または AWS Systems Manager Parameter Store
aws ssm put-parameter --name /myapp/AUTH_SECRET --value "xxx" --type SecureString
```

#### Docker の場合

```yaml
# docker-compose.yml（推奨）
services:
  app:
    image: my-app
    environment:
      - AUTH_SECRET=${AUTH_SECRET}
      - DATABASE_URL=${DATABASE_URL}
```

または

```bash
# docker run コマンド
docker run \
  -e AUTH_SECRET="本番用の秘密鍵" \
  -e DATABASE_URL="postgresql://..." \
  my-app

# または --env-file（ファイルベース）
docker run --env-file .env.production my-app
```

---

### パターン2: プラットフォームを使わない場合（自前サーバー）

```
自前のサーバー（VPS、オンプレミスなど）
↓
.env.production ファイルを使う
↓
Next.jsが自動的に読み込む
```

**例（自前サーバー）:**

```bash
# デプロイ時に .env.production をサーバーに配置
web/
└─ .env.production  # ← これを使う

# 中身
AUTH_SECRET="本番用の秘密鍵"
DATABASE_URL="postgresql://prod-server:5432/..."
```

または、システムの環境変数として設定（より安全）:

```bash
# ~/.bashrc や /etc/environment に追加
export AUTH_SECRET="xxx"
export DATABASE_URL="yyy"
```

---

## Next.js の環境変数読み込み優先順位

Next.jsは以下の順序で環境変数を読み込む（**後のものが優先**）:

### 開発環境（npm run dev）

```
1. .env                      # 全環境共通
2. .env.development          # 開発環境専用
3. .env.local                # ローカル上書き
4. .env.development.local    # 開発環境 + ローカル上書き（最優先）
```

### 本番環境（npm run build && npm start）

```
1. .env                      # 全環境共通
2. .env.production           # 本番環境専用
3. .env.local                # ローカル上書き（通常は存在しない）
4. .env.production.local     # 本番環境 + ローカル上書き（通常は使わない）
5. プラットフォームの環境変数  # 最優先（Vercel/AWS/Dockerなど）
```

**重要:** プラットフォームが環境変数を設定している場合、**ファイルより優先**される。

---

## なぜ本番環境で .env.local を使わないのか？

### 理由1: セキュリティ
- `.env.local` はファイルなので、Gitにコミットするリスクがある
- 本番環境ではプラットフォームの機密情報管理機能を使う方が安全

### 理由2: デプロイの仕組み
- 本番環境はコードだけデプロイする（ファイルベースの設定は含めない）
- 環境変数はプラットフォームが注入する

### 理由3: 複数インスタンス
- 本番環境は複数サーバーで動くことが多い
- 各サーバーにファイルを配置するより、プラットフォームで一元管理する方が楽

### 理由4: 環境の切り替え
- staging, production など複数環境を簡単に切り替えられる
- ファイルベースだと環境ごとにファイルを管理する必要がある

---

## 実際の使い分け（まとめ）

| 環境 | 環境変数の設定方法 | .env ファイルの使用 |
|------|-------------------|-------------------|
| **開発環境**（ローカルPC） | `.env.local` ファイル | ✅ `.env.local` |
| **本番環境**（Vercel/Netlify/PaaS） | プラットフォームのダッシュボード | ❌ 不要 |
| **本番環境**（AWS/GCP/クラウド） | プラットフォームの環境変数機能 | ❌ 不要（あっても上書きされる） |
| **本番環境**（Docker） | `docker-compose.yml` の `environment` | ❌ 不要（`--env-file` なら使える） |
| **本番環境**（自前サーバー・VPS） | `.env.production` または `export` | ✅ `.env.production` 使える |

---

## このプロジェクトでの構成

### 現在の構成（開発環境）

```
web/
├─ .env.local        # 実際に使う秘密情報（Gitに含めない）
└─ .env.example      # テンプレート（Gitにコミットする）
```

### 本番環境での想定

このプロジェクトは将来的にVercelやAWSなどのプラットフォームにデプロイする想定なので：

```
# 本番環境
- .env.production ファイルは作らない
- Vercel/AWSのダッシュボードで環境変数を設定

例（Vercel）:
AUTH_SECRET = "本番用の秘密鍵"
DATABASE_URL = "postgresql://prod-db-server:5432/estimate_prod"
NEXTAUTH_URL = "https://estimate.example.com"
```

---

## よくある質問

### Q1: .env.production をGitにコミットしてもいい？

**A:** 秘密情報を含まないなら可。含むなら不可。

```bash
# ✅ 公開情報のみ → Gitにコミット可
# .env.production
NEXT_PUBLIC_APP_NAME="見積管理システム"
NEXT_PUBLIC_API_VERSION="v1"

# ❌ 秘密情報を含む → Gitにコミット不可
# .env.production
AUTH_SECRET="本番の秘密鍵"  # ← これはダメ
DATABASE_URL="postgresql://user:pass@..."  # ← パスワード含むのでダメ
```

一般的には、秘密情報を含むので **Gitにコミットしない** のが安全。

### Q2: 開発環境で .env.development を使うべき？

**A:** `.env.local` で十分。

```
.env.local の方がシンプル:
- 秘密情報を一か所に集約
- .env.development は公開情報用（通常は不要）
```

### Q3: .env.local と .env.production の両方を作る？

**A:** いいえ。

- **開発環境**: `.env.local` を作る
- **本番環境**: プラットフォームで設定（ファイルは作らない）

ファイルを作るのは自前サーバーの場合のみ。

### Q4: プラットフォームの環境変数とファイルの優先順位は？

**A:** プラットフォームの環境変数が最優先。

```
優先順位（高い順）:
1. プラットフォームの環境変数（Vercel/AWS/Dockerなど）
2. .env.production.local
3. .env.local
4. .env.production
5. .env
```

プラットフォームを使う場合、ファイルは無視される。

---

## 参考

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [The Twelve-Factor App - III. Config](https://12factor.net/config)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
