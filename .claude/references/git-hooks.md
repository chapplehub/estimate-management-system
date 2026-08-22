# Git Hooks（husky）リファレンス

コミット・プッシュ時に husky が自動でチェックを走らせる。
**エージェントはこのコストを前提にコミット単位・タイムアウトを設計すること。**

規範は `CLAUDE.md` の「Git Hooks」節にある。本ドキュメントは各フックの実体を記録する。

## pre-commit（`.husky/pre-commit`）

1. staged ファイルのうち `^(src/|prisma/|[^/]*\.(ts|js|mjs|tsx|jsx)$)` に一致するものを抽出する
2. **一致が無ければ何もせず終了する**（`📝 No code changes detected.` と出力）。docs のみのコミットはここでスキップされる
3. `pnpm lint-staged` を実行する
   - `*.{js,jsx,ts,tsx}` → `eslint --fix`
   - `*.{js,jsx,ts,tsx,json,css,md}` → `prettier --write`
4. `vitest related --run` を staged コードに対して実行する（import グラフを逆引きし、**関連テストのみ**実行）

→ **各コミットは関連テストが緑になる単位で区切る。** テストが割れる中間状態でコミットしない。

全体型チェックとフルスイートはここでは走らない。個別コミットの緑は「変更に関連するテストが通った」ことしか保証しない。

## commit-msg（`.husky/commit-msg`）

`pnpm commitlint --edit $1` で type を検証する。

許可 type は `commitlint.config.mjs` の `type-enum` が正。
作業タイプの対応表は [`commit-types.md`](commit-types.md) の **`commit` 列**を参照する。
同じ表の `Issue` 列 / `branch` 列とは値の集合が異なり、`question` / `architecture` は commit-msg フックが拒否する。

## pre-push（`.husky/pre-push`）

1. push 範囲の基準を決める。upstream 未設定（新規ブランチの初回 push）なら `origin/develop` を使う
2. その範囲の変更ファイルを pre-commit と同じ正規表現で判定する
3. **コードファイルが無ければ型チェックもテストもスキップする**（docs のみの push は素通りする）
4. `pnpm typecheck` を実行する（= `next typegen && tsc --noEmit`）
5. `tsx prisma/seed-unit.ts && vitest run` を実行する（正準マスタ再シード + フルスイート）

### 裸の `tsc` ではなく `pnpm typecheck` を呼ぶ理由

`next-env.d.ts` と `.next/types/` は `.gitignore` された生成物であり、clean clone や `rm -rf .next/`（E2E のトラブルシュートで実行する）の直後は裸の `tsc` が TS2307 で落ちる。
CI の static ジョブとスクリプトを共有し、ローカル緑 / CI 赤の乖離を作らない（#643）。

### 所要時間

フルスイートは**約 135 秒**かかる。
エージェントが `git push` を実行する際は、既定のタイムアウトを超えるため `timeout` に 600000（10 分）程度を指定すること。

## `--no-verify` の禁止

フックを無効化してコミット／プッシュしない。
フックが落ちるなら、落ちる原因を直してからコミットする。
