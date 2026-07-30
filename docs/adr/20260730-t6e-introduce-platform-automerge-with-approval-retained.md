# ADR-20260730-t6e: Renovate automerge は platformAutomerge + squash-only リポジトリ設定で導入し、Dashboard 承認は維持する

| 項目 | 値 |
|------|-----|
| ステータス | 採用（適用は #704 マージ後） |
| 起票日 | 2026-07-30 |
| 最終更新日 | 2026-07-30 |

## コンテキスト

現行の依存更新フローは「Dashboard 承認 → PR 作成 → CI → **手動マージ**」で、人間が 2 回関与する。ADR-20260729-d8c の strict required status checks + `rebaseWhen: behind-base-branch` により、複数 PR は「1 本マージ → 残りが stale 化 → Renovate が rebase → CI 再実行」のカスケードで進むため、手動マージ運用では「緑を見届けてマージし、次の rebase を待ってまたマージする」逐次作業が発生している。#701 でこの後半（マージ以降）の自動化を検討した。

判断に先立つ実測事実:

- ruleset `protect-develop` の required checks は `static` / `test` の 2 つ（strict）。**required review・PR 必須ルールは存在しない** → automerge に approve ヘルパー類は不要
- リポジトリ設定 `allow_auto_merge` は **false**（GitHub ネイティブ auto-merge が無効）
- E2E（playwright.yml）は PR で走るが **required ではない**。#704 が「changes ゲート（除外リスト方式）+ `e2e report` の required 化」を進行中で、これが入ると Renovate PR（lockfile / package.json 変更）は必ず全 CI が走る
- マージ方式はリポジトリ設定上 merge commit / squash / rebase の 3 方式すべて許可だが、実運用は squash 一色（マージコミットは初期と手動マージの痕跡のみ）
- `security:minimumReleaseAgeNpm`（供給網 cooldown）と `dependencyDashboardApproval`（全更新の承認制、ADR-20260726-d3b）は導入済み

前提知識として、automerge の**待ち条件は経路で異なる**: Renovate 内蔵 automerge はブランチ上の**全チェック緑**を待つが、GitHub ネイティブ auto-merge（platformAutomerge が委譲する先）は **required checks のみ**を待つ。

## 検討した選択肢

### 論点 1: 人間ゲートの位置

- **A. `dependencyDashboardApproval` を維持し、マージ以降だけ自動化する（採用）** — 「承認 1 回・マージ 0 回」
- B. automerge 対象は承認も packageRule で免除し完全自動化する（不採用）

承認は minimumReleaseAge をすり抜ける供給網攻撃への最後の人間ゲートとして意図的に入れた設定（d3b）であり、automerge とは直交する。承認を残しても automerge の恩恵（CI 待ち → マージ → rebase 連鎖の自動化）はフルに得られる。まず A で運用し、ノイズと信頼度を見てから B へ進む判断は後からできる（逆は事故ってから戻すことになる）。

### 論点 2: automerge の対象スコープ

- **A. non-major 全部（minor / patch / pin / digest + lockFileMaintenance、node グループ含む）（採用）**
- B. 公式の階梯どおり lockFileMaintenance + devDependencies から始める（不採用）

公式が本番 dependencies の automerge に課す条件は「良好なテストカバレッジ」であり、vitest フルスイート + Playwright E2E が PR ごとに走る本リポジトリは満たす。承認ゲートが全更新に残るため、devDeps / prodDeps の差は「承認後にマージボタンを押すか否か」だけで、そこを分ける実益が薄い。分けると Dashboard 上のフローが二層化し承認時の認知コストが残る。rangeStrategy pin（ADR-20260730-aan）下の non-major は lockfile + pin 更新でありリスクプロファイルは均質。node グループ（.nvmrc + @types/node）も CI 自体が新バージョンの Node で全テストを回すため除外理由がない。major は `automerge` 既定 false のまま自動対象外（承認後も手動マージ）。

### 論点 3: マージ経路

- **A. platformAutomerge（既定 true のまま）= GitHub ネイティブ auto-merge に委譲（採用）**
- B. `platformAutomerge: false` = Renovate 内蔵 automerge（不採用）
- C. `automergeType: branch`（不採用）

検討の経緯自体が文脈依存である: **#704 が存在しなければ B が優位**だった。内蔵 automerge は全チェック緑を待つため、E2E を required 化せずにマージ条件へ組み込める（A で穴を塞ぐには E2E の required 化が必須で、Renovate 対応の副作用として重すぎる）。しかし #704 が本体側の理由で `e2e report` を required 化するため、この優位は消滅し、残る差分はすべて A に有利となった:

- A は「CI 緑 → 即マージ」。B は緑になっても次の Renovate 実行までマージされず、1 実行 1 マージの制約もある（カスケードの律速はどちらも Renovate の実行頻度だが、B は各 PR の最後の待ちが上乗せされる）
- #704 後は「required セット = 意味のあるチェック全部」が成立するため、B の全チェック緑待ちはむしろ**過剰ブロックの芽**になる（将来増える情報提供系の非必須チェックが赤いだけで automerge が黙って止まる）
- A は Renovate の既定値であり、renovate.json に否定の設定を書き足す必要がなく構成が薄い

C（branch 型、PR を作らず base へ直接コミット）は、CI が `pull_request` トリガーでしか走らないため workflow 改修が必要な上、PR 番号付き squash 履歴（`chore(deps): ... (#700)`）の可視性が失われるため除外。

### 論点 4: マージ方式の固定場所

- **A. リポジトリ設定を squash-only 化する（採用）** — `allow_merge_commit` / `allow_rebase_merge` を無効化
- B. renovate.json に `automergeStrategy: "squash"` を書く（不採用）

`automergeStrategy` は「`automergeType=pr`（= 内蔵マージ）でのみ使用される」と公式に明記されており、platform 経路では効かない **dead config** になる（トップレベル rangeStrategy と同じ罠 → aan）。3 方式許可のままでは GitHub の auto-merge がどの方式で発火するかを Renovate 側から保証できない。リポジトリ設定を実態（squash 一色）に一致させれば、Renovate にも人間の PR にも一律で強制され、不確定性が定義から消える。`squash_merge_commit_title: COMMIT_OR_PR_TITLE` 設定済みのため、Renovate PR タイトルがそのままコミットタイトルになり現履歴と同型。

## 決定

1. **renovate.json**: `lockFileMaintenance: { "automerge": true }` と packageRule `{ matchUpdateTypes: ["minor", "patch", "pin", "digest"], automerge: true }` を追加する。`platformAutomerge` は既定 true のまま何も書かない
2. **リポジトリ設定**: `allow_auto_merge` を有効化し、`allow_merge_commit` / `allow_rebase_merge` を無効化する（squash-only）
3. **適用順序**: **#704（`e2e report` の required 化）のマージ後にのみ適用する**。順序が逆だと「E2E 赤でも required（static + test）緑ならマージされる」穴が開いたまま automerge が動き出す

### 書かない設定（すべて積極的な理由による不使用）

- `automergeSchedule`: platformAutomerge 有効時は「PR 作成時に enqueue されるため従えない」と公式明記。書くと dead config
- `automergeStrategy`: 内蔵マージ専用（論点 4）
- `ignoreTests`: テストが存在するので不要
- `assignAutomerge`: 既定 false のまま。CI 赤で automerge できない時だけ assignee 通知が来る挙動は、無人運用の失敗検知としてむしろ望ましい
- `prConcurrentLimit: 3`: 据え置き。承認ゲートが作成数を制御しており、カスケード rebase の同時 CI 消費を抑える現在値は automerge 後も適合

## 根拠

- 手動マージ運用の実労力の大半は承認ではなく「緑待ち → マージ → rebase 待ち」の逐次作業であり、そこが丸ごと消える。`rebaseWhen: behind-base-branch` + strict checks + automerge は公式が推奨するカスケード構成そのもの
- 「required のみ待つ」というネイティブ auto-merge の構造的弱点は、#704 により required セットが意味のあるチェック全部と一致することで消える。逆に言えば **required セットの完全性が本 ADR の安全性の前提**である
- 制約は効く場所に置く: マージ方式の保証は Renovate 設定では取れないため、GitHub リポジトリ設定で取る

## 影響

- **#704 が先行マージされるまで本設定を適用してはならない**（順序制約が唯一の安全条件）
- 特定の依存を automerge から外したくなったら packageRule で `automerge: false` を個別追加する（枠組みは維持）
- automerge のタイミング制御（automergeSchedule）は platform 経路では使えない。必要になったら `platformAutomerge: false` への切替を検討することになるが、その時は全チェック緑待ち・実行頻度律速のトレードオフが復活する（本 ADR 論点 3 の再検討）
- squash-only 化は人間の PR にも及ぶ。意図的にマージコミットを使う場面（long-running ブランチ統合等）では設定を一時的に戻す必要がある
- B（承認免除の完全自動化）への移行は運用実績を見て別 ADR で判断する
- required セットの完全性に依存するため、**今後 required checks を減らす変更は本 ADR の前提を壊す**ことを意識すること

## 関連

- Issue #701（本検討）/ #704（e2e report の required 化。本 ADR の適用前提）
- ADR-20260726-d3b（`dependencyDashboardApproval` の導入意図。論点 1 の根拠）
- ADR-20260729-d8c（strict required status checks + `rebaseWhen`。カスケードの土台）
- ADR-20260730-aan（dead config の教訓。論点 4 と「書かない設定」の判断枠）
- [Renovate: Automerge configuration and troubleshooting](https://docs.renovatebot.com/key-concepts/automerge/)
