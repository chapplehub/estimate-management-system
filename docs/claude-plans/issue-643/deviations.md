# Issue #643 実装計画からの逸脱

## 1. 型検査を `pnpm typecheck`（`next typegen && tsc --noEmit`）に一本化した

- **元の計画**: Step 1 の static ジョブは `checkout → pnpm → setup-node → install → pnpm db:generate → pnpm lint → pnpm tsc --noEmit → pnpm build` の順。生成物のステップは `db:generate` のみ。
- **実際の実装**: `package.json` に `"typecheck": "next typegen && tsc --noEmit"` を新設し、ci.yml の Typecheck ステップと `.husky/pre-push` の両方がこれを呼ぶ形にした。
  - 初回の修正では ci.yml だけに `Generate Next.js types`（`pnpm exec next typegen`）ステップを足したが、PR #655 のレビュー指摘 1 を受けて上記へ改めた。ci.yml だけを直すと `.husky/pre-push` が裸の `pnpm tsc --noEmit` のまま残り、clean clone や `rm -rf .next/`（E2E のトラブルシュートで実行する）の直後は pre-push が同じ TS2307 で落ちる。この PR が解消したはずの「ローカル緑 / CI 赤」の乖離を、対称の位置に残すことになるため。
- **理由**: PR #655 の初回 run で Typecheck が以下で失敗した。

  ```
  src/app/page.tsx(2,21): error TS2307: Cannot find module '../../public/next.svg'
  src/app/page.tsx(3,23): error TS2307: Cannot find module '../../public/vercel.svg'
  ```

  `*.svg` 等の module 宣言を持つ `next-env.d.ts` は `.gitignore` されており（create-next-app の既定、`.gitignore:44`）、その中身はさらに `import "./.next/types/routes.d.ts"`（typed routes）を参照している。どちらも `next dev` / `next build` の生成物であり、クリーンな CI には存在しない。

  ローカルの pre-push で `pnpm tsc --noEmit` が通っていたのは、dev サーバや過去のビルドが残した `.next/` に暗黙依存していたためで、CI で初めて露呈した。#641 が問題視する「CI が環境を代表していない」の裏返しの事例にあたる。

  `pnpm exec next typegen` が `next-env.d.ts` と `.next/types/` の両方を再生成することをローカルで確認した（`next-env.d.ts` を退避してから typegen し、再生成されることを確認）。

- **検討した代替案**: build を tsc より前に置く（`next build` は内部で型検査を行うため、build 後なら生成物が揃う）。採らなかったのは、(1) 速い検査から落とす fail-fast の順序が崩れる、(2) build が先だと型エラーは build ステップで落ちるため独立した Typecheck ステップがほぼ冗長になり、どのステップが何を担保しているかが読めなくなるため。

## 2. 両ワークフローに `permissions: contents: read` を追加した

- **元の計画**: `permissions` の記述は無し。
- **実際の実装**: `ci.yml` と `.github/workflows/playwright.yml` の両方にワークフローレベルで `permissions: contents: read` を宣言した。
- **理由**: PR #655 のレビュー指摘 5。リポジトリ既定は現在 `default_workflow_permissions: read` で実害は無いが、これはワークフロー外でいつでも write に変えられる設定であり、宣言があれば恒久的に閉じられる。両ジョブは `pnpm install` で `preinstall` の `npx -y only-allow`（レジストリから未固定バージョンを取得して実行）と `onlyBuiltDependencies` のビルドスクリプトを走らせるため、書き込み権限付きトークンを同じ run に置かない意味がある。
- **playwright.yml にも入れた理由**: ci.yml だけに宣言すると「片方のワークフローだけ守られている」状態になり、既定が write に変わったときに E2E 側から同じ経路が開く。artifact の upload / download は `ACTIONS_RUNTIME_TOKEN` を使うため `contents: read` で動作する（本 PR の run で実証する）。計画のスコープ（ci.yml の新設）を 1 ファイル分だけ超えるが、2 行で可逆なため本 PR に含めた。
