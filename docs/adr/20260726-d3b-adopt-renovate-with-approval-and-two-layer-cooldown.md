# ADR-20260726-d3b: 依存関係更新の自動化に Renovate を採用し、承認制・二層 cooldown・順序依存の packageRules で運用する

| 項目 | 値 |
|------|-----|
| ステータス | 採用（一部保留） |
| 起票日 | 2026-07-26 |
| 最終更新日 | 2026-07-28 |

## コンテキスト

ESM は開発開始以来、依存関係を体系的に更新してこなかった。導入検討時点の `pnpm audit` は 129 件の脆弱性を報告する（critical 2 / high 59 / moderate 60 / low 8）。

ただしこの数字は「アドバイザリ × 依存経路」の掛け算で膨らんでいる。ユニークなパッケージは約 25、そのうち**直接依存は 4 件**（`next` / `better-auth` / `vitest` / `uuid`）に過ぎない。残りは推移的依存で、うち約 25 件は `prisma > @prisma/dev > hono` という単一経路（Prisma のローカル開発サーバ専用でデプロイされない）に由来する。実害の規模は数字の印象より小さい。

問題は件数ではなく、**放置し続けた結果として実態を把握する手段が存在しなかった**ことにある。

導入検討の過程で、依存管理以外の不整合も複数露呈した。

- `@types/node` が `^20` で固定されていた。Node 20 は 2026-04-30 に EOL 済みで、実行環境と型が乖離していた
- `@prisma/client` が `devDependencies` にあり、`pnpm install --prod` を実行すると本番から欠落する構成だった
- `engines.node` が存在せず、Node のバージョンをどこにも宣言していなかった
- `eslint-config-next` が `16.0.0` に固定され、`next`（`^16.0.7`）に追随していなかった
- `@vitejs/plugin-react` / `dotenv` が実行時依存として宣言されていた

これらはいずれも「`package.json` の宣言が実態と乖離していても、誰も検証していなかった」という同一の構造から生じている。

注意すべきは、判断基準そのものは既に文書化されていたことである。`learning/dependencies-vs-devdependencies.md` は dependencies / devDependencies の判断基準と確認方法をまとめているが、それでも `@prisma/client` は devDependencies に置かれていた。**知識が欠けていたのではなく、宣言を実態と突き合わせる契機が存在しなかった**。依存更新の自動化は、副次的にこの突き合わせを定期実行する機械を導入することでもある。

## 検討した選択肢

### A. Renovate（Mend ホスト版）を導入する（採用）

GitHub App として導入し、`renovate.json` で挙動を制御する。更新候補を Dependency Dashboard（GitHub Issue）に一覧し、承認したものだけを PR 化できる。`packageRules` により条件付きの設定上書きが表現できる。

### B. Dependabot version updates を使う（不採用）

GitHub 標準で追加コストがない。しかし以下が本件の要件に合わない。

- **更新候補を一覧して選択的に PR 化する機構がない**。長期間放置した状態では、PR が一斉に立つか、開いた PR 数の上限で詰まるかのどちらかになる
- 条件付き設定の表現力が低く、「major は原則グループ解除、ただしバージョン連動が必須のファミリーはグループを維持」（D5）のような設計ができない
- 学習目的として、設定の合成モデルが明示的な Renovate のほうが得るものが大きい

Renovate の運用負荷が見合わないと判断した場合には再検討の余地がある。

### C. 定期的な手動更新（不採用）

`pnpm outdated` を定期実行して手で上げる。ツール導入コストはゼロだが、着手時期が決まらず先送りされる。**現状がその結果である**。

### D. 何もしない（不採用）

社内アプリで外部公開しないとはいえ、本番デプロイを想定している以上、既知の脆弱性を放置する選択は成立しない。

### Mend ホスト版 vs セルフホスト（GitHub Actions）

セルフホストなら実行タイミングと環境を完全に制御できるが、Actions の実行時間とワークフローの保守を負う。単独開発・パブリックリポジトリの規模では Mend ホスト版（Community プラン）で足りる。将来 private 化する場合に再評価する。

## 決定

**A を採用する。** Mend ホスト版 Renovate を導入し、`renovate.json` を以下の方針で構成する。

| ID | 決定 |
|----|------|
| D1 | 承認制（`dependencyDashboardApproval`）を採用し、automerge は採用しない |
| D2 | `rangeStrategy` は `bump` |
| D3 | cooldown を Renovate と pnpm の二層で設定する |
| D4 | `lockFileMaintenance` を月次で有効化する |
| D5 | `packageRules` を「ベース → 型 → major 分離 → ファミリー復活」の順序で構成する |
| D6 | semantic commit type を `chore` に統一する |
| D7 | GitHub Actions・Docker タグ・Node バージョンも管理対象に含める |

設定の全文は `renovate.json` を正とし、本 ADR では再掲しない。各ルールの個別の意図は同ファイルの `description` フィールドに記載する。本 ADR が記述するのは**なぜその値を選んだか**である。

## 根拠

### D1. 承認制を採用し automerge は採用しない

`dependencyDashboardApproval: true` により、Dependency Dashboard のチェックボックスで承認するまでブランチも PR も作られない。

- 長期間放置した状態で無条件に PR を作らせると、レビュー不能な量が一度に立つ
- automerge は **CI が唯一の防壁**になる。ESM の CI で DB 統合テスト（`PrismaEstimateRepository` など）が実際に実行されているかが未確認の段階では、この前提が成立しない
- 学習目的として、どのパッケージがどう更新されるかを個別に観察する価値がある

代替案として「patch 限定の automerge」を検討したが、CI の被覆範囲が確認でき、数サイクル分の手動マージで挙動を把握した後に再検討する。移行条件は §保留事項 3 に記す。

副作用として、**承認しない限り更新は完全に停止する**。放置は「更新されない」ではなく「更新候補が溜まり続ける」状態を意味し、Dashboard を定期的に確認する運用が前提になる。

### D2. `rangeStrategy` は `bump`

導入時点で `tailwindcss` / `@tailwindcss/postcss` / `eslint` / `typescript` が `^4` `^9` `^5` というメジャーのみのレンジで宣言されていた。この記述からは実際に何が入っているか読み取れず、`pnpm-lock.yaml` を見なければ分からない。

`bump` は in-range 更新でも `package.json` の下限を実バージョンまで引き上げる（`^4` → `^4.3.3`）。デフォルトの `auto` は npm に対して `update-lockfile` を選ぶため、caret レンジの minor/patch 更新ではロックファイルしか変わらず、この乖離が解消されない。

- ESM はライブラリではなくアプリであり、consumer に対してレンジを広く開けておく動機がない
- 宣言が実態の下限を正しく記述する状態を維持したい（§コンテキストで述べた問題意識と同一）
- `auto`（= `update-lockfile`）は D4 の `lockFileMaintenance` と PR が重複する既知の問題がある。`bump` は経路が分かれるためこれを回避する

代償として、minor/patch 更新のたびに `package.json` に差分が出る。複数 PR が同時に開いているとリベース衝突が増えるため、`prConcurrentLimit: 3` とグルーピングで抑制する。

### D3. cooldown を二層で設定する

`security:minimumReleaseAgeNpm`（Renovate 側・3 日）と `pnpm-workspace.yaml` の `minimumReleaseAge: 4320`（pnpm 側・3 日）を併用する。

サプライチェーン攻撃への防御であり、悪意あるバージョンが公開されてから検出・削除されるまでのラグを待機時間で吸収する。「速いリリースを遅らせる」ことが目的ではない。

二層にする理由は、**Renovate が推移的依存を管理しないため**である。Renovate はマニフェストに宣言された依存しか見ず、推移的依存の解決はパッケージマネージャに委ねている。したがって Renovate 側の設定だけでは推移的依存に cooldown が存在しない状態になる。

| 層 | 対象 |
|----|------|
| Renovate | 直接依存の更新提案を 3 日遅らせる |
| pnpm | install 時の解決全体。推移的依存にも適用される |

さらに `lockFileMaintenance` は原理的に `minimumReleaseAge` を検証できない（更新処理をパッケージマネージャに委譲するため）。`security:minimumReleaseAgeNpm` プリセットはこの穴を明示的に扱い、`lockFileMaintenance` に対して `minimumReleaseAge: null` を設定したうえで警告文を PR 本文へ自動付与する。**穴を塞ぐのではなく明示する**設計であり、実際に塞ぐのは pnpm 側の設定である。

pnpm 10 系は `minimumReleaseAge` のデフォルトが 0（無効）のため明示設定が必須。明示するとストリクトモードが自動的に有効になる。

### D4. `lockFileMaintenance` を月次で有効化する

ロックファイルを再生成して推移的依存を更新する唯一の手段である。無効にすると、初回 `pnpm install` 時に解決された推移的依存が更新されないまま残り続ける。ESM はロックファイルが本番インストールの真実になるため、**ロックファイルの陳腐化は本番コードの陳腐化を意味する**。

週次ではなく月次を選ぶ理由は 2 つある。

- 差分が `pnpm-lock.yaml` のみで changelog もなく、**レビューが原理的に不可能**である。人間の判断が入らない PR が高頻度で来ると「中身を見ずにマージする」習慣がつく。これは automerge を明示的に有効化するより悪い（無意識の自動化）
- 単独開発の規模では、推移的依存の陳腐化は月単位で十分追随できる

この PR のリスク管理は CI の通過のみに依存する。裏を返せば、CI が固まった段階では **automerge の最有力候補**になる。手でマージしても中身を見ていないなら、自動化しても安全性は変わらないためである。

### D5. `packageRules` の順序設計

`packageRules` は first-match ではなく、**マッチした全ルールがオプション単位で順に上書きされる**（後勝ち）。この性質を利用した 4 段構成を採る。

1. **ベース** — 0.x を除く minor/patch を `non-major` に集約
2. **型分離** — `@types/**` を `types` に分離
3. **major 分離** — `groupName: null` でグループを解除し、承認とラベルを付与
4. **ファミリー復活** — バージョン連動が必須の群（prisma / next / react / tailwind / vitest / playwright / commitlint）でグループを再構成

> **2026-07-28 追記（#666）**
> 1 段目（ベース `non-major`）は ADR-20260728-9kq で廃止した。ベース層が `group:monorepos`（`config:recommended` に含まれる）の付与するグループ名を後勝ちで上書きし、無関係なパッケージが 1 PR に混載されていたため。minor/patch のグルーピングはモノレポ単位に移行し、2〜4 段目の構造は維持している。0.x 除外（`matchCurrentVersion: "!/^0/"`）もベース層とともに失効した（0.x は構造的に個別 PR になる）。4 段目には conform / radix を追加した（追加基準「major が連動リリースされるか」は同 ADR を参照）。

3 が major のグルーピングを一旦解除し、4 が該当ファミリーのみ再グループ化する。3 が設定した `dependencyDashboardApproval` と `major` ラベルは、4 が `groupName` しか触らないため維持される。

**3 と 4 の順序を入れ替えると設計が壊れる。** React 19 → 20 のような major で `react` / `react-dom` / `@types/react` が分解され、片方だけマージできてしまう。この順序依存は `renovate.json` の `description` にも記載している。

`matchCurrentVersion: "!/^0/"` で 0.x を除外するのは、semver 仕様上 `0.y.z` の minor bump が破壊的変更を許容するためである。`^0.1.0` は `0.1.x` しか許可せず、`0.1.0 → 0.2.0` は分類上 minor だが実質 major である。一括グルーピングすると CI 失敗時の原因特定コストが上がる。

初回ジョブのログ（`branchesInformation`）で設計どおりの動作を確認した。`@types/react` が `types` ではなく `react` グループに入り、major は個別ブランチに分かれ、`major-commitlint` はファミリーを維持している。

### D6. semantic commit type を `chore` に統一する

`config:recommended` は `:semanticPrefixFixDepsChoreOthers` を含み、これは「dependencies には `fix`、それ以外には `chore`」を **`packageRules` として** 設定する。`packageRules` はトップレベル設定より優先されるため、`"semanticCommitType": "chore"` をトップレベルに書いても本番依存には効かない。

`:semanticCommitTypeAll(chore)` を `extends` の後方に置くことで上書きする（`matchFileNames: ["**/*"]` の `packageRule` として展開され、後勝ちで優先される）。

ESM は Conventional Commits + commitlint を採用しており、依存更新を `chore(deps):` に統一したほうが履歴の粒度が揃う。prod / dev で prefix が分かれる利点は、単独開発では小さい。

なお Renovate が生成するコミットメッセージは英語である。ESM は日本語のコミットメッセージを規約とするが、依存名とバージョンが主要な情報であるため日本語化の実利は薄い。**Renovate の自動コミットは英語で例外**とする。

### D7. 管理対象の範囲

npm 依存に加え、以下も Renovate の管理下に入る。

- `.github/workflows/*.yml` の GitHub Actions（`actions/checkout` など）
- 同ファイルの Docker タグ（CI の PostgreSQL サービスコンテナ）
- `package.json` の `engines.node` と `packageManager`（pnpm バージョン）

> **現在の管理対象（2026-07-28 追記 / #664, #667）**
> `engines.node` は削除されたため管理対象外（→ ADR-20260728-44b）。Node 本体は `.nvmrc`（`nvm` manager）から検出する。ワークフローの `node-version` 直書きも #641 で消えているため、上記 1 点目の GitHub Actions に Node は含まれない。`packageManager` は現在も管理対象である。

初回スキャンで npm 53 件 / github-actions 6 件が検出された。CI の構成要素も依存であり、同じ規律で更新されるべきという判断による。

副作用として、`non-major` グループに GitHub Actions の更新が混ざる。分離するかは実 PR を見て判断する（§保留事項 4）。

> **2026-07-28 追記（#666）**
> ベース `non-major` の廃止（→ ADR-20260728-9kq）により、GitHub Actions と npm 依存が同一 PR に混載される経路は消滅した（§保留事項 4 参照）。

## 影響

- **Dashboard を見ない期間は更新が完全に停止する。** 承認制の必然的な帰結であり、定期的に確認する運用が前提になる
- **`package.json` に minor/patch 更新のたびに差分が出る。** `bump` の帰結
- **`lockFileMaintenance` の PR はレビュー不能で、CI が唯一の防壁になる。** CI の被覆範囲がそのまま安全性の上限になる
- **グループごとに固有の確認手順が要る。** prisma → `pnpm db:generate`、playwright → ブラウザバイナリの再取得、next → E2E まで実行
- **設定変更の検証はジョブログで行える。** `branchesInformation` に、承認前の状態で「どのブランチにどのパッケージがまとまるか」が出る。実 PR を待たずに `packageRules` の妥当性を確認できる

導入に先立ち、以下を別 PR で修正した。

- `@types/node` を `^20` → `^22`、`engines.node: "^22"` を追加
- `@prisma/client` を dependencies へ移動
- `@vitejs/plugin-react` / `dotenv` を devDependencies へ移動
- `eslint-config-next` を `16.0.0` → `^16.0.7`

## 保留事項

### 1. Dependabot alerts の有効化が未確認

初回ジョブの `updateSummary` が `vulnerabilityAlert: 0` を返した。`pnpm audit` が 129 件を報告する状態でこの値になるのは、GitHub の Dependabot alerts が無効か、Renovate が読めていないことを示唆する。

有効化すると、脆弱性由来の更新は承認・並列上限・スケジュールを無視して即座に PR 化される（automerge はされない）。対象となる直接依存は `next` / `better-auth` / `vitest` / `uuid` の 4 件。

### 2. `engines.node` と CI の Node バージョンが不一致（解決済み → ADR-20260728-44b）

**#641 で解決した。** Node は 22 系に統一し、値は `.nvmrc` だけに書く（CI の 4 ジョブは `node-version-file` で参照する）。あわせて `helpers:disableTypesNodeMajor` を除去し、`node` と `@types/node` を同一グループとして更新する。詳細と根拠は ADR-20260728-44b を参照。

本 ADR に記した「`@types/node` は `^22` に固定されている」という状態は、上記の除去により解消している。型は本体（`.nvmrc` / `engines.node`）とグループで連動するようになった。

> **2026-07-28 追記（#664, #667）**
> その後 `engines.node` は削除され、Node 本体を宣言する箇所は `.nvmrc` だけになった。`node` グループは `.nvmrc` + `@types/node` の 2 者で構成される。撤回の根拠は ADR-20260728-44b §「なぜ `engines.node` を持たないか」を参照。

### 3. automerge への移行条件

以下が満たされた時点で再検討する。

- CI で DB 統合テストが実際に実行されていることの確認
- 数サイクル分の PR を手動でマージし、CI が破壊的変更を実際に検出した実績
- 移行対象は `lockFileMaintenance` と `@types/**` から始める（前者はレビュー不能、後者は実行時リスクゼロで `tsc` が確実に検出する）

### 4. `non-major` グループから GitHub Actions を分離するか

`matchManagers: ["npm"]` の追加で分離できる。CI 設定の変更とアプリ依存の更新が 1 PR に同居する状態を許容するかを、実 PR の混在具合を見てから判断する。

> **解決済み（2026-07-28 / #666 → ADR-20260728-9kq）**
> `non-major` の廃止により構造的に解消した。吸い込む土台ルールが消え、npm 依存と Actions が同一グループに入る経路がなくなったため、`matchManagers` による明示分離は行わない。

### 5. `group:monorepos` との重複

`config:recommended` が含む `group:monorepos` が、手書きしていないグループ（`lucide-monorepo` など）を生成する。重複するルールは削減できる可能性があるが、初回は残して観察する。

> **解決済み（2026-07-28 / #666 → ADR-20260728-9kq）**
> 削減しない。重複に見える手書きルールは全件が「位置の情報」（major 分離ルールの後置による major 連動の復活）または「境界の情報」（next↔eslint-config-next 等、モノレポ横断の連動）を担っており、プリセットには構造的に表現できない。

### 6. commitlint の `header-max-length: 100`

グループ名が長いと PR タイトルが 100 文字を超え、CI の commitlint が落ちうる。Renovate は GitHub API 経由でコミットするため husky の `commit-msg` フックは走らないが、CI 上の commitlint は走る。`groupName` を短く保っているが、実 PR での検証が必要。

## 関連

- ADR-0000（ADR の管理運用方針。ID 採番・配置・INDEX 運用）
- `renovate.json`（各ルールの `description` に個別の意図を記載。D5 の順序依存はここにも明記）
- `pnpm-workspace.yaml`（`minimumReleaseAge` = 推移的依存側の cooldown）
- `learning/dependencies-vs-devdependencies.md`（判断基準は文書化済みだった。§コンテキストの不整合はこの基準に反していた）
- `learning/postinstall-vs-transitive-dependencies.md`（推移的依存の概念。D3 の二層 cooldown が必要になる前提）
- PR #637（Renovate オンボーディング）
- PR #638（依存配置・Node バージョンの先行修正）
- Renovate 公式ドキュメント: [packageRules](https://docs.renovatebot.com/configuration-options/#packagerules) / [rangeStrategy](https://docs.renovatebot.com/configuration-options/#rangestrategy) / [Minimum Release Age](https://docs.renovatebot.com/key-concepts/minimum-release-age/)
