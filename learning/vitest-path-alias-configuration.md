# Vitestでのパスエイリアス設定

## 問題

Vitestでテストを実行したときに、以下のエラーが発生しました：

```
Error: Cannot find package '@/shared/errors/DomainError' imported from '/home/chapple/dev/estimate-management-system/web/src/domain/valueObjects/__tests__/EmployeeId.test.ts'
```

テストコード内で `@/` パスエイリアスを使っているのに、Vitestがそれを解決できない状態でした。

## 原因

- `tsconfig.json` には `@/` エイリアスが定義されていた
- しかし、Vitestは独自の設定ファイルが必要で、`tsconfig.json` の設定を自動的には読み込まない
- そのため、Vitest用の設定ファイル (`vitest.config.ts`) を作成してパスエイリアスを明示的に設定する必要がある

## 解決方法

### vitest.config.ts の作成

プロジェクトルート（`web/` ディレクトリ）に `vitest.config.ts` を作成：

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 設定のポイント

1. **`resolve.alias`**: パスエイリアスを定義
   - `@` を `./src` ディレクトリにマッピング
   - `path.resolve(__dirname, "./src")` で絶対パスに変換

2. **`test.globals: true`**: グローバルテストAPI有効化
   - `describe`, `it`, `expect` などをインポートなしで使える

3. **`test.environment: "node"`**: テスト環境の指定
   - Node.js環境でテストを実行（デフォルトは `node`）
   - ブラウザAPIが必要な場合は `jsdom` や `happy-dom` を指定

## TypeScriptとの関係

- **TypeScript (`tsconfig.json`)**: コンパイル時の型チェックとパス解決
- **Vitest (`vitest.config.ts`)**: テスト実行時のモジュール解決

両方に同じパスエイリアスを定義する必要があります：

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```typescript
// vitest.config.ts
{
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}
```

## 学んだこと

1. ビルドツールやテストランナーは、それぞれ独自の設定ファイルでパス解決を行う
2. TypeScriptの設定だけでは不十分で、実行環境（Vitest）にも設定が必要
3. パスエイリアスは複数の場所で同期して定義する必要がある
4. Vitestは Vite ベースなので、Vite の `resolve.alias` 設定を使う

## 関連ドキュメント

- [Vitest Configuration](https://vitest.dev/config/)
- [Vite resolve.alias](https://vitejs.dev/config/shared-options.html#resolve-alias)
