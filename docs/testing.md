# テスト

単体テスト（vitest）と E2E テスト（Playwright）を使う。
**何を・どう書くか**は次を参照。本ドキュメントは**環境構築と実行方法**を扱う。

- テストを書く順序（TDD / 実装後 / 不要）の判断: [`.claude/references/test-strategy.md`](../.claude/references/test-strategy.md)
- Domain / Application 層のテスト規約: `.claude/skills/testing-backend/SKILL.md`
- E2E テストの書き方: `.claude/skills/create-e2e-test/SKILL.md`

## DB の分離

開発 DB・単体テスト DB・E2E テスト DB は**すべて別 DB**（Issue #584、[ADR-0012](adr/0012-e2e-test-db-separation-strategy.md)）。
いずれも `docker compose up -d --wait` で起動する同一の PostgreSQL コンテナ上に作られる（README 参照）。

| 用途 | DB | 環境変数ファイル | 初期化コマンド |
| --- | --- | --- | --- |
| 開発 | `estimate_management_dev` | `.env` | `pnpm db:migrate && pnpm db:seed` |
| 単体テスト | `estimate_management_unit` | `.env.unit` | `pnpm test:setup` |
| E2E テスト | E2E 専用 DB | `.env.e2e` | `pnpm e2e:setup` |

## 単体テスト（vitest）

```bash
pnpm test:setup   # DB初期化（DB作成 → migrate deploy → 正準マスタseed投入）
pnpm test         # 正準マスタ再シード + テスト実行
pnpm coverage     # カバレッジ付きで実行
```

- 初回は `cp .env.unit.example .env.unit` で env を用意してから `pnpm test:setup` を実行する
- `pnpm test:setup` は**初回とスキーマ変更時**に実行する。それ以外は `pnpm test` だけでよい
- seed（`prisma/seed-unit.ts`）が投入するのは**正準マスタのみ**（役職・役割・消費税率）。シナリオデータは各テストが自前で生成する
- Domain 層の Value Object / Entity はインメモリ、Domain Service と Application 層の Command / Query は実 DB を使う統合テストになる

### テスト DB のドリフト

`pnpm test` が原因不明の失敗をする場合、テスト DB のスキーマが `prisma/schema.prisma` からずれている可能性がある。
`prisma migrate status` は「適用済み」と表示することがあるため、`prisma migrate diff` で実際の差分を確認する。
develop の最新を取り込んだ上で `pnpm test:setup` をやり直すと解消することが多い。

## E2E テスト（Playwright）

```bash
pnpm e2e:setup    # DB初期化（DB作成 → migrate → E2E用seed投入）
pnpm e2e:seed     # テストデータ再シードのみ
pnpm e2e          # 再シード + テスト実行
pnpm e2e:ui       # UI モードで実行
pnpm e2e:headed   # ブラウザを表示して実行
pnpm e2e:report   # 直近のレポートを表示
```

- 初回は `cp .env.e2e.example .env.e2e` で env を用意する
- テストサーバーは **3001 番ポート**で自動起動する（`pnpm dev --port 3001`）。開発サーバー（3000）と同時に動かせる
- テストファイルは `src/app/` 配下に置く（`testDir: "./src/app"`）

### 実行方針

> [!IMPORTANT]
> **ローカルでは E2E 全体を回さない。** 変更に関係するスペックだけを実行し、全体は CI に任せる。
> 全体実行は時間がかかる上、ローカルの失敗の多くは環境要因であり、得られる情報が少ない。

```bash
pnpm exec playwright test src/app/path/to/target.spec.ts
```

### 制約

- **テスト内で Prisma クライアントを直接使わない**。Prisma 7.x の生成クライアントが `import.meta.url` を使っており、Playwright の esbuild トランスパイラと ESM/CJS の不整合を起こすため（[ADR-0012](adr/0012-e2e-test-db-separation-strategy.md)）。データ準備は seed 側で行う
- **CRUD テストは `test.describe.serial` で直列化する**（create → update → delete）
- `workers: 1` で常に直列実行する。CI の並列化は shard 分割が担い、shard 内では並列化しない（[ADR-20260727-55f](adr/20260727-55f-e2e-ci-parallelization-by-shard.md)）

### トラブルシュート

- **認証 setup の段階で失敗する** → `.next/` の stale キャッシュを疑う。`rm -rf .next/` してから再実行する
- **CI で単一 shard だけ全面 404** → Next.js dev サーバーの起動レース（[next#96139](https://github.com/vercel/next.js/issues/96139)）。再実行で解消する

## CI

- `ci.yml` — `changes`（変更パスの判定）→ `static`（`pnpm lint` + `pnpm build`。build が型チェックを兼ねる） / `test`（`vitest run`）
- `playwright.yml` — E2E を shard 分割して並列実行し、`merge-reports` ジョブで HTML レポートを 1 つに統合する（[ADR-20260727-55f](adr/20260727-55f-e2e-ci-parallelization-by-shard.md)）
