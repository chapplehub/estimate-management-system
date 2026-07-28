# Issue #643 実装計画からの逸脱

## 1. ローカルの型検査を `pnpm typecheck`（`next typegen && tsc --noEmit`）に一本化した

- **元の計画**: Step 1 の static ジョブは `checkout → pnpm → setup-node → install → pnpm db:generate → pnpm lint → pnpm tsc --noEmit → pnpm build` の順。生成物のステップは `db:generate` のみ。
- **実際の実装**: `package.json` に `"typecheck": "next typegen && tsc --noEmit"` を新設し、`.husky/pre-push` がこれを呼ぶ形にした。
  - 初回の修正では ci.yml だけに `Generate Next.js types`（`pnpm exec next typegen`）ステップを足したが、PR #655 のレビュー指摘 1 を受けて上記へ改めた。ci.yml だけを直すと `.husky/pre-push` が裸の `pnpm tsc --noEmit` のまま残り、clean clone や `rm -rf .next/`（E2E のトラブルシュートで実行する）の直後は pre-push が同じ TS2307 で落ちる。この PR が解消したはずの「ローカル緑 / CI 赤」の乖離を、対称の位置に残すことになるため。
  - なお ci.yml の Typecheck ステップは後に削除した（→ 逸脱 3）。この時点では CI もこのスクリプトを呼んでいた。
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
- **playwright.yml にも入れた理由**: ci.yml だけに宣言すると「片方のワークフローだけ守られている」状態になり、既定が write に変わったときに E2E 側から同じ経路が開く。artifact の upload / download は `ACTIONS_RUNTIME_TOKEN` を使うため `contents: read` で動作する（run 30326453119 の `e2e report` が pass することで実証済み）。計画のスコープ（ci.yml の新設）を 1 ファイル分だけ超えるが、2 行で可逆なため本 PR に含めた。

## 3. static ジョブから独立した型検査ステップを削除した

- **元の計画**: static ジョブは `pnpm lint → pnpm tsc --noEmit → pnpm build` の 3 検査。イシュー本文の受け入れ条件も「PR に対して `tsc --noEmit` が実行される」と書いている。
- **実際の実装**: 独立した Typecheck ステップを削除し、型検査は `pnpm build` に一本化した。ステップ名を `Build (type check + DB unreachable)` に改め、意図と受け入れたリスクを YAML コメントに残した。受け入れ条件は充足の仕方が変わるだけで、`tsc` 相当の検査は引き続き PR ごとに実行される。
- **理由**: PR #655 のレビュー指摘 8 を検証したところ、**`tsc --noEmit` が単独で捕まえられるものが存在しなかった**。

  検証方法: アプリのモジュールグラフから完全に切り離された `scripts/__typecheck-probe.ts`（誰も import していない）に型エラーを 1 つ仕込み、双方で実行した。

  | 検査 | 結果 |
  |---|---|
  | `pnpm typecheck` | `scripts/__typecheck-probe.ts(3,14): error TS2322` で exit 2 |
  | `pnpm build` | `Running TypeScript ...` → `Failed to compile.` で exit 1、同じファイル・同じ行を指摘 |

  `next build` は tsconfig の `include`（`**/*.ts`）で定義されたプログラム全体を検査しており、`scripts/` や `*.test.ts` も対象に含む。`next.config.ts` に `typescript.ignoreBuildErrors` も無い。独立ステップのコストは CI 実測で約 19 秒（static ジョブ 2 分 1 秒 → 1 分 42 秒相当）。

- **引き換えに受け入れたリスク**: `next build` の型検査範囲は Next.js の実装詳細であり、Next 自体が Renovate の更新対象である。将来 Next が検査範囲をアプリのグラフに絞ると、test / scripts の型検査が黙って消える。人間の push は `.husky/pre-push` の `pnpm typecheck` が全プログラムを検査し続けるが、husky を通らない Renovate の PR ではこの build が唯一の網になる（#643 が問題視している「`@types/*` の更新による型の破壊」は、まさに `scripts/` や `*.test.ts` だけを壊す形で起こりうる）。

  この非対称性は認識のうえで受け入れた。Next のメジャー更新時に前提が維持されているかを確認する旨を YAML コメントに残してある。

- **検討して採らなかった案**: `next.config.ts` に `typescript.ignoreBuildErrors: true` を置いて build 側の型検査を切り、`tsc` を型の唯一の権威にする案。フラグ名が「型検査を諦めた」と誤読される強さに加え、ローカルで `pnpm build` を直接叩いたときに型検査が効かなくなる。CI の 20 秒のためにローカルの安全性を削るのは向きが逆。

  レビューが提案した「build を独立ジョブにして lint / typecheck と並列化する」案も採らなかった。CI 実測でジョブ開始から検査開始までの setup が約 56 秒あり、約 20 秒の壁時計短縮のためにもう 1 ランナー分の setup を払うことになる。required check の名前が 3 つに増え、`static` / `test` の 2 つに絞った Step 5 の設計判断にも波及する。
