# OpenSSL とは何か

## 概要

**OpenSSL** は暗号化・復号化・証明書管理などを行うオープンソースのツールキット。

- **正式名称**: OpenSSL (Open Secure Sockets Layer)
- **機能**: SSL/TLS プロトコルの実装 + 汎用暗号化ライブラリ
- **ライセンス**: Apache License 2.0（オープンソース）
- **対応OS**: Linux, macOS, Windows など
- **標準搭載**: ほとんどのUnix系OSに標準でインストール済み

## 主な用途

### 1. ランダムデータ生成（秘密鍵・トークン）

```bash
# 32バイトのランダムデータをBase64エンコード
openssl rand -base64 32
# → Xy7jK3mN9pQr2sT8vW1aZ4bC6dE0fG5hI8jL1mN4oP7=

# 64バイトのランダムデータを16進数で出力
openssl rand -hex 64
```

**用途:**
- Auth.js の `AUTH_SECRET`
- JWT のシークレットキー
- セッション暗号化キー
- APIトークン

### 2. ファイルの暗号化・復号化

```bash
# AES-256-CBCで暗号化
openssl enc -aes-256-cbc -in file.txt -out file.enc

# 復号化
openssl enc -d -aes-256-cbc -in file.enc -out file.txt
```

### 3. ハッシュ値の計算

```bash
# SHA-256ハッシュ
openssl dgst -sha256 file.txt

# MD5ハッシュ
openssl dgst -md5 file.txt
```

### 4. SSL/TLS証明書の管理

```bash
# 自己署名証明書の作成（開発用）
openssl req -new -x509 -days 365 -key private.key -out cert.crt

# 証明書の内容確認
openssl x509 -in cert.crt -text -noout

# ローカル開発用証明書を一発で作成
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### 5. 公開鍵・秘密鍵ペアの生成

```bash
# RSA秘密鍵（2048ビット）
openssl genrsa -out private.key 2048

# 公開鍵を抽出
openssl rsa -in private.key -pubout -out public.key
```

### 6. パスワードハッシュ生成

```bash
# SHA-512でパスワードをハッシュ化
openssl passwd -6 "mypassword"
```

## Web開発での典型的な使用例

### 1. Next.js / Auth.js のセットアップ

```bash
# .envファイル用の秘密鍵生成
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
```

### 2. HTTPS開発環境の構築

```bash
# localhost用の自己署名証明書
openssl req -x509 -newkey rsa:4096 \
  -keyout localhost-key.pem \
  -out localhost-cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

### 3. JWT秘密鍵の生成

```bash
# 長めの秘密鍵（512ビット）
openssl rand -hex 64
```

## なぜ標準搭載されているか

1. **インターネット通信の基盤**
   - HTTPS通信に必須
   - すべてのWebブラウザ、サーバーが依存

2. **システムレベルの暗号化**
   - OS自体が暗号化機能に依存
   - SSH、VPN、ディスク暗号化などで使用

3. **開発ツールとして汎用的**
   - 証明書、鍵、ハッシュなど様々な用途
   - プログラミング言語のライブラリとしても使用される

## このプロジェクト（estimate-management-system）での利用

### 現在の利用

1. **環境変数の秘密鍵生成**
   ```bash
   openssl rand -base64 32  # AUTH_SECRET用
   ```

### 将来的な利用（想定）

1. **開発用SSL証明書の作成**
   - ローカルでHTTPS化する場合

2. **APIトークンの生成**
   - 外部API連携時のトークン生成

3. **データ暗号化**
   - 機密データのファイル暗号化

## コマンドリファレンス

### よく使うコマンド一覧

| コマンド | 用途 | 例 |
|---------|------|-----|
| `openssl rand` | ランダムデータ生成 | `openssl rand -base64 32` |
| `openssl enc` | ファイル暗号化・復号化 | `openssl enc -aes-256-cbc -in file.txt` |
| `openssl dgst` | ハッシュ値計算 | `openssl dgst -sha256 file.txt` |
| `openssl req` | 証明書要求作成 | `openssl req -new -key private.key` |
| `openssl x509` | 証明書操作 | `openssl x509 -in cert.crt -text` |
| `openssl genrsa` | RSA秘密鍵生成 | `openssl genrsa -out private.key 2048` |
| `openssl passwd` | パスワードハッシュ | `openssl passwd -6 "password"` |

## 参考

- 公式サイト: https://www.openssl.org/
- ドキュメント: https://www.openssl.org/docs/
- よくある使い方: https://www.openssl.org/docs/manmaster/man1/
