# CLAUDE.md

## Major premise

常に日本語で対話すること

## Git Branch Strategy

- defalut branch: `develop`
- branch naming rule: `feat/issue-{number}`, `fix/issue-{number}`, `docs/issue-{number}`

## Git Hooks (husky)

コミット・プッシュ時に husky が自動でチェックを走らせる。エージェントはこのコストを前提にコミット単位を設計すること。

- **pre-commit**: `lint-staged`（eslint --fix + prettier --write）→ staged コードの**関連テストのみ** `vitest related` を実行。`src/`・`prisma/`・ルートの `.ts/js/mjs/tsx/jsx` が staged された時だけ走り、docs のみのコミットはスキップされる。
  - → **各コミットは関連テストが緑になる単位で区切る**こと。テストが割れる中間状態でコミットしない。
- **commit-msg**: `commitlint` で type を検証（許可 type は `.claude/references/commit-types.md`）。
- **pre-push**: `tsc --noEmit`（全体型チェック）+ `vitest run`（フルスイート）。個別コミットでは型全体・全テストは担保されない点に注意。
- フックを無効化（`--no-verify`）してコミット／プッシュしないこと。

## Commit Rule

- **Commit at each meaningful change**: コードの編集・追加をしたら、意味のあるまとまりの時点でコミットする。一括実装してまとめてコミットしない。
- **Record design decisions in commit body**: コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、その判断理由をコミットボディに記載する。
  - 例: 「バリデーションをドメイン層ではなくアプリケーション層に配置。理由: 外部API依存のチェックを含むため」
  - 例: 「Mapではなく配列で管理。理由: 要素数が常に少なく、順序保証が必要なため」
- **Record deviations from plan**: 実装中に計画と異なる対応をした場合、作業完了時に `docs/claude-plans/issue-{number}/deviations.md` に{元の計画内容}、{実際の実装内容}、{逸脱の理由}を記録すること。
- Commit types: `.claude/references/commit-types.md` を参照

## Critical: DDD Layering Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma <-> Domain mapping

## Docker

開発DB・プロダクション構成ともに Docker Compose で動かす。手順は CLAUDE.md には置かない。

- 開発DB（起動・停止・リセット）: `docker compose up -d --wait` / 詳細は `README.md`
- プロダクション構成のローカル検証: 作業前に `docs/ops/prod-docker-local.md` を読むこと
- 公開デモ環境の初期データ投入: 実行前に `docs/ops/demo-seed.md` を**必ず読むこと**。seed は全テーブルを `deleteMany` する**破壊的操作**であり、既存データは残らない

## Unit Tests

単体テスト（vitest）は開発DBと分離した専用DB（`.env.unit` の `DATABASE_URL`）を使う（Issue #584）。

```bash
pnpm test:setup   # 単体テスト用DB初期化（DB作成 → migrate deploy → 正準マスタseed投入）。初回・schema変更時に実行
pnpm test         # 正準マスタ再シード + 単体テスト実行
```

- 初回は `cp .env.unit.example .env.unit` で env を用意してから `pnpm test:setup` を実行する
- seed（`prisma/seed-unit.ts`）は正準マスタ（役職・役割・消費税率）のみ。シナリオデータは各テストが自前生成する

## E2E Tests

```bash
pnpm e2e          # テストデータ再シード + E2Eテスト実行
pnpm e2e:setup    # テストDB初期化
pnpm e2e:seed     # テストデータ再シード
```

- CRUDテストは `test.describe.serial` で直列化（create→update→delete）
- テスト内でPrismaクライアントを直接使わない（技術制約: ADR-0012参照）
