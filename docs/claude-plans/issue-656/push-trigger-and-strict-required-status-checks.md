# Issue #656: マージ後の develop / main を検査する CI run が存在しない — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

イシューの選択肢 **A（`push` トリガーによる事後検知）と B（required status checks の strict 化による事前防止）を併用**する。C（merge queue）は不採用。

- **A**: `.github/workflows/ci.yml` に `push: branches: [main, develop]` を追加し、マージ後の develop / main を検査する run を起動する。あわせて push run の `concurrency` グループを commit（SHA）単位に分離し、連続マージでも 1 commit = 1 verdict を維持する。`playwright.yml` には push トリガーを付けない。
- **B**: 両 ruleset（`protect-develop` / `protect-main`）の `required_status_checks` に `strict_required_status_checks_policy: true` を設定する。あわせて `renovate.json` に `"rebaseWhen": "behind-base-branch"` を明示し、strict 化に伴う rebase を Renovate 自身に行わせる。

投入順序は **A → 実物で検証 → B**。検証は「意図的に壊した状態で想定どおり検知（または阻止）されることを確認する」というイシューの作業項目 3 に対応し、使い捨ての 2 PR で本物の意味的衝突を再現して行う。

設計判断は `/grill-with-docs` で確定済み。ADR を 1 本起票する（`ADR-20260729-d8c`）。

## 設計判断

### 採用する方式（イシューの A / B / C）

- A. `push` トリガーの追加（事後検知）
- B. required status checks の strict 化（事前防止）
- C. merge queue
- **選択: A + B の併用**。守る対象が異なるため排他ではない。B は「PR 経由の stale マージ」を止めるが、develop がいま緑かという**状態そのもの**は持たない。A はその状態を持つ唯一の手段で、事前防止では代替できない。C は「複数人がマージを競う」ための機構であり、単独開発者 + Renovate という構成では直列化すべき競合が存在しないため規模に対して過剰。
- **投入順序は A → 実物で検証 → B**。B を先に入れると「B のせいで止まったのか CI が本当に壊れているのか」を切り分ける観測点が無いまま運用に入る。

### push トリガーの適用範囲

- A. `ci.yml` のみ
- B. `ci.yml` と `playwright.yml` の両方
- **選択: A（`ci.yml` のみ）**。理由は 3 つ。
  1. イシューが挙げる意味的衝突の例（export の削除・リネーム、Value Object のコンストラクタ引数追加、Prisma 必須カラム追加とファクトリ追随漏れ）はいずれも `static` / `test` の射程内で、E2E を毎マージ回す費用対効果が合わない。
  2. **E2E の flaky が A の中核価値を壊す**。A の価値は「develop が赤い ＝ 直近のマージが犯人」という attribution にあり、既知の非決定要因（単一 shard の全面 404 ＝ Next dev のスキャンレース）で develop が赤くなり始めると信号が腐って誰も見なくなる。`static` / `test` は決定的なのでこの汚染がない。
  3. `playwright` は required check ではない（#643 の判断）。PR 段階で保証していないものを push 側だけ厳格に見るのは非対称であり、これは「playwright を required に昇格させるか」という別の関心事に属する。
- develop の E2E 健全性を観測したくなった場合は、push ではなく nightly の `schedule` トリガーが適した器（flaky が attribution を壊さず、同時実行枠の競合も夜間に逃がせる）。**別 issue に切り出す**。

### push run の concurrency

- A. 現状の式（`group: ${{ github.workflow }}-${{ github.ref }}`）をそのまま push にも適用する
- B. `cancel-in-progress` を push のときだけ `false` にする
- C. push のときだけグループを commit（SHA）単位に分離する
- **選択: C**。

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'push' && github.sha || github.ref }}
  cancel-in-progress: true
```

- A を採ると、連続マージ（Renovate の一斉マージなど）で最後の 1 commit 以外が `cancelled` になり verdict を失う。読み取れるのは「develop の HEAD が赤い」だけで犯人を特定できず、イシューが問題視した誤診をブランチ単位に移すだけになる。
- B は解決にならない。concurrency グループは「実行中 1 本 + 待機中 1 本」しか保持せず、3 本目が来た時点で待機中の 2 本目が捨てられる（GitHub ドキュメント: "any existing `pending` job or workflow in the same concurrency group will be canceled"）。
- **取り逃した verdict は回復不能**。`workflow_dispatch` は ref 指定でしか起動できず、任意の過去 SHA を後から検査する手段がない。
- C により全 commit に verdict が付き、commit 一覧で「緑 → 赤の境界」が犯人として一目で読める。実質的に `git bisect` を事前に全区間ぶん実行しているのと同じ。
- PR 側（`refs/pull/N/merge`）は従来どおり ref 単位のまま。PR で問われるのは HEAD が緑かだけで中間 commit の verdict に用は無いため、畳むのが正しい。

### push トリガーの branches と paths

- **`branches: [main, develop]`**。develop → main のリリースマージ後の状態も同じ理由で観測対象。
- **paths フィルタは付けない**。develop の HEAD が常に verdict を持つ状態を作るのが A の目的で、間引くと「最後に緑だったのは 3 コミット前」という読み取りにくい状態が生まれる。
- なお `ci.yml` が PR で paths を付けていない理由（required check が「起動しなかったジョブ」を待ち続ける）は push には当てはまらない。required checks は PR のマージ判定にしか使われないため。**push に paths を付けない理由は上記の別論拠による**。

### B の適用範囲

- A. `protect-develop` のみ
- B. `protect-develop` と `protect-main` の両方
- **選択: B（両方）**。
  - main は develop の**真の祖先**（`develop..main` = 0 commits、`main..develop` = 492 commits）であるため、develop → main の PR は定義上つねに最新を取り込み済みで、strict は現状 no-op として入る。
  - no-op でなくなる場面（main に hotfix が直接入り develop が stale になる）こそ機械に強制させたい場面であり、main が休眠中の今が最も安く入れられるタイミング。
  - 「develop は strict、main は非 strict」という非対称は半年後に誰も覚えておらず事故を生む。

### Renovate の rebaseWhen

- A. 既定の `"auto"` の自動検出に任せる
- B. `"behind-base-branch"` を明示する
- **選択: B（明示）**。
  - `auto` は「ブランチが最新であることを要求するリポジトリ」を検出して `behind-base-branch` に切り替わるが、この検出は classic branch protection 前提で作られており、**Rulesets での検出には既知の不具合報告がある**（[renovatebot/renovate discussion #38302](https://github.com/renovatebot/renovate/discussions/38302)）。このリポジトリは ruleset 運用。
  - 検出に失敗した場合の帰結が悪い。PR が stale のまま放置され、マージしようとして GitHub の "Update branch" を押すと、それは**ユーザー名義のコミットを PR ブランチに足す操作**であるため、Renovate の規則「If you push a new commit to a Renovate branch ... then Renovate stops all updates of that branch」（[Updating and Rebasing branches](https://docs.renovatebot.com/updating-rebasing/)）が発動し、**その PR は Renovate の管理から静かに外れる**。PR は残りマージもできるが以降更新されず、close するまで同じ依存の新しい PR も作られない。気づく手段が実質ない。
  - 明示すれば ruleset の実装詳細から切り離せる。`.nvmrc` を単一ソースにする（ADR-20260728-44b）、`DATABASE_URL` を三者一致させる、`db-unreachable.invalid` で「宣言された到達不能」にする（#643）と同じく、**推測される既定値ではなく宣言された値に依存する**という一貫した方針。
  - ruleset は GitHub 側にあってリポジトリからは見えないため、`renovate.json` のコメントで strict との対応関係を残す。
- **受け入れるコスト**: develop へ 1 マージするたび、Renovate の次回 run で open PR 全部が rebase され、`4 PR × (ci 2 job + playwright 7 job) = 36 job` が一斉起動する。1 日 2 マージで約 72 job/日。public リポジトリのため課金は無く、効くのは同時実行枠（20）のみ。実測して痛ければ `prConcurrentLimit` や schedule で**別 issue として**調整する。

### ロールアウト順序（rebaseWhen と strict 化）

- A. ruleset を strict 化 → `renovate.json` に `rebaseWhen` を明示
- B. `renovate.json` に `rebaseWhen` を明示 → ruleset を strict 化
- **選択: B**。A の順序では、strict 化から `renovate.json` のマージまでの間、Renovate の autodetect が ruleset を検出できるかに賭ける窓が開く。検出に失敗すれば PR は stale のまま放置され、"Update branch" を押した瞬間にその PR が Renovate 管理から静かに外れる。B の副作用は「strict でない期間に rebase の churn が先行する」だけで、壊れる方向の失敗が無い。**失敗したときに静かに壊れる側を後ろに置く**。

### 検証方法（イシューの作業項目 3）

- A. 使い捨ての 2 PR で本物の意味的衝突を再現し、develop を実際に赤くする
- B. 検証用ブランチを一時的に `push.branches` に足し、そこで壊す
- **選択: A**。
  - **そもそも「壊れた commit を develop に入れる」経路が他に無い**。自分自身が赤い PR は required checks（`static` / `test`）に阻まれてマージできず、直 push も「その SHA に緑の check が報告されていること」を要求されるが develop 以外では run が起動しないため条件を満たせない。**develop を壊す正当な経路は、イシューが問題視した「stale base の緑」しか残っていない** — 検証したいシナリオと実施できる唯一の手段が一致している。
  - 検証対象は「push トリガーが起動すること」ではなく、「stale base の緑でマージできる → develop が壊れる → 検知される → 犯人が一意に特定できる」という因果の連鎖全体。B はその前半を飛ばすため作業項目 3 の要件を満たさない。
  - 同じ材料を B の検証にそのまま再利用でき、「A で壊れる様子を見て、B で同じものが止まる様子を見る」という対になる。
  - `ci.yml` のコメントが主張する「`next build` は `*.test.ts` も型検査する（独立した `tsc --noEmit` を置かない根拠）」という賭けの実地検証にもなる。
- 材料は `src/server/__tests__/helpers/` 配下のテスト専用モジュール（本番コードに一切触れずに衝突を作れる）。
- デプロイ連携が無い（`deployments` 0 件 / `environments` 0 件）ため、develop が一時的に赤くなる実害はほぼゼロ。
- 後始末は revert PR で行う（`non_fast_forward` ルールにより force push で戻す経路は塞がれている）。

### develop が壊れたことの検知手段

- A. GitHub Actions の既定のメール通知に任せる
- B. 失敗時に issue を自動起票する等の能動通知を足す
- **選択: A**。
  - B は `issues: write` を要求し、`ci.yml` の `permissions: contents: read` を開くことになる。これは #643 が明示的な理由で閉じた設計（「`pnpm install` で `onlyBuiltDependencies` のビルドスクリプトを実行するため、書き込み権限付きトークンを同じ run に置かないことに意味がある」）であり、Renovate PR を検査する CI で書き込みトークンと未検証の依存のビルドスクリプトを同居させることになる。通知の便宜のために攻撃面を広げるのは割に合わない。
  - 既定通知は「自分が actor になったワークフローの失敗のみ」を通知する。PR をマージすると develop への push の actor はマージ実行者になるため、単独開発の本リポジトリでは通知先と当事者が常に一致する。
  - ユーザー側のアカウント設定はリポジトリからは確認できないため、**Step 4 の検証で実際に届くかを確認する**。届かなければ本 issue のスコープを広げず別 issue に切り出す。

### ADR の起票

- **起票する**（`ADR-20260729-d8c`）。3 条件のうち特に「文脈なしでは驚く」と「本物のトレードオフの結果」に強く該当する。
  - `group: ${{ github.workflow }}-${{ github.event_name == 'push' && github.sha || github.ref }}` は concurrency の常識（同一グループで畳む）と真逆に見える。
  - **決定が GitHub 側の ruleset・`renovate.json`・`ci.yml` の 3 箇所にまたがる**。ruleset はリポジトリの外にありコメントを書けないため、「strict と `rebaseWhen: behind-base-branch` は対である」という対応関係を書ける場所が ADR しかない。
  - CI に関する ADR の先例がある（ADR-20260727-55f / ADR-20260728-44b）。

### CONTEXT.md の扱い

- **更新しない**。`CONTEXT.md` は見積管理の業務ドメイン用語集（取引先・複製・改訂 等）であり、CI の語彙（意味的衝突、stale base）は住所が違う。用語集を「その他の決定事項置き場」にすると用語集として死ぬ。

### #643 の記述訂正

`docs/claude-plans/issue-643/add-pr-ci-workflow-with-db-unreachable-build.md` に、develop への直 push が不可能な理由として「CI に `push` トリガーが無い（#656）ため、直接 push されたコミットには checks が存在せず条件を満たせない」と記録されている。この理由づけは A を入れると陳腐化する（「push トリガーが付けば直 push が復活するのか」という誤読を招く）。

**結論は変わらない**（直 push は依然不可能）。本質はトリガーの有無ではなく**評価順序**であり、ruleset の required status checks は push を受け付ける**前**に評価されるため、push が拒否される → workflow が起動しない → checks が永久に付かない、というニワトリ卵になる。この訂正を `docs/claude-plans/issue-643/deviations.md` に追記する。

## ステップ

### Step 1: ci.yml に push トリガーと commit 単位の concurrency を追加する

- [x] **完了**
- 対象ファイル: `.github/workflows/ci.yml`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - `on:` に `push: branches: [main, develop]` を追加する（paths フィルタは付けない）
  - `concurrency.group` を `${{ github.workflow }}-${{ github.event_name == 'push' && github.sha || github.ref }}` に変更する
  - 意図コメントを残す:
    - push に paths を付けない理由（develop の HEAD が常に verdict を持つ状態を作る）
    - push だけ SHA 単位にする理由（連続マージで verdict を失うと犯人特定ができない／`workflow_dispatch` は ref 指定のため過去 SHA を後から検査できない／グループは実行中 1 + 待機中 1 しか保持しない）
    - PR 側を ref 単位のままにする理由
    - `playwright.yml` に push を付けない理由（→ ADR-20260729-d8c）
- コミットメッセージ: `ci: develop / main への push で CI を実行する`

### Step 2: ADR を起票し INDEX に追記する

- [x] **完了**
- 対象ファイル: `docs/adr/20260729-d8c-detect-and-prevent-stale-base-merges.md`（新規）、`docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - `docs/adr/TEMPLATE.md` に従って ADR を作成する。タイトルは「マージ後の検査を push トリガーで観測し、strict required status checks で stale マージを防ぐ」
  - 検討した選択肢として A / B / C を記載し、C の不採用理由（規模に対して過剰）を残す
  - 決定として、A + B の併用、`ci.yml` のみへの push、SHA 単位 concurrency、両 ruleset の strict 化、`rebaseWhen: behind-base-branch` の明示を記載する
  - **ruleset・`renovate.json`・`ci.yml` の 3 箇所にまたがる対応関係**を明記する（ADR の主要な存在理由）
  - ロールアウト節に、本 ADR 起票時点では Step 6 / Step 7 が未適用であることを記す
  - `docs/adr/INDEX.md` の適切なカテゴリ見出しに 1 行追記する
- コミットメッセージ: `docs: マージ後検査と stale マージ防止の ADR を追加する`

### Step 3: #643 の「直 push 不可」の理由を訂正する

- [x] **完了**
- 対象ファイル: `docs/claude-plans/issue-643/deviations.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - #643 の計画が記録した理由（push トリガーが無いため checks が存在しない）が本 issue の A によって陳腐化すること、および結論（直 push は不可）は変わらないことを追記する
  - 本質が「required status checks は push 受理の**前**に評価される」という評価順序であることを記す
- コミットメッセージ: `docs: issue-643 の「直 push 不可」の理由を訂正する`

> ここまでを 1 本の PR としてマージし、develop の push run が緑で起動することを疎通確認する。

### Step 4: 検証 A — 使い捨て 2 PR で意味的衝突を起こし、検知を確認する

- [x] **完了**（PR X = #675 / PR Y = #676。詳細は `deviations.md` 逸脱 1）
- 対象ファイル: `src/server/__tests__/helpers/` 配下（使い捨て）
- テスト戦略: テスト不要（CI 実地検証）
- 作業内容:
  - PR X: helper の export を 1 つリネームし、既存参照もすべて追随させる（X 単体の CI が緑になることを確認）
  - PR X をマージし、develop の push run が緑になることを確認する
  - PR Y: **X 以前の develop を base に**、旧名を import する `*.test.ts` を新規追加する（Y 単体の CI が緑になることを確認）
  - PR Y をマージする（PR の check は古い base のまま緑なのでマージできる ＝ イシューが問題視した経路そのもの）
  - 確認項目:
    - [x] develop の push run が赤くなる（`f500a1a2` = `failure`）
    - [x] commit 一覧に「緑 → 赤」の境界が現れ、Y が犯人として一意に読める（`297617fa` 緑 → `4c7a9d16` 緑 → `f500a1a2` 赤。3 コミットすべてに verdict が残った ＝ SHA 単位 concurrency が効いている）
    - [ ] ~~`static` ジョブで落ちる~~ → **前提が誤りだった。落ちたのは `test`**（`next build` は `*.test.ts` / `__tests__/` の診断を捨てる。→ 逸脱 1・#678）
    - [x] **失敗通知が実際にメールで届く**（確認済み。件名 `[chapplehub/estimate-management-system] CI workflow run` / 本文 `CI: Some jobs were not successful`。ジョブ単位の内訳（`CI / test` 失敗・`CI / static` 成功）とアノテーション件数まで載るため、メールを開いた時点でどちらの検査が落ちたかが読める。能動通知を足す必要は無いという Step の判断は妥当だった）
- コミットメッセージ: 使い捨て PR 側のため計画対象外（`test:` 型で任意）

### Step 5: 検証で壊した状態を revert する

- [x] **完了**（PR #677 = `ffbe5cf8`）
- 対象ファイル: Step 4 で変更したファイル
- テスト戦略: テスト不要（CI 実地検証）
- 作業内容:
  - Y と X をまとめて revert する PR を作成しマージする（`non_fast_forward` により force push で戻す経路は無い）
  - develop の push run が緑に戻ることを確認する
- コミットメッセージ: `revert: CI 検証用の変更を戻す`

### Step 6: renovate.json に rebaseWhen を明示する

- [x] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - トップレベルに `"rebaseWhen": "behind-base-branch"` を追加する
  - `description` ないしコメントで、両 ruleset の `strict_required_status_checks_policy: true` と対であること、`auto` の自動検出が Rulesets では信頼できないこと、"Update branch" を人間が押すと Renovate がそのブランチの管理を放棄することを記す
- コミットメッセージ: `ci: renovate の rebaseWhen を behind-base-branch に明示する`

> **Step 7 より必ず先にマージすること。** 逆順は「失敗したときに静かに壊れる」側を先に置くことになる。

### Step 7: 両 ruleset の required status checks を strict 化する

- [x] **完了**
- 対象ファイル: なし（GitHub API 操作、リポジトリ外）
- テスト戦略: テスト不要（リポジトリ外の設定変更）
- 作業内容:
  - `gh api` で `protect-develop`（id: 12978563）と `protect-main`（id: 12978605）の `required_status_checks` に `strict_required_status_checks_policy: true` を設定する
  - `required_status_checks` の中身（`static` / `test`）と他のルール（`deletion` / `non_fast_forward` / `pull_request`）は変更しない
  - 適用後、両 ruleset を読み直して差分が意図どおりであることを確認する
- コミットメッセージ: なし（リポジトリに変更が生じないため）
- 実施結果（2026-07-29）:
  - 適用前に現在の ruleset を `gh api` で取得し、`jq` で `strict_required_status_checks_policy` のみを書き換えて PUT した（手打ちの転記ミスを避けるため）。`name` / `target` / `enforcement` / `conditions` / `bypass_actors` も現在値を明示して送っている（PUT が省略フィールドをどう扱うかを保証に頼らないため）
  - 適用後に再取得して差分を取り、**両 ruleset とも変更は当該 1 行のみ**であることを確認した
  - 適用直後、base が develop の open PR 4 件（#670 / #671 / #672 / #673、いずれも Renovate）が `mergeable=MERGEABLE` のまま `mergeStateStatus=BEHIND` へ変化した。strict が実際に効いていることの直接の証拠であり、Step 8 の題材を作る前に確認できた

### Step 8: 検証 B — 同じ操作が事前に阻止されることを確認する

- [x] **完了**
- 対象ファイル: `src/server/__tests__/helpers/` 配下（使い捨て）
- テスト戦略: テスト不要（CI 実地検証）
- 作業内容:
  - Step 4 と同じ材料で PR X' / Y' を作り直す
  - 確認項目:
    - [x] X' をマージした後、Y' のマージが "This branch is out-of-date with the base branch" で**止まる**
    - [x] Y' で "Update branch" を実行すると CI が再実行され、今度は **PR 段階で赤くなる**（事後検知が事前防止に変わったことの確認）。赤くなるのは `test` ジョブである（`static` ではない。理由は `deviations.md` 逸脱 1）
  - X' / Y' は close し、develop に何も残さない（X' をマージしていた場合は revert する）
- コミットメッセージ: 使い捨て PR 側のため計画対象外
- 実施結果（2026-07-29）:

  | 項目 | 検証 A（strict 化前 / Step 4） | 検証 B（strict 化後 / Step 8） |
  |---|---|---|
  | 使い捨て PR | X=#675 / Y=#676 | X'=#680 / Y'=#681 |
  | 両者の base | `297617fa`（共通） | `54ace5f4`（共通） |
  | X マージ後の Y の checks | 再実行されず緑のまま | **同左**（run 30415795519 のまま） |
  | X マージ後の Y の状態 | `MERGEABLE` / `CLEAN` | `MERGEABLE` / **`BEHIND`** |
  | Y のマージ | **通った** → develop が赤化 | **拒否**（`the head branch is not up to date with the base branch`） |
  | develop の verdict | `f500a1a2` = failure | **一度も赤くならず**（`742cc824` = success） |

  - **確認項目 1**: Y'(#681) は checks が緑のまま `BEHIND` になり、`gh pr merge 681 --squash` が `the head branch is not up to date with the base branch` で拒否された（Web UI の "This branch is out-of-date with the base branch" と同じ判定）。**検証 A とまったく同じ入力に対して、結果だけが反転した**
  - **確認項目 2**: "Update branch"（`PUT /repos/:owner/:repo/pulls/681/update-branch`）後に CI が新しい run（30415980679）で再実行され、`static` = pass / `test` = fail。失敗内容は `AssertionError: expected undefined to be 1000`（`ensureEstimateFixtures.test.ts:7`）。予測どおり `test` 側で捕まった
  - 失敗が `undefined` として現れる点は題材の性質による。存在しない named export は TypeScript なら TS2724 だが、Vite/esbuild は型を捨てて実行するため実行時に `undefined` になる。**本番コードだけが壊れる意味的衝突は現状どのジョブも捕まえられない**ため、#678（独立した型検査の復活）の優先度を裏づける材料になる
  - 後始末: Y'(#681) は close、X'(#680) は #682 で revert 済み。develop（`e8f4f737`）は検証前と同じ内容に戻っている

### Step 9: イシューをクローズし、派生 issue を起票する

- [x] **完了**
- 対象ファイル: なし
- テスト戦略: テスト不要（ドキュメント作業）
- 作業内容:
  - #656 に検証結果（Step 4 / Step 8 の確認項目）を追記してクローズする
  - 派生として別 issue に切り出す:
    - rebase churn（1 日約 72 job）の実測と、痛い場合の `prConcurrentLimit` / schedule 調整
    - develop の E2E 健全性を nightly `schedule` で観測するかの検討
- コミットメッセージ: なし
- 実施結果（2026-07-29）:
  - #656 に検証 A / B の前後比較表を含む結果を追記し、作業項目 3 件をチェックしてクローズした
  - 派生 issue:
    - **#678** — `next build` が `*.test.ts` / `__tests__/` 配下の型エラーを捨てている（Step 4 の逸脱から派生。計画時点では想定していなかった）
    - **#684** — strict 化に伴う rebase churn の実測と、必要な場合の `prConcurrentLimit` / `schedule` 調整
    - **#685** — develop の E2E 健全性を nightly `schedule` で観測するかの検討
  - 計画に無かった観測として、Renovate PR #671 が「ブランチ先頭に renovate[bot] 以外のコミットが載っているため rebase されない」状態にあることが分かった。ADR が「気づく手段が実質ない」と書いた失敗モードの実例だが、**本 issue のスコープ外**のため issue 化していない（対応方針の判断が必要）
