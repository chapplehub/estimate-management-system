# import から require への変換とバンドリングの仕組み

## 概要

Next.js プロジェクトでは、開発時に `import` 文を使ってパッケージを読み込むが、ビルド後のコードでは `require()` が登場する。また、クライアント側のコードはバンドルされてブラウザに配信される。

このドキュメントでは、ビルドプロセスで何が起こるのか、サーバー側とクライアント側でどう違うのかを詳しく説明する。

---

## import と require() の関係

### あなたが書くコード (TypeScript/Modern JavaScript)

```typescript
// app/employees/new/actions.ts
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

export async function createEmployee(formData: FormData) {
  const schema = z.object({ ... })
  // ...
}
```

**この時点では `import` だけ！**

### ビルド後のコード (.next/ ディレクトリ)

```bash
npm run build
```

TypeScript → JavaScript に変換される際、`import` が **`require()` に変換される**（サーバー側コードの場合）

```javascript
// .next/server/app/employees/new/actions.js（ビルド後）
"use strict";
const zod = require('zod')  // ← import が require に変わる
const prisma_1 = require('../../../../generated/prisma')

async function createEmployee(formData) {
  const schema = zod.object({ ... })
  // ...
}

exports.createEmployee = createEmployee;
```

---

## なぜ変換されるのか？

### Node.js のモジュールシステム

Node.js（サーバー側）では、2つのモジュールシステムがあります：

**1. CommonJS (古い方式)**
```javascript
const zod = require('zod')  // 読み込み
module.exports = { ... }     // エクスポート
```

**2. ES Modules - ESM (新しい方式)**
```javascript
import { z } from 'zod'     // 読み込み
export { ... }               // エクスポート
```

### Next.js のビルドプロセス

Next.js は互換性のため、**サーバー側のコードを CommonJS に変換**します：

```
あなたのコード (TypeScript + ESM)
  ↓ ビルド (next build)
サーバー用コード (JavaScript + CommonJS)
```

---

## 実際に確認してみる

### 1. ビルドを実行

```bash
cd web
npm run build
```

### 2. ビルド後のファイルを見る

```bash
# Server Actions のビルド結果を見る
cat .next/server/app/employees/new/page.js
```

**実際の出力例:**

```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// ← ここに require() が並ぶ
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const EmployeeCreateForm_1 = require("./EmployeeCreateForm");

async function Page() {
  return /* ... */;
}

exports.default = Page;
```

**元のコード:**
```typescript
import { redirect } from 'next/navigation'
import { EmployeeCreateForm } from './EmployeeCreateForm'
```

**ビルド後:**
```javascript
const navigation_1 = require("next/navigation");
const EmployeeCreateForm_1 = require("./EmployeeCreateForm");
```

---

## サーバー側とクライアント側の違い

これが最も重要なポイントです。

### サーバー側 (Server Components, Server Actions)

**あなたのコード:**
```typescript
// app/employees/new/actions.ts
'use server'
import { z } from 'zod'
```

**ビルド後:**
```javascript
// .next/server/app/employees/new/actions.js
const zod = require('zod')  // ← require に変換
```

**実行時:**
```bash
NODE_ENV=production npm start
# ↓
# Node.js が .next/server/... のファイルを実行
# ↓
# require('zod') が評価される
# ↓
# node_modules/zod を探す
# ↓
# なければエラー！
```

**重要:** サーバー側は `node_modules/` から直接読み込む

### クライアント側 (Client Components)

**あなたのコード:**
```typescript
// app/employees/new/EmployeeCreateForm.tsx
'use client'
import { useState } from 'react'
```

**ビルド後:**
```javascript
// .next/static/chunks/app_employees_new_page.js
// ← バンドルされた JavaScript（require は使わない）

(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[179],{
  // useState のコード自体がバンドルに含まれる
  3840: function(e, t, n) {
    "use strict";
    function useState(initialState) {
      var dispatcher = resolveDispatcher();
      return dispatcher.useState(initialState);
    }
    // ... React のコードが続く
  },

  // あなたのコンポーネントのコード
  4251: function(e, t, n) {
    "use strict";
    var react = n(3840);  // ← 上の React コードを参照

    function EmployeeCreateForm() {
      var _a = react.useState(""),  // ← useState を使う
          email = _a[0],
          setEmail = _a[1];
      // ...
    }
  }
}]);
```

**重要なポイント:**
- `require('react')` ではなく、`n(3840)` （バンドル内の別のモジュール）を参照
- React のコード自体がバンドルに含まれている
- ブラウザは `node_modules/` にアクセスできない（そもそも送られない）

---

## dependencies の2つの使われ方

```json
{
  "dependencies": {
    "zod": "^3.24.1",           // ← サーバー側で使う
    "react": "^19.0.0",         // ← クライアント側で使う
    "next": "^16.2.2",          // ← 両方で使う
    "@prisma/client": "^6.2.1"  // ← サーバー側だけ
  }
}
```

### サーバー側で必要なパッケージ

```
本番サーバーでの動き:

node_modules/
├── zod/               ← そのまま残る
├── @prisma/client/    ← そのまま残る
└── next/              ← そのまま残る

↓ 実行時

.next/server/app/employees/new/actions.js
→ require('zod')
→ node_modules/zod/ を読み込む ✓
```

**node_modules が必要** - サーバーに配置しておく

### クライアント側で必要なパッケージ

```
ビルド時の動き:

node_modules/
├── react/            ← バンドルに含める
└── react-dom/        ← バンドルに含める

↓ Webpack/Turbopack でバンドル

.next/static/chunks/
├── main-app.js       ← React のコードが埋め込まれる
└── framework.js      ← React DOM のコードが埋め込まれる

↓ ブラウザに配信

<script src="/_next/static/chunks/main-app.js"></script>
```

**バンドルされてブラウザに配信される** - node_modules は不要

---

## 実際のエラーを再現してみる

### 実験: Zod を devDependencies に移動

```bash
cd web

# 1. zod を devDependencies に移動（間違った配置）
npm uninstall zod
npm install -D zod

# 2. ビルド（成功する）
npm run build
# ✓ Compiled successfully

# 3. node_modules を削除
rm -rf node_modules

# 4. 本番環境としてインストール（devDependencies は入らない）
NODE_ENV=production npm install

# 5. zod がインストールされていないことを確認
ls node_modules | grep zod
# （何も表示されない）

# 6. 本番モードで起動
NODE_ENV=production npm start
```

**予想されるエラー:**
```
Error: Cannot find module 'zod'
Require stack:
- /home/chapple/dev/estimate-management-system/web/.next/server/app/employees/new/actions.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1048:15)
    at Module._load (node:internal/modules/cjs/loader:901:27)
```

**エラーメッセージの意味:**
- `Cannot find module 'zod'` - zod が見つからない
- `Require stack` - どのファイルが `require('zod')` しようとしたか
- `.next/server/app/employees/new/actions.js` - ビルド後のファイル

**なぜエラーになるか:**
1. ビルド時（開発環境）は zod があったので、`require('zod')` というコードが生成された
2. 実行時（本番環境）は zod がインストールされていないので、モジュールが見つからない

---

## 図解：本番環境での動き

### サーバー側

```
本番サーバー (Linux VM / Docker コンテナ):

/app/
├── .next/
│   └── server/
│       └── app/
│           └── employees/
│               └── new/
│                   └── actions.js  ← require('zod') を含む
│
├── node_modules/      ← ここに zod が必要！
│   ├── zod/
│   ├── @prisma/client/
│   └── next/
│
└── package.json

実行時:
Node.js が actions.js を実行
→ require('zod')
→ node_modules/zod/ を読み込む
```

### クライアント側（ブラウザ）

```
ユーザーのブラウザ:

HTTP GET /_next/static/chunks/main-app.js
↓
ダウンロード (89KB)
↓
<script>
(function() {
  // React のコード全体が含まれている
  function useState(initialState) { ... }

  // あなたのコンポーネントのコード
  function EmployeeCreateForm() {
    var state = useState("");  // ← バンドル内の useState
  }
})()
</script>

node_modules/ は関係ない（送られてこない）
```

---

## クライアントバンドルの実際

### ビルド後のファイルを確認

```bash
# クライアント用バンドルを見る
ls -lh .next/static/chunks/
```

**出力例:**
```
-rw-r--r-- 1 user user 523K  app-pages.js
-rw-r--r-- 1 user user 185K  framework.js
-rw-r--r-- 1 user user  89K  main-app.js
```

```bash
# React のコードが含まれているか確認
grep -o "useState" .next/static/chunks/main-app.js | head -1
```

**出力:**
```
useState  // ← React のコードが埋め込まれている！
```

### バンドルの中身

```bash
# バンドルファイルの先頭を見る
head -50 .next/static/chunks/main-app.js
```

**実際の内容（簡略化）:**
```javascript
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[179],{
  // React の useState 実装がここに埋め込まれる
  3840: function(e, t, n) {
    "use strict";
    function useState(initialState) {
      var dispatcher = resolveDispatcher();
      return dispatcher.useState(initialState);
    }
    // ... React のコードが続く
  },

  // あなたのコンポーネントのコード
  4251: function(e, t, n) {
    "use strict";
    var react = n(3840);  // ← 上の React コードを参照

    function EmployeeCreateForm() {
      var _a = react.useState(""),
          email = _a[0],
          setEmail = _a[1];
      // ...
    }
  }
}]);
```

---

## まとめ：require() が出てくるタイミング

### タイミング1: ビルド時（next build）

```
あなたのコード:
  import { z } from 'zod'
    ↓ TypeScript コンパイル + Next.js ビルド
ビルド後のサーバーコード:
  const zod = require('zod')
```

### タイミング2: 実行時（npm start）

```bash
NODE_ENV=production npm start
  ↓
Node.js が .next/server/... を実行
  ↓
require('zod') が評価される
  ↓
node_modules/zod/ を探す
  ↓
【ここで dependencies に入ってないとエラー】
```

---

## ビルドプロセスの全体像

```
開発時:
  あなたのコード (import)
  → ビルド (next build)
  → .next/server/... (require に変換済み)
  → 実行 (npm run dev)
  ✓ devDependencies も dependencies も使える

本番時:
  .next/server/... (require に変換済み)
  → node_modules/ (dependencies のみ)
  → 実行 (NODE_ENV=production npm start)
  ✗ devDependencies は使えない
```

---

## 実践的な確認コマンド

### ビルド後のファイルで require を検索

```bash
cd web
npm run build

# zod が require されているか確認
grep -r "require('zod')" .next/server/

# 出力例:
# .next/server/app/employees/new/actions.js:const zod = require('zod')
```

### クライアントバンドルの確認

```bash
# React が含まれているか確認
grep -o "useState" .next/static/chunks/main-app.js | head -1

# バンドルサイズの確認
ls -lh .next/static/chunks/
```

---

## 重要なポイント

1. **あなたは `import` だけ書く**
   - モダンな JavaScript/TypeScript の書き方

2. **Next.js が変換する**
   - サーバー側コード → `require()` (CommonJS)
   - クライアント側コード → バンドルに埋め込み

3. **サーバー側は node_modules が必要**
   - `require()` で直接読み込む
   - `dependencies` に入っていないとエラー

4. **クライアント側はバンドルに含まれる**
   - React などのコードが JavaScript ファイルに埋め込まれる
   - ブラウザには `node_modules` は送られない
   - ただし、ビルド時には `node_modules` が必要なので `dependencies` に必要

---

## 関連ドキュメント

- [dependencies vs devDependencies の判断基準](./dependencies-vs-devdependencies.md)
- Next.js ビルドプロセス: https://nextjs.org/docs/app/building-your-application/deploying
- Node.js モジュールシステム: https://nodejs.org/api/modules.html
