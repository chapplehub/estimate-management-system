# ADR-20260729-d8c: マージ後の検査を push トリガーで観測し、strict required status checks で stale マージを防ぐ

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-29 |
| 最終更新日 | 2026-07-29 |

## コンテキスト

`ci.yml` / `playwright.yml` のどちらにも `push` トリガーが無く、**マージ後の develop / main を検査する run が 1 つも存在しない**（#656）。CI が答えているのは「この PR は緑か」だけで、「develop はいま緑か」を誰も答えていない。

これが実害になるのは、GitHub の `pull_request` イベントの意味論による。PR の run が検査するのは head そのものではなく `refs/pull/{N}/merge`、すなわち **run の開始時点の base と head を合成した仮想コミット**である。そして base が進んでも run は再実行されない。したがって PR に付いた緑は「あの時点の base に対する緑」でしかなく、時間の経過とともに黙って陳腐化する。

git のマージはテキストの行単位でしか衝突を見ないため、次のような変更は 2 つの PR が別ファイルに触れている限り**衝突せずにマージされ、マージ後に初めて壊れる**。

| PR A | PR B | マージ後 |
|---|---|---|
| `export` をリネームし、既存の参照を全て追随させた | 旧名を import する新しいファイルを足した | 参照先が存在せず型検査が落ちる |
| Value Object のコンストラクタに引数を足した | 旧シグネチャで同じ VO を生成するコードを足した | 引数不足で型検査が落ちる |
| Prisma に必須カラムを足し、既存ファクトリを追随させた | 追随前のファクトリを使うテストを足した | 実行時に必須カラム欠落で落ちる |

以下これを **意味的衝突（semantic conflict）** と呼ぶ。B の PR は自分自身の CI が緑のままマージでき、develop が壊れても誰も通知を受けない。次に無関係の PR を出した人が赤い CI を見て自分の変更を疑うところから始まる — 誤診のコストは、壊した本人ではなく次の人が払う。

#643 で両 ruleset に required status checks（`static` / `test`）を入れたが、`strict_required_status_checks_policy` は `false` のままにしてある。これは「checks が緑であること」だけを要求し、「その checks が最新の base に対する緑であること」は要求しない設定であり、上記の経路はこの穴をそのまま通る。

## 検討した選択肢

### A. `push` トリガーの追加（採用 / 事後検知）

`ci.yml` に `push: branches: [main, develop]` を足し、マージ後の状態を検査する run を起動する。壊れることは防げないが、壊れたことが即座に分かる。

### B. `strict_required_status_checks_policy: true`（採用 / 事前防止）

両 ruleset の required status checks を strict 化し、base が進んだ PR のマージを止める。マージ前に base 最新で CI を回し直させるため、意味的衝突は PR 段階で赤くなる。

### C. merge queue（不採用）

マージ対象を GitHub 側のキューで直列化し、キュー内で「base + 先行するキュー要素 + 自分」を合成して検査してから入れる。B と違い、マージ待ちの PR が複数あっても人手の rebase 往復が発生しない。

### D. `push` を `playwright.yml` にも付ける（不採用）

E2E も含めてマージ後の develop を検査する。

### E. push run の concurrency を現状の式のまま流用する（不採用）

`group: ${{ github.workflow }}-${{ github.ref }}` を push にも適用する。

### F. push のときだけ `cancel-in-progress: false` にする（不採用）

古い run をキャンセルせず順に消化させる。

### G. push のときだけグループを commit（SHA）単位に分離する（採用）

### H. Renovate の `rebaseWhen` を既定の `"auto"` に任せる（不採用）

### I. Renovate の `rebaseWhen` に `"behind-base-branch"` を明示する（採用）

## 決定

**A と B を併用する。** `ci.yml` にのみ `push: branches: [main, develop]` を足し、push run の concurrency グループは commit（SHA）単位に分離する。両 ruleset（`protect-develop` / `protect-main`）の `required_status_checks` を `strict_required_status_checks_policy: true` にし、それと対で `renovate.json` に `"rebaseWhen": "behind-base-branch"` を明示する。

決定は 3 箇所に分かれて宿る。**ruleset はリポジトリの外にあり、コメントを書く場所が無い**ため、対応関係を記述できるのはこの ADR だけである。

| 箇所 | 何が置かれるか | 役割 |
|---|---|---|
| `.github/workflows/ci.yml` | `push` トリガー ＋ SHA 単位の concurrency | A（事後検知） |
| GitHub ruleset `protect-develop` (12978563) / `protect-main` (12978605) | `strict_required_status_checks_policy: true` | B（事前防止） |
| `renovate.json` | `"rebaseWhen": "behind-base-branch"` | B の副作用を Renovate 自身に吸収させる |

**後ろ 2 つは対であり、片方だけ変更してはならない。** strict 化は「base が古い PR はマージできない」を意味するため、Renovate の PR は誰かが rebase しない限り永久にマージできなくなる。その rebase を Renovate 自身にやらせるのが `rebaseWhen` である。

## 根拠

### なぜ A と B の併用か（A vs B）

排他ではなく、守る対象が違う。

B は「PR 経由の stale マージ」を止めるが、**develop がいま緑かという状態そのものを持たない**。B を入れても、CI 環境側の変化（レジストリ、Actions ランナーイメージ、外部サービス）で develop が壊れることは防げないし、そもそも「壊れていないこと」を確認した run が存在しない状態は変わらない。A はその状態を持つ唯一の手段で、事前防止では代替できない。

逆に A だけでは、意味的衝突が「起きてから直す」運用になる。B は起きる前に止める。

投入順序は **A →実物で検証→ B** とする。B を先に入れると、「B のせいでマージが止まったのか、CI が本当に壊れているのか」を切り分ける観測点が無いまま運用に入ることになる。

### なぜ merge queue を採らないか（C）

merge queue が解く問題は「**複数人がマージを競う**」ことである。キューは、同時にマージされようとしている PR 同士の組み合わせを直列に検査する機構であり、価値はマージの並行度に比例する。

本リポジトリは単独開発者 + Renovate であり、直列化すべき競合が構造的に存在しない。Renovate の PR が同時に複数 open になることはあるが、マージは人間が 1 件ずつ押している。B が要求する「base 最新化の往復」も、キューが吸収するほどの頻度で発生しない。規模に対して過剰であり、キューの設定・失敗時の挙動・required checks との相互作用という新しい理解コストのほうが大きい。

### なぜ `ci.yml` だけに push を付けるか（A vs D）

3 つある。

1. コンテキストに挙げた意味的衝突の例はいずれも `static`（型検査）と `test`（Vitest）の射程内にある。E2E を毎マージ回して追加で捕まえられるものが、費用に見合わない。
2. **E2E の flaky が A の中核価値を壊す。** A の価値は「develop が赤い ＝ 直近のマージが犯人」という attribution にある。既知の非決定要因（単一 shard の全面 404 ＝ Next dev のスキャンレース / [next#96139](https://github.com/vercel/next.js/issues/96139)）で develop がランダムに赤くなり始めると、信号が腐って誰も見なくなる。**赤の意味が壊れることは、赤が出ないことより悪い。** `static` / `test` は決定的なのでこの汚染がない。
3. `playwright` は required check ではない（#643 の判断）。PR 段階で保証していないものを push 側だけ厳格に見るのは非対称であり、それは「playwright を required に昇格させるか」という別の関心事に属する。

develop の E2E 健全性を観測したくなった場合、適した器は push ではなく nightly の `schedule` である（flaky が attribution を壊さず、同時実行枠の競合も夜間に逃がせる）。別 issue として扱う。

### なぜ push だけ concurrency を SHA 単位に分けるか（E / F vs G）

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'push' && github.sha || github.ref }}
  cancel-in-progress: true
```

concurrency の常識（同一グループの run を畳んで無駄を省く）と逆を向いて見えるので、理由を残す。

E（ref 単位のまま）を採ると、連続マージ — Renovate の PR をまとめてマージするときに実際に起きる — で**最後の 1 commit 以外が `cancelled` になり、verdict を失う**。残るのは「develop の HEAD が赤い」という 1 ビットだけで、5 つマージしたうちどれが犯人かは分からない。これは #656 が問題視した誤診を、PR 単位からブランチ単位に移すだけである。

F（`cancel-in-progress: false`）は解決にならない。concurrency グループが保持するのは**実行中 1 本 + 待機中 1 本**だけで、3 本目が到着した時点で待機中の 2 本目が捨てられる（GitHub Docs: "any existing `pending` job or workflow in the same concurrency group will be canceled"）。連続マージという、まさに問題が起きる場面で取りこぼす。

そして **取り逃した verdict は回復不能**である。`workflow_dispatch` は ref（ブランチ / タグ）を指定してしか起動できず、任意の過去 SHA を後から検査する手段が無い。`git bisect` を手で回すしかなくなる。

G ならば全 commit に verdict が付き、commit 一覧に「緑 → 赤」の境界が現れて、その 1 コミットがそのまま犯人になる。実質的に、**壊れる前に `git bisect` を全区間ぶん先に済ませている**状態を作っている。ランナー費用は public リポジトリのため発生せず、効くのは同時実行枠（20）だけである。

PR 側（`refs/pull/{N}/merge`）を ref 単位のままにするのは、PR で問われるのが HEAD が緑かだけであり、中間 commit の verdict に用が無いためである。1 つの式に 2 つのポリシーが同居しているのはこの非対称性の帰結であって、書き分けそびれではない。

### なぜ paths フィルタを付けないか

`ci.yml` が `pull_request` で paths を付けていない理由（required status check は「起動しなかったジョブ」を待ち続けてマージ不能にする）は、push には**当てはまらない**。required checks は PR のマージ判定にしか使われないためである。

それでも push に paths を付けないのは、別の理由による。A の目的は develop の HEAD が**常に** verdict を持つ状態を作ることであり、間引くと「最後に緑だったのは 3 コミット前」という読み取りにくい状態が生まれる。緑 → 赤の境界が犯人を指すという G の設計も、境界が連続していることに依存している。

### なぜ main にも strict を入れるか

本 ADR 起票時点で main は develop の**真の祖先**である（`develop..main` = 0 commits、`main..develop` = 492 commits）。develop → main のリリース PR は定義上つねに base を取り込み済みであり、strict は現状 **no-op として入る**。

no-op でなくなるのは、main に hotfix が直接入って develop → main の PR が stale になる場面である。それはまさに機械に強制させたい場面であり、しかも最も慌てている時に起こる。main が休眠中の今が、最も安く入れられるタイミングである。

加えて「develop は strict、main は非 strict」という非対称は、半年後に誰も理由を覚えていない。理由を思い出せない非対称は事故を生む。

### なぜ `rebaseWhen` を明示するか（H vs I）

`rebaseWhen` の既定値 `"auto"` は、「ブランチが最新であることを要求するリポジトリ」を検出したときに `behind-base-branch` へ切り替わる。つまり **strict 化に対して Renovate 側が自動で追随することを期待できる**設計になっている。それでも明示するのは、検出の信頼性と、検出に失敗したときの帰結の悪さによる。

この検出は classic branch protection を前提に作られており、**Rulesets での検出には既知の不具合報告がある**（[renovatebot/renovate discussion #38302](https://github.com/renovatebot/renovate/discussions/38302)）。本リポジトリは ruleset 運用である。

検出に失敗すると、Renovate の PR は stale のまま放置される。そこで人間がマージしようとして GitHub の **"Update branch" ボタンを押すと、それはユーザー名義のコミットを PR ブランチに足す操作**であるため、Renovate の規則「If you push a new commit to a Renovate branch ... then Renovate stops all updates of that branch」（[Updating and Rebasing branches](https://docs.renovatebot.com/updating-rebasing/)）が発動する。**その PR は Renovate の管理から静かに外れる** — PR は残りマージもできるが、以降 Renovate は更新せず、close するまで同じ依存の新しい PR も作らない。気づく手段が実質ない。

明示すれば、ruleset の実装詳細と Renovate の検出ロジックから切り離せる。これは `.nvmrc` を単一ソースにする（ADR-20260728-44b）、`DATABASE_URL` をサービスコンテナ / ジョブ env / `.env.unit.example` の三者で一致させる、`db-unreachable.invalid` で「偶然の到達不能」ではなく「宣言された到達不能」にする（#643）と同じく、**推測される既定値ではなく宣言された値に依存する**という一貫した方針でもある。

### なぜ `rebaseWhen` を strict 化より先に入れるか

順序には片方向の危険がある。

- **strict 化 → `rebaseWhen` 明示**: その間、Renovate の autodetect が ruleset を検出できるかに賭ける窓が開く。失敗すれば PR は stale のまま放置され、"Update branch" を押した瞬間にその PR が Renovate 管理から静かに外れる。
- **`rebaseWhen` 明示 → strict 化**: 副作用は「strict でない期間に rebase の churn が先行する」だけで、壊れる方向の失敗が無い。

**静かに壊れる側を後ろに置く。**

### 検証の方法

「意図的に壊した状態で想定どおり検知されること」は、使い捨ての 2 PR で本物の意味的衝突を再現して確認する。

注意すべきは、**壊れた commit を develop に入れる経路が他に無い**ことである。自分自身が赤い PR は required checks に阻まれてマージできず、直 push も「その SHA に緑の checks が報告されていること」を要求されるが、そもそも develop 以外では run が起動しないため条件を満たせない（後述）。つまり **develop を壊す正当な経路は、#656 が問題視した「stale base の緑」しか残っていない** — 検証したいシナリオと、それを実施できる唯一の手段が一致している。

## ロールアウト

本 ADR は決定の全体を記述しているが、**起票時点で適用済みなのは A のみ**である。3 箇所のうち 2 箇所は未適用の状態でこの ADR がマージされる。

| 箇所 | 起票時点 | 2026-07-29 現在 |
|---|---|---|
| `ci.yml` の `push` トリガー ＋ SHA 単位 concurrency | 適用済み（本 ADR と同じ PR） | 適用済み |
| `renovate.json` の `rebaseWhen` | **未適用** | 適用済み（#679） |
| 両 ruleset の `strict_required_status_checks_policy` | **未適用**（`false` のまま） | 適用済み（`true`） |

順序は「A →実物で検証→ `rebaseWhen` → strict 化」であり、間に検証を挟むため同一 PR にはならない。進捗は `docs/claude-plans/issue-656/` を参照。**ruleset の実際の値は `gh api repos/:owner/:repo/rulesets/12978563` で確認できる** — この ADR の記述ではなく、そちらが正本である。

strict 化の適用直後、base が develop の open PR 4 件（Renovate）はいずれも `mergeable=MERGEABLE`（git 的な競合なし）のまま `mergeStateStatus=BEHIND`（マージ不可）へ変化した。この組み合わせが本 ADR の対象そのものであり、strict 化前は同じ 4 件が `CLEAN` としてマージ可能だった。

## 影響

- **develop が赤いことがあり得る状態になる。** これまで develop の CI 状態は「存在しない」だったが、以後は緑か赤のどちらかになる。デプロイ連携は無い（`deployments` / `environments` ともに 0 件）ため、赤が直ちに何かを止めることはない。
- **通知は GitHub Actions の既定のメール通知に頼る。** 失敗時に issue を自動起票する等の能動通知は、`issues: write` を要求し、`ci.yml` の `permissions: contents: read` を開くことになる。これは #643 が明示的な理由で閉じた設計（`pnpm install` が `only-allow` / `onlyBuiltDependencies` のビルドスクリプトを実行するため、書き込み権限付きトークンを同じ run に置かない）であり、Renovate PR を検査する CI で書き込みトークンと未検証の依存のビルドスクリプトを同居させることになる。**通知の便宜のために攻撃面を広げるのは割に合わない。** 既定通知は「自分が actor になった run の失敗」を通知し、PR をマージすると develop への push の actor はマージ実行者になるため、単独開発の本リポジトリでは通知先と当事者が常に一致する。**#656 の検証 A で実地確認済み** — 件名 `[chapplehub/estimate-management-system] CI workflow run`、本文 `CI: Some jobs were not successful`、ジョブ単位の内訳（どのジョブが何分で失敗したか）とアノテーション件数まで載る。メールを開いた時点で `static` と `test` のどちらが落ちたかが読めるため、能動通知で足せる情報はほとんど無い。
- **strict 化により、base が進むたびに全 open PR の rebase が要る。** Renovate が自分で行うため人手はかからないが、develop へ 1 マージするごとに open PR 全部が rebase され、その全てで CI が再起動する。起票時点の観測（open 4 PR）を基にすると `4 PR × (ci 2 job + playwright 7 job) = 36 job`、1 日 2 マージで約 72 job/日。public リポジトリのため課金は無く、効くのは同時実行枠（20）のみ。

  ただし**この概算の前提は既に動いている**。ADR-20260728-9kq（#669）が `packageRules` の non-major ベース層を廃してモノレポ単位のグルーピングに移したため、同時に open になる PR 数は起票時点の観測と一致しない。数字ではなく「open PR 数に比例して job が増える」という構造だけを受け取ること。実測して痛ければ `prConcurrentLimit` や `schedule` で調整する（別 issue）。
- **人間が "Update branch" を押してはならない。** 押すとその Renovate PR が Renovate の管理から静かに外れる。Renovate PR が stale なときは、Renovate の次回 run を待つか、Dependency Dashboard のチェックボックスで rebase を要求する。
- **`playwright` は push で検査されない。** develop の E2E 健全性は誰も観測していない。この穴は意図的なもので、埋めるなら nightly `schedule` が適した器である。
- **push トリガーが増えても develop への直 push は依然できない。** #643 の計画は直 push が不可能な理由を「CI に `push` トリガーが無いため checks が存在しない」と記録したが、本 ADR の A を入れてもこの結論は変わらない。本質はトリガーの有無ではなく**評価順序**であり、ruleset の required status checks は push を受け付ける**前**に評価される。よって push が拒否される → workflow が起動しない → checks が永久に付かない、というニワトリ卵になる。
- **`ci.yml` の実行回数は概ね倍になる。** 1 PR につき PR run と push run が 1 本ずつ走る。push run は PR run とほぼ同じ内容を検査するが、**base が進んでいれば別のもの**を検査している。冗長に見えたときにこの ADR を読むこと。
