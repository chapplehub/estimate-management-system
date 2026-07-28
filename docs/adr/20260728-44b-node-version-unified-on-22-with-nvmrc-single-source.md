# ADR-20260728-44b: Node のバージョンは 22 系に統一し、`.nvmrc` を唯一の宣言箇所とする

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-28 |
| 最終更新日 | 2026-07-28 |

## コンテキスト

Node のメジャーバージョンが、宣言と実行で割れていた。

| 箇所 | 値 |
|---|---|
| `package.json` の `engines.node` | `^22` |
| `package.json` の `@types/node` | `^22` |
| ローカル（nvm） | 22.14.0 |
| `.github/workflows/ci.yml`（`static` / `test`） | 22.14.0 |
| `.github/workflows/playwright.yml`（`test` / `merge-reports`） | 24.15.0 |

24.15.0 は自然に選ばれた値ではない。当初は `lts/*` で浮動させていたが、Node 24.16.0 で Playwright 1.58 の "extracting archive" がハングし、既知良好版として先週まで `lts/*` が解決していた 24.15.0 に固定したものである（#284 の調査ログ）。つまり **E2E だけが、他のどことも一致しないメジャーで、上げられないピンとして止まっていた**。

問題は「24 という値」そのものではなく、同じ 1 つの事実（このプロジェクトが動く Node の版）が 5 箇所に独立して書かれ、片方だけが動いても誰も気づかない構造にある。実際 #655 で `ci.yml` を追加した際、既存の 24.15.0 に揃えず 22.14.0 を新たに直書きしたため、CI 内部でも 22 と 24 が同居する状態になった。人間の同期に依存する限り、24 へ移行する時も同じ乖離が再発する。

Renovate 側にも対応する状態があった。`renovate.json` は `helpers:disableTypesNodeMajor` を含み、`@types/node` の major 更新を抑止していた。これは「型は 22 系に留める」を設定として先に確定させたものだが（ADR-20260726-d3b §保留事項 2）、この不一致自体は解消しない。

## 検討した選択肢

### A. CI を 22 系へ下げる（採用）

`playwright.yml` の 2 ジョブを 22 系に変更する。宣言・型・ローカル・`ci.yml` は変更不要。

### B. `engines.node` / `@types/node` を 24 へ上げる（不採用）

LTS の最新メジャーに合わせる案。24 系は本 ADR 起票時点で 24.18.0（LTS Krypton）。

### C. 値を 22 に揃えるだけで、各ワークフローへの直書きは維持する（不採用）

不一致という症状だけを消す最小変更。

### D. `.nvmrc` を新設し、4 ジョブは `node-version-file` で参照する（採用）

バージョンをファイル 1 つに集約し、`setup-node` とローカルの `nvm use` が同じファイルを読む。

### E. `.node-version` を使う（不採用）

`setup-node` が読めるもう一方のファイル名。

### F. `helpers:disableTypesNodeMajor` を維持し、Node のメジャー移行は Renovate の外で扱う（不採用）

### G. `helpers:disableTypesNodeMajor` を外し、`node` と `@types/node` を 1 グループにする（採用）

## 決定

**Node は 22 系（22.23.1）に統一し、その値は `.nvmrc` だけに書く。** CI の 4 ジョブは `node-version-file: .nvmrc` で参照し、Renovate は `node` と `@types/node` を同一グループとして更新する。

## 根拠

### なぜ 22 か（A vs B）

宣言・型・ローカル・`ci.yml` の 4 箇所中 3 箇所が既に 22 であり、変更は `playwright.yml` の 2 箇所に収まる。24 固有の機能に依存しているコードはない。

決め手は、**B を採っても異常が残る**ことにある。24.16.0 の Playwright ハングが未解決である以上、CI は 24.15.0 のピンから動かせない。すなわち B は「宣言は 24、実行は上げられない 24.15.0」という、浮動できないピンを抱えたまま整合を主張する状態になる。A は全箇所が 22 系最新に揃い、パッチ更新が普通に流れる。

### なぜ値を集約するか（C vs D）

C は今回の症状を消すが、原因である「1 つの事実を 5 箇所に書く」構造をそのまま残す。#655 が示したとおり、この構造では新しいジョブが追加されるたびに直書きが増え、24 へ移行する時点で同じ作業と同じ見落としが再発する。D では `.nvmrc` を書き換えれば CI 4 ジョブとローカルが同時に動く。

### なぜ `.nvmrc` か（D vs E）

`setup-node` の `node-version-file` は `.nvmrc` と `.node-version` の両方を読む。差が出るのはローカル側で、**nvm が読むのは `.nvmrc` のみ**である（`.node-version` は fnm / asdf / nodenv 系の慣習）。このプロジェクトのローカル環境は nvm 運用のため、`.nvmrc` にすると CI とローカルが物理的に同一のファイルを参照する。`.node-version` を選ぶと、ローカルは結局このファイルを読まず、単一ソース化の半分が失われる。

### なぜメジャー表記（`22`）ではなく厳密版（`22.23.1`）か

`.nvmrc` に `22` と書くと、CI は実行のたびに 22 系の最新を引き当てる。これは `playwright.yml` が `lts/*` を捨てて 24.15.0 に固定した判断（浮動による非決定性の排除）と正面から衝突する。加えて Renovate の `node` versioning は range 非対応のため、`^22` のような表記自体が書けず、メジャー表記ではパッチ更新の PR も出なくなる。

### なぜ `engines.node: ^22` を残すか

`.nvmrc`（実際に走らせる 1 つの版）と `engines.node`（動作を保証するメジャー範囲）は粒度が違い、重複ではない。前者は再現性、後者は互換性の宣言を担う。

`.npmrc` に `engine-strict=true` を足してローカルでも強制する案は採らなかった。効くのは `pnpm install` の瞬間だけで、`test` / `build` / `e2e` は誤った Node でも走る。取り違えの防止はシェル側の nvm 自動切り替えで解くほうが全コマンドに効く。

### なぜ `helpers:disableTypesNodeMajor` を外すか（F vs G）

同プリセットの目的は「型定義が本体に先行して上がる」のを防ぐことである。`node` と `@types/node` を同一グループにすれば、先行は構造的に起きない。目的が別の手段で満たされた後もプリセットを残すと、**グループの片翼だけを封じる害**が残る。

F を採った場合、24 へ移行する際に `.nvmrc` / `engines.node` の major PR は出るが `@types/node` だけプリセットが黙らせるため、「実行は 24・型は 22」という #641 の鏡像が生まれる。しかも Dashboard には何も現れないため、気づく材料がない。

本体と型定義を連動させるグループは `react` / `react-dom` / `@types/react` / `@types/react-dom` に前例があり、`renovate.json` が既に持つ語彙に乗る。`packageRules` の末尾に置くのは、`major` ルール（`groupName: null`）より後ろでないとメジャー更新でグループが解除されるためで、既存の順序規約（`renovate.json` の major ルールのコメント）に従っている。

### 副次効果: Node の更新経路が 1 本になる

ワークフローから値が消えることで、Renovate の `github-actions` manager が `with: node-version` から Node を検出する経路が消滅する。Node の更新は `nvm` manager（`.nvmrc`）と `npm` manager（`engines.node` / `@types/node`）だけになり、3 者が 1 グループにまとまる。

## 影響

- **Node 22 は 2027-04-30 に EOL を迎える。** 24（以降）への移行はいずれ必須であり、本 ADR は移行を不要にするものではなく、移行を `.nvmrc` の 1 行 + `engines.node` + `@types/node` の 1 グループに縮約するものである。
- **24.16.0 の Playwright ハングは、既に解消している可能性が高い。** 本 ADR 起票時点で 24 系は 24.18.0 まで進んでいる。移行時にこの ADR を読んだ人が「24 は地雷」と誤解しないこと。当時の観測は 24.16.0 + Playwright 1.58 の組み合わせに対するものであり、移行時は再検証すること。
- **`playwright.yml` の `paths` に `.nvmrc` を含める必要がある。** 単一ソース化により Node 更新 PR の差分は `.nvmrc` だけになる。挙げ忘れると、E2E でこそ検証すべき変更（Playwright のブラウザ展開）で E2E が起動しない。同型の穴は、`setup-node` を composite action（`.github/actions/**`）へ括り出す際にも空く。
- **ローカル環境は `.nvmrc` への追随が必要になる。** `nvm use` は `.nvmrc` を読むが、インストールされていない版は自動では入らない（`nvm install` が要る）。
- **Node のメジャー更新 PR は 3 ファイル（`.nvmrc` / `package.json` の `engines` と `@types/node`）を同時に変更する。** レビュー時は 3 者が揃っていることを確認する。片方だけの PR が出た場合はグループ設定が壊れている。
