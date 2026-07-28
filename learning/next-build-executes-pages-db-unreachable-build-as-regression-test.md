# next build はページコードを実行する — DB 非到達ビルドが静的化の回帰テストになる理由

作成日: 2026-07-27

## 概要

`next build` を「型チェック + コンパイル + .next/ への出力」と理解していたが、実際には**静的と判定したページの Server Component をビルド時に実行する**（SSG = ビルド時レンダリング）。この性質により、「DB に到達できない環境で build が通ること」自体が「意図しない静的化が起きていないこと」の回帰テストになる。#643 の CI build ジョブはこの担保を実装するもので、`DATABASE_URL` は**未定義ではなく到達不能なダミー（`.invalid` ホスト）**にする必要がある。

## 詳細

### next build のフェーズとユーザーコード実行

| フェーズ | 何をするか | ユーザーコードの実行 |
|---|---|---|
| 1. Compile | TS/JSX をバンドルへ変換 | しない |
| 2. 型チェック | tsc 相当の検査 | しない |
| 3. **Collecting page data** | 全ルートのモジュールを import して評価し、ルート設定（`dynamic` 等）を収集 | **モジュールスコープのコードが走る**（動的ページも含む） |
| 4. **Generating static pages** | 静的と判定したルートの Server Component をレンダリングして HTML 生成 | **ページ関数の中身が走る**（DB クエリ含む） |
| 5. Finalize | manifest 類を出力 | しない |

- 静的/動的の判定は **opt-out 方式**: `cookies()` / `headers()` などの動的 API 使用や `export const dynamic = "force-dynamic"` という「動的の証拠」が無ければ静的に倒れる。
- #644 はこの既定が生んだ事故: `(features)` 配下で `verifySession()`（cookie 読み取り）を呼ばない 5 ページが静的判定され、**ビルド時点のマスタデータ（E2E シード込み）が HTML に焼き込まれた**。
- #647 の修正（`(features)/layout.tsx` に `force-dynamic` 宣言）は後勝ちの `reduceAppConfig` により個別ページの `force-static` で上書きできるため、宣言とは独立した観測点が必要。

### DB 非到達ビルド = 追加コード 0 行の回帰テスト

ビルドが DB を引くかどうかを決めるのはレンダリング戦略であり、CI 側が選べるのは「引いたら何が起きるか」だけ。

```
静的化が再発 → フェーズ 4 で DB クエリ実行 → 接続失敗 → ビルド赤
静的化なし   → ビルド中にクエリが走らない → ビルド緑
```

この検出は vitest / E2E では原理的に不可能（dev サーバは常に動的レンダリング）。`prerender-manifest.json` の検査スクリプトは Next 内部成果物形式への依存（Renovate 更新で壊れる負債）、ESLint は「宣言の不在」に痕跡が無く無力 — いずれも #647 で棄却済み。

### DATABASE_URL は「未定義」ではなく「到達不能ダミー」

`src/server/prisma.ts` は**モジュール評価時**に `new PrismaPg({ connectionString: process.env.DATABASE_URL })` を実行し、フェーズ 3 で動的ページ含め必ず評価される。

| DATABASE_URL | 静的化なし（正常時） | 静的化再発（回帰時） |
|---|---|---|
| 到達可能な実 DB | 緑 | **緑（検出不能）**+ 古いデータ焼き込み |
| 未定義 | **ライブラリ依存**（構築時 throw なら常時赤 / pg の PGHOST・localhost フォールバックなら暗黙ダミー化） | 同左 |
| 到達不能ダミー | 緑 | 赤（クエリ実行の瞬間のみ失敗） |

未定義の挙動は `@prisma/adapter-pg` / `pg` のバージョン依存で、**Renovate の PR を検査する CI が、Renovate が更新するライブラリの未文書化挙動に依存する**循環になる。到達不能ダミーは「構築は必ず通る（形式が妥当）/ クエリ時だけ必ず落ちる（ホスト不在）」の 2 性質をバージョン非依存で固定し、「ビルド赤 ⇔ ビルド中クエリ実行 ⇔ 静的化再発」の一意な対応を成立させる。

- `.invalid` TLD は RFC 2606 で解決されないことが保証される。`localhost:5432` は「たまたま何も聞いていない」だけで、将来ジョブに postgres service を足すと担保が無言で消える。「偶然の到達不能」ではなく「宣言された到達不能」にする。
- 例: `postgresql://build:build@db-unreachable.invalid:5432/build_check`

### この方式の正統性

1. **build/run 分離は原則**（Twelve-Factor）: ビルド段階は実行環境の資源に触れない。Vercel / Docker マルチステージビルドは DB 非到達で `next build` するのが通常形。DB を要求するビルドのほうが逸脱（#644 はその顕在化）。
2. **ダミー URL は確立された慣行**: Next.js + Prisma の Docker ビルドで build ステージにダミー DATABASE_URL を与えるのは定番パターン。
3. **機構ではなく観測の追加**: 最小構成（build に DB を与えない）を取ると回帰は勝手にビルド失敗として顕在化する。追加はコメント（意図の文書化）のみ。

### 弱点（許容済み）

- 回帰時のエラーは `getaddrinfo ENOTFOUND db-unreachable.invalid` 等の接続エラーで、初見では静的化と読めない → ジョブ定義のコメントで補う。
- DB を読まないページ（`customers/new`・`products/new`）の静的化は検出できない → 実害なしとして許容（#647）。

## 参考

- `src/server/prisma.ts`（モジュール評価時の PrismaPg 構築）
- `docs/adr/20260727-2fb-explicit-dynamic-rendering-for-authenticated-routes.md`（担保の設計元）
- Issue #643（CI build ジョブ）/ #644（静的化バグ）/ PR #647（force-dynamic 宣言と DB 非到達 build の申し送り）
- Twelve-Factor App「V. Build, release, run」
