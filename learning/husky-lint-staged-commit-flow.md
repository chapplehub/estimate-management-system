# コミット時の自動チェックフロー（husky + lint-staged）

作成日: 2026-01-31

## 概要

Git コミット時に husky と lint-staged を使って、自動的にコード品質チェックを実行する仕組みについて。

## 詳細

### コミット時の実行フロー

```
git commit
    ↓
.husky/pre-commit が実行される
    ↓
1. pnpm lint-staged
   - ステージングされたファイルに対して:
     - eslint --fix (自動修正)
     - prettier --write (自動フォーマット)
   - 修正されたファイルは自動的にステージングに追加される
    ↓
2. pnpm tsc --noEmit (型チェック)
    ↓
3. pnpm test (テスト実行)
    ↓
.husky/commit-msg が実行される
    ↓
4. commitlint (コミットメッセージ検証)
   - Conventional Commits 形式を強制
   - 例: feat:, fix:, docs:, refactor: など
    ↓
コミット完了
```

### 各ツールの役割

| ツール | 役割 | 実行タイミング |
|--------|------|----------------|
| husky | Git hooks を管理 | pre-commit, commit-msg |
| lint-staged | ステージングファイルのみに処理を適用 | pre-commit |
| ESLint | コード品質チェック + 自動修正 | lint-staged 経由 |
| Prettier | コードフォーマット | lint-staged 経由 |
| tsc | 型チェック | pre-commit |
| vitest | テスト実行 | pre-commit |
| commitlint | コミットメッセージ検証 | commit-msg |

### 設定ファイル

#### `.husky/pre-commit`

```bash
pnpm lint-staged
pnpm tsc --noEmit
pnpm test
```

#### `.husky/commit-msg`

```bash
pnpm commitlint --edit $1
```

#### `.lintstagedrc.mjs`

```js
import path from "path";

const buildEslintCommand = (filenames) =>
  `eslint --fix ${filenames.map((f) => `"${path.relative(process.cwd(), f)}"`).join(" ")}`;

const config = {
  "*.{js,jsx,ts,tsx}": [buildEslintCommand],
  "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write"],
};

export default config;
```

### 手動コマンドが必要な場面

| 場面 | コマンド |
|------|----------|
| 普段の開発 | 不要（コミット時に自動実行） |
| 全体フォーマット | `pnpm format` |
| フォーマット確認 | `pnpm format:check` |
| 手動 lint | `pnpm lint` |

### 注意点

- lint-staged は**ステージングされたファイルのみ**に適用される
- 全ファイルをフォーマットしたい場合は `pnpm format` を使う
- pre-commit フックが失敗するとコミットは中断される
- CI/CD 環境では husky はスキップされる（`.husky/install.mjs` で制御）

## 参考

- `.husky/pre-commit` - pre-commit フック
- `.husky/commit-msg` - commit-msg フック
- `.husky/install.mjs` - husky インストール制御
- `.lintstagedrc.mjs` - lint-staged 設定
- `commitlint.config.mjs` - commitlint 設定
- `.prettierrc` - Prettier 設定
- `.prettierignore` - Prettier 除外設定
- `eslint.config.mjs` - ESLint 設定
