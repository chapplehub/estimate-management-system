# Issue #697: rangeStrategy を bump から pin へ移行する（d3b D2 の改訂、config:js-app 採用） — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`renovate.json` の `rangeStrategy` を `bump` から `pin` へ移行する。ADR-20260726-d3b の D2 を改訂し、`extends` の `config:recommended` を `config:js-app` に置き換える。判断の経緯はグリルセッション（2026-07-30）で決着済み。

- Renovate 本体ソースの実測により、`config:js-app` = `config:recommended` + `:pinAllExceptPeerDependencies` の完全上位互換であることを確認済み（`config.preset.ts` / `default.preset.ts`）
- `:pinAllExceptPeerDependencies` は packageRules ベース（`matchPackageNames: ['*']` → pin、`engines` / `peerDependencies` → auto）。**トップレベル `rangeStrategy` より常に優先される**（d3b D6 の `semanticCommitType` と同型）
- pin の最大の実益は宣言の正確さではなく、**直接依存が lockFileMaintenance のレビュー不能 PR 経由で cooldown を素通りして動く経路の遮断**（D4 のリスク管理強化）
- **適用タイミング条件**: config PR のマージは Dependency Dashboard 上にオープン中の Renovate PR がないタイミングで行う（pin 化で既存 PR ブランチが全面書き換えになるため。#696 と同じ運用注意）

### 初回 Pin PR の取り込み手順（マージ後の運用）

1. config PR マージ後、次回ジョブで Dashboard の Pending Approval に「Pin Dependencies」が現れる（updateType `pin` の既定値 `groupName: 'Pin Dependencies'` により 1 本に束なる。`dependencyDashboardApproval` が効くため承認まで何も起きない）
2. 承認して Pin PR を作らせ、**他のどの依存更新 PR よりも先に**マージする
3. 検証: pin はロックファイルに既に入っているバージョンへの固定であり実体は動かない。`pnpm-lock.yaml` の diff が specifier 行のみ（resolved バージョン不変）であること + CI 通過を確認する
4. 以降の依存 PR は `rebaseWhen: behind-base-branch` により自動 rebase される（手当て不要）

## 設計判断

いずれもグリルセッション（2026-07-30）で決着済み。

### extends の構成
- A. `config:recommended` を `config:js-app` に置き換える（先頭配置のまま）
- B. `config:recommended` を残し `:pinAllExceptPeerDependencies` を追加する
- 採用: A（実測で両案の実効設定は完全同一。A は「ESM はアプリである」という意図の宣言であり Issue の動機そのものを表現する。0b6 が二重 extend を排除した前例とも一貫。後続 3 プリセットとはオプション単位で交差せず新たな順序依存は生まれない）

### トップレベル `rangeStrategy: "bump"` の始末
- A. 単純削除（トップレベルには何も書かない）+ `description` で機構を記録
- B. `"pin"` に書き換えて明示する
- 採用: A（pin はプリセットの packageRules 由来のためトップレベルに書いても効かない dead config になる。`'*'` が全パッケージにマッチするためフォールバック先が必要な依存も存在しない。0b6 のプリセット委譲方針と一貫）

### 初回の一斉 Pin PR の取り込み方
- A. Renovate に Pin PR を生成させ、承認制をタイミング制御装置として使う
- B. config PR に手動 pin（package.json の exact 化）を同梱してアトミックに済ませる
- 採用: A（直接依存 50 件超の手編集はミスの余地があり、Renovate の設計済み機構と Dashboard での動作観察の機会を捨てることになる。「config は pin だが宣言はまだレンジ」の中間状態は承認まで副作用ゼロで実質的な窓にならない）

### ADR の改訂方法
- A. 新規 ADR を起票し、d3b の D2 セクションに改訂注記を追記する
- B. d3b を現地改訂する
- 採用: A（0b6 で確立した「新 ADR + 旧 ADR への追い注記」パターンの踏襲。改訂対象は D1〜D7 のうち D2 のみで全体差替は過剰。bump を選んだ推論の連鎖は pin へ進む論理の出発点として歴史的価値がある。ADR-0000 は現地改訂を ADR-0000 自身にのみ許す）

### 実測により事実決着した論点（決定不要・新 ADR に記録）
- **D3/D4 との相互作用**: pin ではレンジが消えるため in-range 更新（`update-lockfile` 経路）が概念ごと消滅し、lockFileMaintenance との PR 重複は構造的に起きない。lockFileMaintenance が動かせるのは推移的依存のみになり、レビュー不能 PR の守備範囲が狭まって D4 は強化される
- **engines / peerDependencies**: `:pinAllExceptPeerDependencies` の 2 本目のルールが `auto` に逃がす（pin してはいけない depType の織り込み済み設計）。ESM には `engines`（ADR-44b で削除済み）も `peerDependencies`（grep で不在確認済み）も存在せず実影響ゼロ

## ステップ

### Step 1: renovate.json を pin 移行版に改訂する
- [ ] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル。検証はマージ後に Dependency Dashboard と初回 Pin PR で行う——概要の取り込み手順参照）
- 作業内容:
  - `extends` の `config:recommended` を `config:js-app` に置き換える（先頭のまま）。他の 3 エントリは変更しない
  - トップレベル `"rangeStrategy": "bump"` を削除する
  - `description` に rangeStrategy のエントリを 1 件追加する（pin は `config:js-app` 内蔵の `:pinAllExceptPeerDependencies` が packageRules として設定する・トップレベルに書いても packageRules に負けるため書かない・engines / peer は同プリセットが auto に逃がす）
  - 既存 `description` の「group:monorepos（config:recommended 内蔵）」等の文言を `config:js-app` 前提に微修正する（js-app が recommended を包含するため内容は真のまま）
- コミットメッセージ: `ci: rangeStrategy を pin へ移行し config:js-app を採用する`

### Step 2: ADR を作成・改訂し INDEX を更新する
- [ ] **完了**
- 対象ファイル: `docs/adr/20260730-{sss}-migrate-range-strategy-to-pin-with-js-app.md`（新規。sss は ADR-0000 の採番規約に従い base36 3 桁で採番）、`docs/adr/20260726-d3b-adopt-renovate-with-approval-and-two-layer-cooldown.md`、`docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新規 ADR を作成する。記録する論点: pin 移行の根拠（読み手のいないレンジ宣言の廃止 / lockFileMaintenance 経路の遮断による D4 強化 / 再現性）、extends の js-app 置き換え（案 B 不採用理由）、トップレベル rangeStrategy 削除（dead config 回避）、初回 Pin PR の取り込み手順、事実決着 2 点（D3/D4 相互作用・engines/peer）
  - d3b の D2 セクションに `> **改訂（2026-07-30 / #697 → 新 ADR）**` 形式の追い注記を加える（決定本文は書き換えない。D5 の注記チェーン形式に合わせる）
  - `docs/adr/INDEX.md` に新規 ADR を追加する
- コミットメッセージ: `docs: rangeStrategy の pin 移行と config:js-app 採用を ADR に記録する`
