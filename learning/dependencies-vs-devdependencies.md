# dependencies vs devDependencies の判断基準

## 概要

npm パッケージをインストールする際、`dependencies` と `devDependencies` のどちらに入れるべきか迷うことがある。この判断を間違えると、本番環境でエラーが発生したり、無駄なパッケージをインストールしてしまう。

このドキュメントでは、正しい判断基準と実践的な確認方法をまとめる。

---

## 基本的な判断基準

### dependencies (本番環境で必要)

**アプリケーションが実行時に必要とするコード**

```bash
npm install <package>  # -D なし
```

- アプリケーションのコードから `import/require` される
- ビルド後の成果物に含まれる、または実行時に必要
- ユーザーがアプリを使う時に動作するために必要

### devDependencies (開発時のみ必要)

**開発・ビルド・テスト時だけ必要なツール**

```bash
npm install -D <package>  # -D あり
```

- 開発中のコード品質・効率化のためのツール
- ビルドプロセスで使われるが、成果物には含まれない
- アプリケーションの実行時には不要

---

## Next.js プロジェクトでの具体例

### dependencies に入れるべきもの

```json
{
  "dependencies": {
    "react": "^19.0.0",           // ✅ アプリ実行時に必要
    "next": "^16.0.0",            // ✅ SSR/APIルートで必要
    "zod": "^3.x",                // ✅ Server Actions/API での検証に必要
    "@prisma/client": "^6.x",     // ✅ DB アクセスに必要
    "bcrypt": "^5.x",             // ✅ パスワードハッシュ化（実行時）
    "next-auth": "^5.x"           // ✅ 認証処理（実行時）
  }
}
```

### devDependencies に入れるべきもの

```json
{
  "devDependencies": {
    "typescript": "^5.x",         // ✅ ビルド時の型チェック
    "eslint": "^9.x",             // ✅ 開発時のリント
    "vitest": "^2.x",             // ✅ テスト実行
    "@types/react": "^19.x",      // ✅ TypeScript 型定義
    "prisma": "^6.x",             // ✅ マイグレーション・スキーマ管理
    "tailwindcss": "^4.x",        // ✅ ビルド時に CSS 生成
    "tsx": "^4.x"                 // ✅ seed スクリプト実行用
  }
}
```

---

## よくある紛らわしいケース

### ケース1: Zod は dependencies？

**結論: dependencies**

```typescript
// app/employees/new/actions.ts (Server Action)
'use server'
import { z } from 'zod'

export async function createEmployee(formData: FormData) {
  // ⚠️ この検証コードは本番環境でも実行される！
  const result = z.object({
    email: z.string().email(),
    name: z.string().min(1)
  }).safeParse({
    email: formData.get('email'),
    name: formData.get('name')
  })

  if (!result.success) {
    return { errors: result.error.flatten() }
  }

  // ... DB 保存処理
}
```

**理由:**
- Server Actions/API Routes は**サーバー側で実行**される
- ユーザーが本番環境でフォーム送信 → サーバーで Zod 検証が走る
- つまり、**本番サーバーで Zod が必要**

### ケース2: Tailwind CSS は devDependencies？

**結論: devDependencies**

```javascript
// tailwind.config.js で使われるが...
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  // ...
}
```

**理由:**
- ビルド時に CSS が生成される
- 生成された CSS ファイルだけが本番環境で配信される
- Tailwind 本体は本番環境で不要

### ケース3: Prisma CLI vs Prisma Client

**結論: 分ける**

```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0"  // ✅ 実行時に DB アクセスが必要
  },
  "devDependencies": {
    "prisma": "^6.0.0"          // ✅ migrate/generate は開発時のみ
  }
}
```

**理由:**
- `prisma`: マイグレーション・スキーマ管理用 CLI ツール
- `@prisma/client`: 実際のクエリ実行ライブラリ

### ケース4: TypeScript 型定義

**結論: devDependencies**

```json
{
  "devDependencies": {
    "@types/node": "^20.x",     // ✅ ビルド時の型チェックのみ
    "@types/react": "^19.x"     // ✅ .d.ts ファイルは成果物に不要
  }
}
```

**理由:**
- TypeScript はビルド時に JavaScript にトランスパイルされる
- 型情報は実行時には存在しない

---

## 判断フローチャート

```
このパッケージは...

1. アプリケーションコード (src/) から import される？
   YES → 次の質問へ
   NO  → devDependencies

2. Server Actions / API Routes / サーバーコンポーネントで使われる？
   YES → dependencies (サーバー実行時に必要)
   NO  → 次の質問へ

3. クライアント側コンポーネントで使われる？
   YES → dependencies (ブラウザで実行)
   NO  → devDependencies

特殊ケース:
- テストコードだけで使う → devDependencies
- ビルドツール（ESLint, Prettier等） → devDependencies
- 型定義 (@types/*) → devDependencies
```

---

## 実践的な確認方法

### npm install の挙動の違い

**開発環境:**
```bash
npm install  # または npm ci
```
- `dependencies` のパッケージ ✅
- `devDependencies` のパッケージ ✅
- **両方インストールされる**

**本番環境:**
```bash
npm install --production
# または
NODE_ENV=production npm install
```
- `dependencies` のパッケージ ✅
- `devDependencies` のパッケージ ❌
- **dependencies だけインストールされる**

### 本番環境をシミュレートして確認

```bash
# 1. ビルド
npm run build

# 2. node_modules を削除
rm -rf node_modules

# 3. 本番環境としてインストール
NODE_ENV=production npm install

# 4. 本番モードで起動
NODE_ENV=production npm start
```

**もしエラーが出たら:**
```
Error: Cannot find module 'パッケージ名'
```

→ **そのパッケージは `dependencies` に入れるべき**

**エラーが出なければ:**
→ **`devDependencies` のままでOK**

---

## なぜこの方法で判断できるのか

### 本番環境では devDependencies がインストールされない

本番サーバーでは以下の理由で `devDependencies` をインストールしない：
- ディスク容量の節約
- セキュリティリスクの軽減（不要なパッケージを減らす）
- デプロイ速度の向上

### 実行時に必要なものはエラーになる

- ビルド時には両方の依存関係が使える
- 実行時に `require()` や `import` でパッケージを読み込む
- その時にパッケージがないとエラー

### ビルド時だけ必要なものはコンパイル済みコードに含まれる

- TypeScript → JavaScript に変換済み
- Tailwind → CSS に変換済み
- 実行時には不要

---

## まとめ

### 簡単な覚え方

**実行時に必要 = dependencies**
- Server Actions/API Routes のロジック
- クライアントコンポーネントのライブラリ
- DB クライアント、認証ライブラリ

**開発・ビルド時のみ = devDependencies**
- TypeScript コンパイラ
- リント・フォーマッター
- テストツール
- 型定義ファイル

### 迷ったら

1. まず `-D` でインストールしてみる
2. `npm run build` → 成功するはず
3. 本番環境をシミュレート
   ```bash
   rm -rf node_modules
   NODE_ENV=production npm install
   NODE_ENV=production npm start
   ```
4. エラーが出たら `dependencies` に移動

---

## 関連ドキュメント

- [import から require への変換とバンドリングの仕組み](./import-to-require-and-bundling.md)
- Next.js 公式ドキュメント: https://nextjs.org/docs
- npm 公式ドキュメント: https://docs.npmjs.com/
