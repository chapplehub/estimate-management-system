# Vitestのキャッシュエラー解決方法

## 概要

Vitestでテスト実行時に `/tmp/...` のパスが見つからないエラーが発生した際の原因と解決方法について。

## エラー内容

```
Error: ENOENT: no such file or directory, open '/tmp/xtCwYj39Tad1Xzaf5MizE/ssr/75d28b195cfa87dc58815bbc2cc7cce763f15b76'
```

テストスイートが実行できず、すべてのテストが0件の状態になる。

## 原因

### Vitestのキャッシュ破損

Vitestは `node_modules/.vite` ディレクトリにキャッシュを保存している。このキャッシュには：
- 変換されたモジュール
- SSR（サーバーサイドレンダリング）用の一時ファイル
- ビルド済みの依存関係

エラーメッセージの `/tmp/...` パスは、Vitestが内部的に使用するSSR用の一時ファイルパス。

### キャッシュが壊れる原因

1. **TypeScript設定の変更**
   - `tsconfig.json` のpaths設定変更
   - compilerOptions の変更

2. **ビルドキャッシュの競合**
   - Next.jsのビルドキャッシュ（`.next`）との不整合
   - TypeScriptの増分ビルド情報（`tsconfig.tsbuildinfo`）との不整合

3. **依存関係の変更**
   - `package.json` の更新
   - `vitest.config.ts` の変更

## 解決方法

### 即座に解決

以下のコマンドでキャッシュをクリア：

```bash
cd web
rm -rf .next node_modules/.vite tsconfig.tsbuildinfo
npm test
```

### 各ファイルの役割

- `.next`: Next.jsのビルドキャッシュ
- `node_modules/.vite`: Vitestのキャッシュ
- `tsconfig.tsbuildinfo`: TypeScriptの増分ビルド情報

### package.jsonに追加推奨スクリプト

```json
{
  "scripts": {
    "test:clean": "rm -rf .next node_modules/.vite tsconfig.tsbuildinfo && npm test"
  }
}
```

## 発生しやすい状況

- TypeScript設定変更後の初回テスト実行
- パスエイリアス（`@/*`）の追加・変更後
- 依存関係の更新後
- 長期間テストを実行していなかった場合

## 予防策

根本的な予防は難しいが、以下で影響を最小化できる：

1. **設定変更後は必ずキャッシュクリア**
   ```bash
   rm -rf .next node_modules/.vite tsconfig.tsbuildinfo
   ```

2. **CIでのクリーンビルド**
   - CI環境では毎回クリーンな状態からビルド
   - ローカルでもこまめにクリア

3. **Vitestのcache設定**
   - `vitest.config.ts` で `cache: false` も選択肢
   - ただし、テスト実行速度が遅くなる

## 参考

- 関連ファイル:
  - `web/vitest.config.ts`
  - `web/tsconfig.json`
- 発生日: 2025-11-03
- 解決方法: キャッシュファイル削除
