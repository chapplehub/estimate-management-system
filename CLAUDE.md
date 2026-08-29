# CLAUDE.md

> このファイルには**規範**（知らないと逸脱するもの）だけを書く。
> 手順は `README.md` / `docs/` へ、詳細仕様は `.claude/references/` へ置き、ここからはポインタで指す。

## Major premise

常に日本語で対話すること

## Git Branch Strategy

- default branch: `develop`
- branch naming rule: `feat/issue-{number}`, `fix/issue-{number}`, `docs/issue-{number}`
- worktree の運用ルール: `docs/git-worktree-rule.md`

## Git Hooks (husky)

コミット・プッシュ時に husky が自動でチェックを走らせる。エージェントはこのコストを前提にコミット単位を設計すること。

- **各コミットは関連テストが緑になる単位で区切る**こと。テストが割れる中間状態でコミットしない
- フックを無効化（`--no-verify`）してコミット／プッシュしないこと
- `git push` は pre-push のフルスイート（約 135 秒）で既定のタイムアウトを超える。`timeout` を長めに指定すること
- 各フックが何を実行するか: `.claude/references/git-hooks.md`

## Commit Rule

- **Commit at each meaningful change**: コードの編集・追加をしたら、意味のあるまとまりの時点でコミットする。一括実装してまとめてコミットしない。
- **Record design decisions in commit body**: コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、その判断理由をコミットボディに記載する。
- **Record deviations from plan**: 実装中に計画と異なる対応をした場合、作業完了時に `docs/claude-plans/issue-{number}/deviations.md` に{元の計画内容}、{実際の実装内容}、{逸脱の理由}を記録すること。
- Commit type の一覧とメッセージの書き方: `.claude/references/commit-types.md`

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
- EC2 への反映（通常デプロイ・ロールバック）: `docs/ops/deploy.md` に従う。**EC2 上で追跡ファイルを直接編集しない**（drift となり次のデプロイが止まる）

## Tests

開発DB・単体テストDB・E2EテストDB は**すべて別DB**。セットアップと実行方法は `docs/testing.md`。

- **ローカルで E2E 全体を回さない**こと。変更に関係するスペックのみ実行し、全体は CI に任せる
- E2E テスト内で Prisma クライアントを直接使わないこと（技術制約: ADR-0012）
- CRUD の E2E は `test.describe.serial` で直列化する（create→update→delete）
- テストを書く順序（TDD / 実装後 / 不要）の判断: `.claude/references/test-strategy.md`
