# 実装計画からの逸脱記録（#429）

計画: `docs/claude-plans/issue-429/round1-data-boundary-and-list-screen.md`

## 逸脱1: `queries.ts` の `import "server-only"` を省略

- **元の計画**: `_data/queries.ts` 冒頭に `import "server-only";` を置き、クライアントコンポーネントへの誤import時にビルドエラーで弾く。
- **実際の実装**: 当該importを省略し、コメントで方針を明記。
- **逸脱の理由**: 本リポジトリは `server-only` パッケージを未導入（`require.resolve('server-only')` が解決不能、既存クエリ層にも使用例なし）。importするとビルドが壊れる。サーバ専用性は Server Component（`page.tsx`）経由の利用で担保し、リポジトリ全体の既存慣習（server-only 不使用）に揃えた。導入是非は本スライスのスコープ外。
