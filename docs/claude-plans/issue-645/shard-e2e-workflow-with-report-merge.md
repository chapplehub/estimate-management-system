# Issue #645: E2E テストを shard 4 分割で並列化し CI 時間を短縮する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

E2E（Playwright）ワークフローを GitHub Actions の matrix で 4 shard に分割して並列実行し、CI のウォールクロック時間を約 9 分 33 秒から 3 分台へ短縮する。shard 内の `workers` は 1 に据え置き、既存テストは 1 行も変更しない。

あわせて次を行う。

- `blob` reporter + `merge-reports` によるレポート統合（統合ジョブに shard の失敗を伝播させる責務を持たせる）
- `concurrency` の設定（同一 PR への連続 push で古い run をキャンセルする）
- `fail-fast: false` の明示と `timeout-minutes` の実態に即した見直し

設計判断の根拠は ADR-20260727-55f に記録済み。

## 設計判断

すべて `/grill-with-docs` で合意済み。方式選択のみ ADR-20260727-55f に記録し、運用パラメータは yml のインラインコメントとコミットボディに残す。

### 並列化の方式

- A. shard 内の `workers` を引き上げる
- B. `--shard` 分割（DB・サーバーごと分離）
- C. `webServer` を production build 起動に切り替える
- D. テストを shard へ手動で振り分ける
- **採用: B**。shard 間は postgres・Next サーバー・認証ストレージがすべて分離されるため既存テストを無改修で並列化できる。A は `toHaveCount` 100 箇所 / 22 ファイルの前提監査を伴う（実在の衝突例: 郵便番号 `1000001` を `customers-list.e2e.ts:73` が `toHaveCount(1)` で検証し、`customers-crud.e2e.ts:31` が同じ値で作成する）。C は損益分岐が `B < 31 秒` となり非現実的。D は保守負債に見合わない。→ ADR-20260727-55f

### shard 数

- 4 / 6 が候補
- **採用: 4**。準備一式 68 秒が shard 数だけ重複するため短縮率が逓減し、4 → 6 の追加短縮は約 41 秒にとどまる。matrix の配列 1 行で変更できる**可変パラメータ**として扱い、初回 run の実測を見て見直す。

### shard 間の実行時間の偏り

- A. Playwright 標準の件数分割で許容する
- B. project 分割やタグで手動振り分ける
- **採用: A**。件数分布は 96 / 92 / 94 / 94 で偏りはない。実行時間が平均の 1.4 倍ぶれても完全均等との差は 49 秒にとどまる。対処が必要になった場合の第一手は shard 数の引き上げ（保守コストゼロ）で、手動振り分けは最後の手段。

### レポートの扱い

- A. shard ごとの artifact を 4 個そのまま残す
- B. `blob` reporter + `merge-reports` で 1 つの HTML に統合する
- **採用: B**。失敗時に 4 個の artifact を当て推量で漁る導線は、shard 化で稼いだ体感速度を削る。統合ジョブは required status check を将来導入する際の**名前が固定された集約点**を兼ねられる（shard 数を変えても branch protection を触らずに済む）。

### 統合ジョブの責務

- A. レポート統合のみ
- B. レポート統合 + shard の失敗伝播
- **採用: B**。`merge-reports` はテストが失敗していても exit 0 で終わるため、A のままだと「4 shard 中 1 つが赤なのに統合ジョブは緑」が常態化する。統合 HTML の upload を**先に**行い、その後 `needs` の結果で `exit 1` する順序にする（逆順だと赤いときに artifact が上がらない）。

### artifact 名と再実行

- A. `github.run_attempt` を含める
- B. 含めない
- **採用: A**。`actions/upload-artifact` は v4 以降、同一 run 内で同名 artifact を二度アップロードできず、artifact は再実行の attempt をまたいで保持される。含めないと「Re-run failed jobs」が分かりにくいアップロードエラーで落ちる。再実行は「Re-run all jobs」を前提とする。

### concurrency

- A. `${{ github.workflow }}-${{ github.ref }}`
- B. `${{ github.workflow }}-${{ github.head_ref || github.ref }}`
- **採用: A**。`pull_request` イベントでは `github.ref` が `refs/pull/{N}/merge` になり PR ごとに一意。`workflow_dispatch` は別グループになるため巻き添えキャンセルが起きない。`github.workflow` を前置するのは、#643 で追加するワークフローと同じレーンに入って殺し合うのを防ぐため。#643 でも**同じ 2 行を直書き**して方針を揃える（reusable workflow 化などの共通化はしない）。
- `cancel-in-progress: true` を無条件、置き場所はトップレベル（run 単位）。本ワークフローに `push` トリガーは無いため、develop / main への push がキャンセル対象になる懸念は発生しない。

### fail-fast

- **採用: `false` を明示**。デフォルトが `true` のため明示が必要。`true` だと 1 回の run で見つかる失敗が 1 つに切り詰められ、赤 → 緑にする反復回数が増える（run を短くする代わりに往復を増やす）。加えて、キャンセルされた shard は blob artifact を上げないため統合レポートが歯抜けになる。

### retries

- **採用: `2` を据え置き**。直近 4 run のうち 1 run で flaky が発生し、リトライで救われている実績がある（`customers-crud.e2e.ts:242`）。リトライのコストは赤い run にしか現れず緑の run のウォールクロックに影響しない。下げる根拠となる測定が無いため、shard 化後の実測を見てから判断する。`trace: "on-first-retry"` がリトライ前提のため、0 にするとトレースが取れなくなる点にも注意。

### timeout-minutes

- **採用: shard ジョブ 20 分 / merge ジョブ 10 分**。現行の 60 分は実測 8〜10 分に対して緩すぎ、安全網として機能していない（shard 化で暴走時のコストは 4 倍になる）。1 shard の正当な最悪ケース（全テストが落ちて `retries: 2` で 3 回ずつ実行= 約 7 分 20 秒）から逆算した値。

### スコープ外とした判断

- **`webServer` の production build 化**: 不採用。別イシューも起票しない。#644 の解決で前提は揃ったが、計算すると shard 化と競合し有利にならないため（根拠は ADR-20260727-55f の選択肢 C に記録）。#643 が `build` ジョブを追加すれば実際のビルド時間が観測できるので、30 秒台かつ dev のコンパイル待ちが目立つ場合に限り再検討の余地がある。
- **branch protection の変更**: 不要。required status check は develop / main のどちらにも設定されていない（ruleset は `deletion` / `non_fast_forward` / `pull_request` のみ）。
- **`CONTEXT.md` の更新**: なし。見積ドメインの用語集であり、shard / concurrency は業務概念ではないため対象外。
- **serial チェーン中盤の失敗に `retries` が効かない件**: #652 として起票済み（本 Issue のスコープ外の既存課題）。本 Issue で `retries: 2` を据え置いた判断の前提になっている。

## ステップ

### Step 1: 並列化方式の ADR を追加する
- [ ] **完了**
- 対象ファイル:
  - `docs/adr/20260727-55f-e2e-ci-parallelization-by-shard.md`（新規・作成済み）
  - `docs/adr/INDEX.md`（テスト基盤 / 開発基盤の両カテゴリに 1 行追記・編集済み）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 内容を再確認し、ADR-0012 / ADR-0020 との系譜の記述に齟齬がないか確かめる
  - 実装より先にコミットし、以降のコミットから参照できる状態にする
- コミットメッセージ: `docs: E2E の CI 並列化方式を shard 分割とする ADR を追加`

### Step 2: E2E ワークフローを shard 4 分割し、レポートを統合する
- [ ] **完了**
- 対象ファイル:
  - `playwright.config.ts`
  - `.github/workflows/playwright.yml`
- テスト戦略: テスト不要（設定ファイル。検証は CI の実 run で行う）
- 作業内容:
  - `playwright.config.ts`
    - CI の reporter を `[["blob"], ["github"]]` に変更する（shard ごとに `blob-report/` を生成させる）。ローカルの reporter 設定は変更しない
    - `workers: process.env.CI ? 1 : 1` を `workers: 1` に整理し、ADR-20260727-55f を参照するコメントを添える（両分岐が同値の三項演算子になっているため）
  - `.github/workflows/playwright.yml`
    - `test` ジョブに `strategy.matrix` を追加する。`shardIndex: [1, 2, 3, 4]` / `shardTotal: [4]` の 2 軸とし、分母の管理箇所を 1 つに絞る
    - `strategy.fail-fast: false` を明示する（デフォルトが `true` のため）
    - テスト実行を `pnpm exec playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}` に変更する
    - `timeout-minutes` を 60 → 20 に変更する
    - artifact を `blob-report-${{ matrix.shardIndex }}-${{ github.run_attempt }}` に変更する（retention 1 日。`run_attempt` を含める理由をインラインコメントで残す）
    - `merge-reports` ジョブを追加する（`needs: test` / `if: ${{ !cancelled() }}` / `timeout-minutes: 10`）
      - blob を download → `pnpm exec playwright merge-reports --reporter=html` → 統合 HTML を `playwright-report` として upload（retention 30 日）
      - **upload の後**に `needs.test.result != 'success'` なら `exit 1` するステップを置く
  - ジョブ名を `e2e (shard N/4)` 相当の読める表記にする
- コミットメッセージ: `ci: E2E を shard 4 分割で並列実行しレポートを統合する`
  - ボディに記載する判断: shard 分割を選び `workers` 引き上げを退けた理由（DB 分離により既存テスト無改修で安全 / 引き上げは `toHaveCount` 100 箇所の前提監査を伴う）、config と yml を 1 コミットにまとめた理由（blob reporter と merge ジョブは相互依存で、分けると読めるレポートが出ない中間状態になる）、artifact 名に `run_attempt` を含める理由

### Step 3: concurrency を設定し、古い run をキャンセルする
- [ ] **完了**
- 対象ファイル: `.github/workflows/playwright.yml`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - トップレベル（`jobs:` と同階層）に `concurrency` を追加する
    - `group: ${{ github.workflow }}-${{ github.ref }}`
    - `cancel-in-progress: true`
- コミットメッセージ: `ci: 同一 PR の古い E2E run をキャンセルする concurrency を設定する`
  - ボディに記載する判断: `github.ref` を選んだ理由（PR ごとに一意になり `workflow_dispatch` と分離される）、`github.workflow` を前置する理由（#643 の追加ワークフローと同一レーンに入るのを防ぐ）、run 単位に置く理由

### Step 4: 初回 run の実測を確認し、可変パラメータを評価する
- [ ] **完了**
- 対象ファイル: なし（必要に応じて `.github/workflows/playwright.yml`）
- テスト戦略: テスト不要（実測確認）
- 作業内容:
  - PR を作成し、4 shard + merge ジョブが緑で完走することを確認する
  - 各 shard ジョブの所要時間を記録し、ウォールクロックの短縮幅を当初想定（3 分 12 秒）と突き合わせる
  - 最重 shard が最軽 shard の 1.5 倍を超えていないか確認する。超えていれば shard 数の引き上げを検討する（手動振り分けは行わない）
  - 統合レポートが 4 shard 分そろっていることを確認する
  - 計画から逸脱した対応があれば `docs/claude-plans/issue-645/deviations.md` に記録する
- コミットメッセージ: 実測が想定どおりなら不要。shard 数を変更した場合は `ci: E2E の shard 数を N に調整する`（ボディに実測値を記載）
