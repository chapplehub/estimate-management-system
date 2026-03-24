# Playwright並列テストでのフレーキーテスト問題と解決策

作成日: 2026-01-28

## 概要

Playwrightで複数ブラウザ（chromium, firefox, webkit）を同時にテストすると、テストがフレーキー（不安定）になり、タイムアウトエラーが発生する問題に遭遇した。単一ブラウザでのテストは安定して成功する。

## 詳細

### 発生した問題

```
# 3ブラウザ同時テスト → フレーキーに失敗
  3 failed
    [chromium] › signin.e2e.ts › ログイン画面 › 正しい認証情報でログインに成功する
    [chromium] › signout.e2e.ts › ログアウト › ログアウトに成功する
    [webkit] › signin.e2e.ts › ログイン画面 › 正しい認証情報でログインに成功する
  5 passed (30.9s)

# 単一ブラウザ → 安定して成功
  4 passed (13.7s)
```

### 原因

並列テストによる負荷増加がタイムアウトを引き起こす：

| 原因 | 説明 |
|-----|------|
| **開発サーバーの負荷** | 3ブラウザが同時にリクエストを送ると、Next.js開発サーバーが処理しきれない |
| **システムリソース競合** | CPU/メモリを3ブラウザが同時に消費 |
| **セッション/DB競合** | 同時ログインでセッション管理が競合する可能性 |

### 関連するPlaywright設定

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,  // テストが完全並列で実行される
  workers: process.env.CI ? 1 : undefined,  // ローカルではworker数無制限（CPU数に応じて自動決定）
});
```

`workers: undefined` の場合、PlaywrightはCPUコア数に応じてworker数を自動決定する。3ブラウザ × 複数テストが同時実行されると、リソース競合が発生しやすい。

### 解決策

| 選択肢 | 推奨度 | 説明 |
|-------|-------|------|
| **workersを制限** | ⭐⭐⭐⭐⭐ | `workers: 2` など固定値にして負荷を軽減 |
| **ブラウザを1つに限定** | ⭐⭐⭐⭐ | 開発中はchromiumのみ、CIで全ブラウザ |
| **タイムアウト延長** | ⭐⭐ | 根本解決にならない |

### 推奨構成

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,  // ローカルでも制限

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // 開発中はchromiumのみ有効
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // CIまたは必要時のみ有効化
    // { name: "firefox", ... },
    // { name: "webkit", ... },
  ],
});
```

## 参考

- `playwright.config.ts` - Playwright設定ファイル
- https://playwright.dev/docs/test-parallel - Playwright並列テストドキュメント
- https://playwright.dev/docs/test-sharding - テストシャーディング（CI向け）
