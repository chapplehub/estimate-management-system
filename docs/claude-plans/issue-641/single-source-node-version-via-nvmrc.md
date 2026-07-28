# Issue #641: engines.node（^22）と CI の node-version（24.15.0）のメジャー不一致を解消する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

Node のメジャーバージョンが宣言（`engines.node: ^22` / `@types/node: ^22`）・ローカル（22.14.0）と CI（`playwright.yml` の 24.15.0）で不一致になっている状態を解消する。

方針は **A（22 系に寄せる）**。あわせて、値を 4 ジョブに書き写す構造そのものを廃し、`.nvmrc` を単一ソースにする。Renovate 側では Node 本体と型定義が別々に動かないようグループ化し、決定の理由を新規 ADR として記録する。

対象は以下の 3 系統。

| 系統 | 対象 | 検証タイミング |
|---|---|---|
| ① CI の実行 Node | `.nvmrc` 新設、4 ジョブの `node-version-file` 化、`playwright.yml` の paths 追加 | 本 PR の CI |
| ② Renovate 方針 | `helpers:disableTypesNodeMajor` 除去、`node` グループ追加 | マージ後のジョブログ |
| ③ 文書 | 新規 ADR、`INDEX.md`、ADR-20260726-d3b §保留事項 2 | — |

composite action（`.github/actions/setup`）への括り出しは**本 issue に含めず別 issue へ切り出す**。

## 設計判断

### 1. Node のメジャーをどちらに寄せるか
- A. CI を 22 系へ下げる
- B. `engines.node` / `@types/node` を 24 へ上げる
- **選択: A**。宣言・型・ローカル・`ci.yml` の 4 箇所中 3 箇所が既に 22 で、変更は `playwright.yml` の 2 箇所に収まる。24 固有機能への依存がなく、B ではローカル環境の入れ替えと `helpers:disableTypesNodeMajor` の一時解除まで波及する。加えて B を採っても 24.16.0 の Playwright ハング未解決により CI は 24.15.0 のピンから動かせず、「浮動できないピン」という異常が残る。
- 受け入れたトレードオフ: Node 22 は 2027-04-30 EOL のため、24 への移行がいずれ必須になる。

### 2. 値を単一ソース化するか
- A. `.nvmrc` を新設し 4 ジョブは `node-version-file` で参照する
- B. 値を 22 に揃えるだけ（4 ジョブに直書きを維持）
- **選択: A**。本 issue が問題視しているのは「24 という値」ではなく、宣言と実行が別々に書かれ片方だけ動いた**構造**。B では同期の責任が人間に残り、24 移行時に同じ乖離が再発する。ローカルが nvm 運用のため `.nvmrc` は `nvm use` が読み、CI とローカルが物理的に同一ファイルを参照する状態になる。
- `.node-version` ではなく `.nvmrc` を選ぶ理由: `setup-node` は両方読めるが、**nvm が読むのは `.nvmrc` のみ**（`.node-version` は fnm / asdf / nodenv 系の慣習）。

### 3. `.nvmrc` に書く値の粒度
- A. 22 系最新の厳密版（v22.23.1）
- B. ローカル現行の 22.14.0
- C. `22`（メジャー表記）
- **選択: A**。C は Renovate がパッチ更新を提案できず、CI 側で無言のパッチ差が生じる（`playwright.yml` が「浮動による非決定性を排除」として `lts/*` を捨てた判断と衝突する）。B は 2025-02 リリースで 1 年半分のセキュリティパッチを見送ることになり、「今後保守される単一ソース」の初期値として不適。
- 補足: `node` versioning は **range 非対応**のため `^22` は `.nvmrc` に書けない。

### 4. composite action への括り出しを本 issue に含めるか
- A. 別 issue に切り出す
- B. 本 issue に含める
- **選択: A**。解いている問題が違う（本 issue は Node の乖離、composite 化は setup-node / pnpm install / db:generate の重複）。また本 issue には「22 系で Playwright のブラウザ取得と E2E が通ること」の検証が含まれ、同 PR で 4 ジョブの実行経路を組み替えると、E2E が割れたときに 22 化と composite 化の切り分けができない。リバートの単位も壊れる。

### 5. Renovate で Node 本体と型定義をどう扱うか
- A. `helpers:disableTypesNodeMajor` を外し、`node` + `@types/node` を 1 グループにする
- B. プリセットを維持し、Node のメジャー移行は Renovate の外（手動）で扱う
- **選択: A**。B では 24 移行時に `.nvmrc` / `engines.node` の major PR は出るが `@types/node` だけプリセットが黙らせるため、「実行は 24・型は 22」という #641 の鏡像が生まれ、かつ気づく材料がない。プリセットの目的は「型が本体に先行するのを防ぐ」ことで、同時更新グループがあれば先行は構造的に起きず、プリセットはグループの片翼を封じる害だけが残る。
- 既存の `react` / `react-dom` / `@types/react` / `@types/react-dom` グループ（本体と型定義の連動）と同型であり、`renovate.json` が既に持つ語彙に乗る。
- 配置順序: `major` ルール（`groupName: null`）より**後ろ**に置く。`renovate.json:28` のコメントが定める合成順序に従い、major でも 3 者が 1 PR で揃う。
- 副次効果: ワークフローから値が消えることで `github-actions` manager の `uses-with`（`with: node-version`）抽出対象が消滅し、Node の更新経路が `nvm` manager 1 本に収束する。issue が挙げた「Renovate が 24.15.0 を上げうる」懸念は `matchDepNames` による無効化を要さず解消する。

### 6. `engines.node` の扱い
- A. `^22` を維持する
- B. `.npmrc` に `engine-strict=true` を足してローカルでも強制する
- **選択: A**。`.nvmrc`（実際に走らせる 1 つの版）と `engines.node`（動作を保証するメジャー範囲）は粒度が違い重複ではない。B は `pnpm install` の瞬間にしか効かず（`test` / `build` / `e2e` は誤った Node でも走る）、24 移行時の動作確認を入口で止める副作用もある。ローカルの取り違え防止は `.bashrc` の nvm 自動切り替えで解くほうが全コマンドに効く（リポジトリ外の話）。

### 7. Node 更新 PR で E2E を起動させる担保
- A. `playwright.yml` の paths に `.nvmrc` を追加する
- B. paths フィルタごと撤廃する（`ci.yml` と同様）
- **選択: A**。現在 paths に `.nvmrc` は無く、単一ソース化すると「`.nvmrc` だけが変わる PR」＝ `node` グループの Renovate PR で E2E がまったく起動しなくなる。Node 更新こそ #641 の発端（Playwright のブラウザ展開ハング）が示すとおり E2E で検証すべき変更であり、ADR-20260726-d3b の「playwright → ブラウザバイナリの再取得」という確認要求とも食い違う。B は 4 shard の実行コストを docs 変更でも払うことになり、別の判断を要する。
- 申し送り: composite action 化の際は `.github/actions/**` を同じ paths に追加しないと同型の穴が空く。切り出し先の issue に記載する。

### 8. 検証の方法と順序
- **選択**: 検証は**本 PR の CI 実行**で行い、4 ジョブの緑を確認してからローカルを `nvm install` で追随させる。
- ローカルで E2E 全体は回さない（方針: 変更に関係するスペックのみ、全体は CI）。加えて #641 が問うているのは「CI が宣言どおりの Node で動く保証」であり、ローカルの緑は証明にならない。逆順にすると、ローカルで踏んだ問題が Node 由来か環境由来か切り分けられない。

### 9. 決定の記録先
- A. 新規 ADR を起票し、ADR-20260726-d3b §保留事項 2 は解決済みとして新 ADR を参照する
- B. d3b §保留事項 2 の更新だけで閉じる
- **選択: A**。ADR-0000 の記録基準 3 条件を満たす（①覆すと `.nvmrc` / `engines.node` / `@types/node` / CI 4 ジョブ / `renovate.json` が連動 ②「なぜ 24 が LTS 最新なのに 22 か」「なぜ推奨プリセットを外したか」は文脈なしでは逆方向に見える ③複数の選択肢を検討）。d3b は「Renovate をどう導入するか」の記録であり、本件は Renovate 非依存に成立する別の決定。24 移行時に読まれるべきは Node バージョン方針の ADR であって Renovate 導入 ADR ではない。
- `CONTEXT.md` には追記しない（見積管理ドメインの用語集であり、実装詳細を含めない旨が冒頭に明記されている）。

### 10. ワークフローのコメントの扱い
- A. 理由本文は ADR に集約し、各 `setup-node` には ADR 参照の 1 行だけ残す
- B. ワークフローからは一切消して ADR に完全集約する
- **選択: A**。`.nvmrc` はコメントを書けないため理由の行き先が必要。ADR-0000 は参照トークンをコードのコメントに直書きする運用を前提に ID を設計しており、導線を張るのがこのリポジトリの作法。1 行の参照は説明の複製ではなく、`ci.yml:62-67` と `playwright.yml:87-89` のように**互いに食い違う説明が並ぶ事態**は構造的に消える。
- 24.16.0 ハングの経緯は ADR が引き取る。**24.18.0 まで進んでおり既に解消している可能性がある**旨も併記し、「24 は地雷」という誤った印象を残さない。

### 11. PR とコミットの構成
- A. 1 PR・3 コミット（ci → chore → docs）
- B. Renovate 設定を別 PR に分ける
- **選択: A**。5 つの作業項目はすべて「22 に寄せる」という単一の決定から機械的に導かれ、分割する境界が決定の側にない。B では①だけ先に入る中間状態が「Node は上がるが型は上がらない」構成になり、今回潰したい乖離そのものを一時的に作る。③を後追いにすると存在しない ADR-ID を参照する期間ができる。
- コミットを 3 つに割るのは、② が CI 検証の対象外でリバートの単位が ① と異なるため。

## ステップ

### Step 1: `.nvmrc` を新設し CI 4 ジョブを単一ソース化する
- [x] **完了**
- 対象ファイル: `.nvmrc`（新規）、`.github/workflows/ci.yml`、`.github/workflows/playwright.yml`
- テスト戦略: テスト不要（設定ファイル。検証は本 PR の CI 実行が担う）
- 作業内容:
  - `.nvmrc` を新設し、Node 22 系最新の厳密版を 1 行で記述する（計画時点で v22.23.1。**実装時に `nvm ls-remote --lts 22` 等で再確認する**）
  - `ci.yml` の `static` / `test`、`playwright.yml` の `test` / `merge-reports` の計 4 ジョブで、`node-version:` を `node-version-file: .nvmrc` に置換する
  - 各 `setup-node` に ADR 参照の 1 行コメントを置く（`# Node の版は .nvmrc が単一ソース（→ ADR-YYYYMMDD-sss）`）。ADR の ID は Step 3 で採番するため、本ステップでは仮置きせず Step 3 で確定・反映する
  - `playwright.yml:87-89`（24.15.0 のピン理由）、`ci.yml:62-67`・`ci.yml:141`（22.14.0 の理由と「#641 で単一ソース化する」の申し送り）を削除する
  - `playwright.yml` の `paths` に `.nvmrc` を追加する
- コミットメッセージ: `ci: Node の版を .nvmrc に単一ソース化し 22 系へ統一する`

### Step 2: Renovate で Node 本体と型定義を同一グループにする
- [x] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル。実挙動の確認はマージ後の Step 5）
- 作業内容:
  - `extends` から `helpers:disableTypesNodeMajor` を除去する
  - `packageRules` の**末尾**に `node` グループを追加する（`matchPackageNames: ["node", "@types/node"]` / `groupName: "node"`）。`major` ルールより後ろに置くことでグループが復活する合成順序を利用する
  - `description` に「Node 本体（`.nvmrc` / `engines.node`）と型定義は同時に上げる」旨と、プリセットを外した理由を記す
- コミットメッセージ: `chore: Node 本体と型定義を同一グループで更新する`

### Step 3: 決定を ADR として記録する
- [ ] **完了**
- 対象ファイル: `docs/adr/YYYYMMDD-sss-{slug}.md`（新規）、`docs/adr/INDEX.md`、`docs/adr/20260726-d3b-adopt-renovate-with-approval-and-two-layer-cooldown.md`、`.github/workflows/*.yml`（ADR 参照コメントの ID 確定）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - ADR-0000 の規約に従い ID を採番する（`YYYYMMDD-sss`。`ls docs/adr/` で衝突確認）。`TEMPLATE.md` に従って起票する
  - 記載内容: **決定**（22 系に統一し `.nvmrc` を単一ソースにする）／**検討した選択肢**（A: 22 に寄せる・B: 24 に上げる／値の直書き維持／`helpers:disableTypesNodeMajor` 維持）／**根拠**（4 箇所中 3 箇所が既に 22、24.16.0 の Playwright ハング、本体と型定義の連動は `react` ファミリーと同型）／**影響**（22 は 2027-04-30 EOL のため 24 移行が必須、`.nvmrc` を paths に足さないと Node 更新 PR で E2E が起動しない、24.16.0 のハングは 24.18.0 まで進んだ現在では解消済みの可能性があり移行時に再検証すること）
  - `INDEX.md` の該当カテゴリ見出しに 1 行追記する
  - ADR-20260726-d3b §保留事項 2 を解決済みとして更新し、新 ADR を参照する
  - Step 1 で置いた ADR 参照コメントの ID を確定値に反映する
- コミットメッセージ: `docs: Node バージョン方針を ADR として記録する`

### Step 4: CI 緑を確認し、ローカル Node を追随させる
- [ ] **完了**
- 対象ファイル: なし（コミットを伴わない）
- テスト戦略: テスト不要（検証作業）
- 作業内容:
  - PR を作成し、`ci.yml` の `static` / `test`、`playwright.yml` の 4 shard と `merge-reports` がすべて緑であることを確認する
  - 特に `Install Playwright Browsers`（`playwright install --with-deps chromium`）が 22 系でハングせず完了することを確認する
  - 緑を確認した**後**に、ローカルを `nvm install`／`nvm alias default` で `.nvmrc` の版へ追随させる
  - 赤い場合は `.nvmrc` の 1 行を戻せば Step 1 だけをリバートできる（Step 2 / 3 は独立）
- コミットメッセージ: なし

### Step 5: マージ後に Renovate のグループ挙動を確認する
- [ ] **完了**
- 対象ファイル: なし（コミットを伴わない）
- テスト戦略: テスト不要（検証作業）
- 作業内容:
  - マージ後の Renovate 実行で、ジョブログの `branchesInformation` を確認し、`.nvmrc` / `engines.node` / `@types/node` が `node` グループとして 1 ブランチに束ねられていることを検証する（ADR-20260726-d3b §影響「設定変更の検証はジョブログで行える」）
  - Node の更新候補が `non-major` グループに混ざっていないことも併せて確認する
  - 意図と異なる場合は追随の PR を出す
- コミットメッセージ: なし

## 別 issue へ切り出す事項

- `.github/actions/setup` への composite action 括り出し（`checkout → pnpm/action-setup → setup-node → pnpm install → db:generate` の 4 ジョブ分の重複解消）。#655 レビュー指摘 9 の切り出し
  - 実施時は `playwright.yml` の `paths` に `.github/actions/**` を追加すること（本計画の設計判断 7 と同型の穴を塞ぐため）
