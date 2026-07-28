# Issue #643 実装計画からの逸脱

## 1. static ジョブに `next typegen` ステップを追加した

- **元の計画**: Step 1 の static ジョブは `checkout → pnpm → setup-node → install → pnpm db:generate → pnpm lint → pnpm tsc --noEmit → pnpm build` の順。生成物のステップは `db:generate` のみ。
- **実際の実装**: `db:generate` の直後に `pnpm exec next typegen`（`Generate Next.js types`）を追加した。
- **理由**: PR #655 の初回 run で Typecheck が以下で失敗した。

  ```
  src/app/page.tsx(2,21): error TS2307: Cannot find module '../../public/next.svg'
  src/app/page.tsx(3,23): error TS2307: Cannot find module '../../public/vercel.svg'
  ```

  `*.svg` 等の module 宣言を持つ `next-env.d.ts` は `.gitignore` されており（create-next-app の既定、`.gitignore:44`）、その中身はさらに `import "./.next/types/routes.d.ts"`（typed routes）を参照している。どちらも `next dev` / `next build` の生成物であり、クリーンな CI には存在しない。

  ローカルの pre-push で `pnpm tsc --noEmit` が通っていたのは、dev サーバや過去のビルドが残した `.next/` に暗黙依存していたためで、CI で初めて露呈した。#641 が問題視する「CI が環境を代表していない」の裏返しの事例にあたる。

  `pnpm exec next typegen` が `next-env.d.ts` と `.next/types/` の両方を再生成することをローカルで確認した（`next-env.d.ts` を退避してから typegen し、再生成されることを確認）。

- **検討した代替案**: build を tsc より前に置く（`next build` は内部で型検査を行うため、build 後なら生成物が揃う）。採らなかったのは、(1) 速い検査から落とす fail-fast の順序が崩れる、(2) build が先だと型エラーは build ステップで落ちるため独立した Typecheck ステップがほぼ冗長になり、どのステップが何を担保しているかが読めなくなるため。`db:generate` と同じ「検査に必要な生成物を先に作る」ステップとして揃えるほうが、ジョブの構造として一貫する。
