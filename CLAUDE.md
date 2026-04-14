# CLAUDE.md

## Tech Stack

Next.js 16 (App Router), React 19, Prisma ORM, PostgreSQL, Vitest, TailwindCSS 4, DDD architecture

## Commands

```bash
pnpm dev / build / test / lint
pnpm db:migrate / db:generate / db:studio
```

## Git Branch Strategy

- defalut branch: `develop`
- branch naming rule: `feat/issue-{number}`, `fix/issue-{number}`, `docs/issue-{number}`

## Commit Rule

- **Commit at each meaningful change**: コードの編集・追加をしたら、意味のあるまとまりの時点でコミットする。一括実装してまとめてコミットしない。
- **Record design decisions in commit body**: コミット対象に設計判断（実装方式の選択、レイヤー配置、データ構造の決定など）が含まれる場合、その判断理由をコミットボディに記載する。
  - 例: 「バリデーションをドメイン層ではなくアプリケーション層に配置。理由: 外部API依存のチェックを含むため」
  - 例: 「Mapではなく配列で管理。理由: 要素数が常に少なく、順序保証が必要なため」
- Commit types: `.claude/references/commit-types.md` を参照

## Issue, PR Creation

Issueを作成する際は必ず `/create-issue` スキルを使用すること。`gh issue create` を直接実行しない。
PRを作成する際は必ず `/create-pr` スキルを使用すること。`gh pr create` を直接実行しない。

## Plan Mode Workflow

計画ファイルを使って実装する場合（plan mode）のルール:

- **Plan file format**: Planファイルは `docs/claude-plans/PLAN_TEMPLATE.md` のフォーマットに従って作成すること。
- **Record deviations from plan**: 実装中に計画と異なる対応をした場合、作業完了時に `docs/claude-plans/issue-{number}/deviations.md` に記録すること。フォーマットは以下の通り:
  ```markdown
  # 計画からの逸脱記録

  ## 逸脱 1: {タイトル}
  - **計画**: {元の計画内容}
  - **実際**: {実際の実装内容}
  - **理由**: {逸脱の理由}
  ```

## Critical: DDD Layering Rules

**NEVER violate these rules:**

1. Domain layer MUST NOT depend on infrastructure, application, or presentation layers
2. Domain layer MUST NOT import Prisma, Next.js, or any external libraries
3. Application layer uses repository **interfaces** from domain layer, NOT concrete implementations
4. Infrastructure layer implements domain interfaces and handles Prisma <-> Domain mapping

## E2E Tests

```bash
pnpm e2e          # E2Eテスト実行
pnpm e2e:setup    # テストDB初期化
pnpm e2e:seed     # テストデータ再シード
```

- CRUDテストは `test.describe.serial` で直列化（create→update→delete）
- テスト内でPrismaクライアントを直接使わない（技術制約: ADR-0012参照）

## Reference

- DDD implementation patterns: `/ddd-architecture` skill or `docs/dev-guidelines.md`
- System design: `docs/system-design-doc.md`
