# Issue #704: CI 実行可否の切り分けを changes ゲート（除外リスト方式）に一本化し、e2e を required status check にする — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

CI の実行可否判定を「static/test（paths なし）と e2e（14 項目の paths 許可リスト）で別基準」から、「プロダクトに触れたか否か」の単一基準に統一する。判定は composite action（`.github/actions/changes`）に一元化し、除外リスト（ignore-list）方式で「差分の全ファイルが安全リストに収まるときだけスキップ」とする。ワークフローレベルの `paths` フィルタをジョブレベルの `if:` スキップに置き換えることで、`if:` スキップされたジョブは required status check を「skipped = 合格」で満たす GitHub の仕様を利用し、ドキュメントのみの PR をマージ可能に保ったまま `e2e report` を required status check に追加する。

- 除外リスト（これだけに収まる差分は CI をスキップ）: `docs/**`, `**/*.md`, `.claude/**`
  - `learning/` 配下は全て `*.md` のため `**/*.md` でカバーされる。`LICENSE` はリポジトリに存在しないため含めない
- ゲート対象は `pull_request` イベントのみ。`push`（develop / main）は無条件で実行し、「develop の HEAD が常に verdict を持つ」不変条件（ADR-20260729-d8c）を維持する

## 設計判断

### CI 実行可否の判定方式
- A. 許可リスト（これらを触ったら回す）— 現行 playwright.yml の方式
- B. 除外リスト（差分の全ファイルが安全リストに収まるときだけスキップ）
- 採用: B。故障モードの向きが理由。A はリスト更新を忘れると CI が黙って走らなくなる（緑のままマージされ検出不能）。B は忘れても「不要な CI が走る」で安全側に倒れる。Renovate の lock ファイルのみ PR も自動的に必ず CI が回る

### required status check とスキップの両立方式
- A. `paths-ignore` を持つダミーワークフローで同名チェックを緑にする（GitHub Docs の古典的ワークアラウンド）
- B. ワークフローレベル `paths` を削除し、ジョブレベル `if:` でスキップする（skipped は required を満たす）
- 採用: B。A は `paths` / `paths-ignore` を 2 ファイルで完全な補集合として手動同期する必要があり、ズレると無言の故障モードを持つため

### ゲートの適用範囲
- pull_request のみゲートし、push は無条件実行。ci.yml の push トリガーは「develop の HEAD が常に verdict を持つ」ことが目的（ADR-20260729-d8c）のため。docs-only PR は全チェック skipped でマージ → 直後の develop push で full CI が回り、不変条件は維持される
- workflow_dispatch も changes の出力に関係なく必ず実行する

### changes 判定の定義箇所
- A. ci.yml と playwright.yml を 1 ワークフローに統合する
- B. 分離を維持し、composite action（`.github/actions/changes/action.yml`）に切り出して両者から呼ぶ
- 採用: B。分離には E2E 単独 dispatch・Actions タブのレーン分離・concurrency 粒度の非対称（push は SHA 単位 / PR は ref 単位）という実利が残っており、統合で得られるのは changes ジョブの重複解消だけ。それは composite action でも達成できる

### 判定ロジックの実装
- A. `dorny/paths-filter`（v3 の `predicate-quantifier: every` + 否定パターン）
- B. 自前の `git diff --name-only` + `grep -v`
- 採用: B。除外リスト意味論は「除外パターンに当たらないファイルが 1 つでもあるか」= grep -v そのものであり、サードパーティ action への依存を増やさない（本リポジトリのサプライチェーン方針: GITHUB_TOKEN 最小権限・依存 pin と整合）

### required に追加するチェック名
- shard ジョブ名（`e2e (shard 1/6)` 等）ではなく、全 shard の結果を「Fail if any shard failed」ステップで集約している `e2e report`（merge-reports ジョブ）1 つを required にする。shard 名は matrix 依存で shard 数変更のたびに保護が無言で外れるため

## ステップ

### Step 1: changes composite action の新設
- [x] **完了**
- 対象ファイル: `.github/actions/changes/action.yml`
- テスト戦略: テスト不要（CI 設定ファイル。動作確認は Step 4 の実 PR 3 経路で行う）
- 作業内容:
  - `pull_request` の base に対する `git diff --name-only` の結果を除外パターン（`docs/**`, `**/*.md`, `.claude/**`）で `grep -v` し、残るファイルが 1 つでもあれば `product=true` を出力する composite action を作成する
  - base との比較に必要な fetch（checkout の深さ）も action 内で完結させる
  - 除外リストの定義箇所がこのファイル 1 箇所であることをコメントで明記する
- コミットメッセージ: `ci: CI 実行可否を判定する changes composite action を追加`

### Step 2: playwright.yml を paths フィルタから changes ゲートへ移行
- [x] **完了**
- 対象ファイル: `.github/workflows/playwright.yml`
- テスト戦略: テスト不要（CI 設定ファイル。動作確認は Step 4 で行う）
- 作業内容:
  - `pull_request` の `paths:` を削除し、削除理由（required check との相性・ゲートはジョブレベル `if:` へ移行）をコメントで残す
  - `changes` ジョブを追加し composite action を呼ぶ
  - `test`（shard）ジョブに `needs: changes` と `if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.product == 'true'` を追加する
  - `merge-reports` の `needs` に `changes` を追加し、`if` を `!cancelled() && (github.event_name == 'workflow_dispatch' || needs.changes.outputs.product == 'true')` に補強する（`!cancelled()` は needs の暗黙 success() 条件を上書き消去するため、補強しないと test スキップ時にここだけ走って blob 不在で赤くなる）
  - ジョブ名 `e2e report` は required status check の照合キーになるためリネームしない
- コミットメッセージ: `ci: playwright.yml の paths フィルタを changes ゲートへ移行する`

### Step 3: ci.yml への changes ゲート組み込み
- [ ] **完了**
- 対象ファイル: `.github/workflows/ci.yml`
- テスト戦略: テスト不要（CI 設定ファイル。動作確認は Step 4 で行う）
- 作業内容:
  - `changes` ジョブを追加し composite action を呼ぶ
  - `static` / `test` ジョブに `needs: changes` と `if: github.event_name != 'pull_request' || needs.changes.outputs.product == 'true'` を追加する（push / workflow_dispatch は無条件実行）
  - 既存の「paths フィルタは意図的に付けない」コメント（pull_request 側）を、changes ゲート方式に合わせて更新する（push 側の理由 = ADR-20260729-d8c は不変のため維持）
  - ジョブ名 `static` / `test` はリネームしない
- コミットメッセージ: `ci: ci.yml に changes ゲートを組み込む`

### Step 4: 3 経路での動作確認
- [ ] **完了**
- 対象ファイル: なし（PR 上の動作確認。本計画ファイルのチェック更新のみコミット）
- テスト戦略: テスト不要（CI の実挙動そのものが検証対象）
- 作業内容:
  - 本 PR（`.github/**` の変更 = 除外リスト外）で static / test / e2e が全て起動することを確認する
  - docs のみを変更した検証用 PR で、changes のみ実行され static / test / e2e が skipped になり、required check が合格扱いになることを確認する（確認後クローズ）
  - workflow_dispatch で playwright.yml / ci.yml が changes の出力に関係なく実行されることを確認する
- コミットメッセージ: `docs: issue-704 の動作確認結果を計画に反映`

### Step 5: ruleset protect-develop へ `e2e report` を required status check として追加
- [ ] **完了**
- 対象ファイル: なし（GitHub ruleset 設定。gh api または設定画面で変更）
- テスト戦略: テスト不要（リポジトリ設定変更）
- 作業内容:
  - **本 PR が develop にマージされた後**に実施する。先に追加すると、旧 playwright.yml（paths フィルタ付き）のままの docs-only PR で `e2e report` が起動せず pending となりマージ不能になるため
  - ruleset `protect-develop`（ID: 12978563）の required_status_checks に `e2e report` を追加する（既存: `static`, `test`）
  - 追加後、docs-only PR がマージ可能なことを最終確認する
- コミットメッセージ: なし（設定変更のみ。計画のチェック更新は `docs: issue-704 の計画チェックを更新` で単独コミット）
