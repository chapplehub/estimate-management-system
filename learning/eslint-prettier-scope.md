# ESLint・Prettier の適用範囲

作成日: 2026-01-31

## 概要

ESLint と Prettier をプロジェクト内のどのファイル・ディレクトリに適用すべきか、または除外すべきかについて。

## 基本方針

### 適用すべきファイル

| 対象 | 理由 |
|------|------|
| `src/` | アプリケーションコード。品質管理の主対象 |
| ルート設定ファイル (`.mjs`, `.ts`, `.js`) | 設定ファイルも一貫したフォーマットが有益 |
| `package.json`, `tsconfig.json` など | JSON のフォーマット統一で diff が見やすくなる |
| `prisma/seed.ts` | アプリケーションロジックを含むため |

### 除外すべきファイル・ディレクトリ

| 対象 | 理由 |
|------|------|
| `node_modules/` | 外部パッケージ。触るべきではない |
| `.next/`, `build/`, `out/` | ビルド成果物。自動生成される |
| `generated/` | 自動生成コード（Prisma Client など） |
| `coverage/` | テストカバレッジレポート |
| `pnpm-lock.yaml` | パッケージマネージャが管理 |
| `docs/`, `learning/` | Markdown ドキュメント。フォーマットが崩れる可能性 |
| `.claude/`, `.serena/` | ツール設定。ツールが期待する形式を壊す可能性 |
| `.husky/` | Git hooks。シェルスクリプト |
| `test-results/`, `playwright-report/` | テスト成果物 |
| `*.prisma` | Prisma スキーマ。専用フォーマッタがある |

## 設定ファイル

### ESLint (`eslint.config.mjs`)

```js
globalIgnores([
  // ビルド成果物
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // ドキュメント
  "docs/**",
  "learning/**",
  // ツール設定
  ".claude/**",
  ".serena/**",
  ".husky/**",
  // 自動生成
  "generated/**",
  "coverage/**",
  // テスト成果物
  "test-results/**",
  "playwright-report/**",
]),
```

### Prettier (`.prettierignore`)

```gitignore
node_modules
.next
build
coverage
generated
pnpm-lock.yaml

# Documentation
docs
learning

# Tool configurations
.claude
.serena
.husky

# Database
prisma/*.prisma

# Test artifacts
test-results
playwright-report
blob-report
```

## 判断基準

### 適用する場合

1. **人が書いたコード** - 品質・フォーマットの統一が有益
2. **チームで共有する設定ファイル** - 一貫性があると diff が見やすい
3. **レビュー対象のファイル** - フォーマットの議論を避けられる

### 除外する場合

1. **自動生成ファイル** - 再生成時に上書きされる
2. **外部ツールが管理するファイル** - ツールの期待する形式を壊す可能性
3. **専用フォーマッタがあるファイル** - Prisma スキーマなど
4. **ドキュメント** - Markdown のフォーマットが意図せず変わる可能性
5. **ビルド成果物・キャッシュ** - 不要なチェックでパフォーマンス低下

## ホワイトリスト vs ブラックリスト

| 方式 | 特徴 | 適した場面 |
|------|------|------------|
| ホワイトリスト | 対象を明示的に指定 | 厳格な管理が必要な場合 |
| ブラックリスト | 除外を明示的に指定 | 柔軟性が必要な場合（Next.js 標準） |

このプロジェクトでは**ブラックリスト方式**を採用。Next.js の標準的なアプローチに近い。

## 参考

- `eslint.config.mjs` - ESLint 設定
- `.prettierignore` - Prettier 除外設定
- `.gitignore` - Git 除外設定（参考にすると良い）
