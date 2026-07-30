# ADR-20260730-aan: rangeStrategy を bump から pin へ移行し、config:js-app を採用する

| 項目 | 値 |
|------|-----|
| ステータス | 採用 |
| 起票日 | 2026-07-30 |
| 最終更新日 | 2026-07-30 |

## コンテキスト

ADR-20260726-d3b の D2 は `rangeStrategy: "bump"` を選んだ。動機は「`^4` `^9` のようなメジャーのみのレンジ宣言からは実際に何が入っているか読み取れない」という乖離の解消であり、`bump` は in-range 更新のたびに `package.json` の下限を実バージョンへ引き上げることでこれに応えていた。

しかしこの選択は、問題を「レンジの下限が古い」と定式化したうえでの対処である。ESM はライブラリではなくアプリであり、`package.json` のレンジを読む consumer は存在しない。**下限を正確に保つべきレンジ宣言そのものに読み手がいない**のなら、下限を追随させるのではなくレンジ自体を廃止する（= `pin`）方が問題の定式化として正しい。d3b D2 自身が「ESM はアプリであり consumer に対してレンジを広く開けておく動機がない」と書いており、その前提から `pin` は一歩先の結論として自然に導かれる。

ADR-20260730-0b6 は `rangeStrategy` を明示的にスコープ外とし、pin への移行を #697 に委ねた。本 ADR がそれに応える。

判断に先立ち、Renovate 本体のソース（`lib/config/presets/internal/config.preset.ts` / `default.preset.ts`）を実測した。

1. **`config:js-app` = `config:recommended` + `:pinAllExceptPeerDependencies`** の完全上位互換である（`config:js-app` の定義は `extends: ['config:recommended', ':pinAllExceptPeerDependencies']` そのもの）
2. **`:pinAllExceptPeerDependencies` は packageRules ベース**である。`matchPackageNames: ['*']` → `rangeStrategy: 'pin'` と、`matchDepTypes: ['engines', 'peerDependencies']` → `rangeStrategy: 'auto'` の 2 本で構成される
3. したがって pin は**トップレベル `rangeStrategy` より常に優先される**。packageRules がトップレベル設定に勝つのは d3b D6 の `semanticCommitType` で既に踏んだ性質と同型である

## 検討した選択肢

### A. `config:recommended` を `config:js-app` に置き換える（採用）

`extends` の先頭を差し替えるだけ。後続 3 エントリ（`security:minimumReleaseAgeNpm` / `:semanticCommitTypeAll(chore)` / `:maintainLockFilesMonthly`）は変更しない。

### B. `config:recommended` を残し `:pinAllExceptPeerDependencies` を追加する（不採用）

実測のとおり両案の実効設定は完全に同一であり、機能差はない。それでも A を採るのは次の理由による。

- `config:js-app` という名前自体が「このリポジトリはアプリである」という意図の宣言であり、Issue の動機（consumer のいないレンジをやめる）をそのまま表現する。B は同じ設定を機構の羅列として書くだけで、なぜそうするのかが設定から読み取れない
- 0b6 は `group:monorepos` の明記を「`config:recommended` に内蔵されているのに書いている二重 extend」として削除した。B は内蔵プリセットを外から足し直す形になり、この方針と逆行する
- `config:js-app` は後続 3 プリセットとオプション単位で交差しない（`rangeStrategy` を触るのは js-app 側だけ）ため、新たな順序依存は生まれない

### トップレベル `rangeStrategy: "bump"` の始末

- **A. 単純削除し、機構を `description` に記録する（採用）**
- B. `"pin"` に書き換えて明示する（不採用）

B は一見「設定を読めば pin だと分かる」利点があるように見えるが、実際には**書いても効かない dead config** になる。pin はプリセットの packageRules 由来であり、トップレベル設定は packageRules に負けるためである。仮にプリセット側が pin をやめても、トップレベルの `"pin"` は勝てないので保険にもならない。さらに `matchPackageNames: ['*']` が全パッケージにマッチするため、「プリセットのルールにマッチせずトップレベルへフォールバックする依存」も存在しない。効かない値を書いて読み手を誤解させるより、削除して機構を `description` に記録する方が正確である（0b6 のプリセット委譲方針とも一貫する）。

### 初回の一斉 Pin PR の取り込み方

- **A. Renovate に Pin PR を生成させ、`dependencyDashboardApproval` をタイミング制御装置として使う（採用）**
- B. config PR に手動 pin（`package.json` の exact 化）を同梱し、アトミックに済ませる（不採用）

B は「config は pin だが宣言はまだレンジ」という中間状態を作らない点が魅力だが、直接依存 50 件超を手編集することになりミスの余地が大きく、Renovate が用意している機構と Dashboard での動作観察の機会を捨てることになる。そして中間状態のリスク自体が実は存在しない——全更新が承認制であるため、承認するまで副作用はゼロであり、実質的な窓が開かない。

## 決定

**A を採用する。** `extends` の `config:recommended` を `config:js-app` に置き換え、トップレベルの `"rangeStrategy": "bump"` を削除する。設定の全文は `renovate.json` を正とする。

これにより ADR-20260726-d3b の **D2 を改訂する**（同 ADR の D2 セクションに追い注記済み）。D1・D3〜D7 は変更しない。

### 初回 Pin PR の取り込み手順

1. config PR マージ後、次回ジョブで Dashboard の Pending Approval に「Pin Dependencies」が現れる（updateType `pin` の既定 `groupName: 'Pin Dependencies'` により 1 本に束なる。`dependencyDashboardApproval` が効くため承認まで何も起きない）
2. 承認して Pin PR を作らせ、**他のどの依存更新 PR よりも先に**マージする
3. 検証: pin はロックファイルに既に入っているバージョンへの固定であり、実体は動かない。`pnpm-lock.yaml` の diff が specifier 行のみ（resolved バージョン不変）であること + CI 通過を確認する
4. 以降の依存 PR は `rebaseWhen: behind-base-branch` により自動 rebase される（手当て不要）

**適用タイミング条件**: config PR のマージは Dependency Dashboard 上にオープン中の Renovate PR がないタイミングで行う。pin 化で既存 PR ブランチが全面書き換えになるためで、#696（0b6）でグループ名変更に対して課したのと同じ運用注意である。

## 根拠

### 読み手のいないレンジ宣言を維持するより、廃止する

d3b D2 の問題意識は「宣言が実態を記述していない」だった。`bump` はこれを「下限を実バージョンに追随させる」ことで解いたが、追随させた下限を読む主体がいない。ESM は npm に公開されるライブラリではなく、`package.json` のレンジが意味を持つのはインストール解決の入力としてだけである。そしてその解決結果は `pnpm-lock.yaml` に固定されている。

`pin` はレンジという概念ごと消すため、`package.json` と `pnpm-lock.yaml` が同じことを言う状態になる。「どちらを見れば実態が分かるか」という問い自体が消滅し、これは `bump` が到達できない地点である（`bump` は `^4.3.3` を維持するので、`4.3.4` が入っている可能性を常に残す）。

### lockFileMaintenance が直接依存を動かす経路を遮断する（D4 の強化）

pin の最大の実益は宣言の正確さではなく、リスク管理側にある。

`bump` の下では caret レンジが残るため、`lockFileMaintenance`（月次のロックファイル再生成）は**直接依存の in-range 更新も巻き込む**。d3b D4 が明記したとおり、この PR は差分が `pnpm-lock.yaml` のみで changelog もなく、**レビューが原理的に不可能**である。さらに d3b D3 のとおり `lockFileMaintenance` は `minimumReleaseAge` を検証できず、`security:minimumReleaseAgeNpm` は `minimumReleaseAge: null` を設定して警告文を出すだけである。

つまり `bump` 下では「直接依存が、レビュー不能な PR 経由で、Renovate 側の cooldown を素通りして動く」経路が構造的に開いていた（実際に塞いでいるのは pnpm 側の `minimumReleaseAge` のみ）。pin にするとレンジが消えるため in-range 更新という概念自体が消滅し、`lockFileMaintenance` が動かせるのは推移的依存だけになる。レビュー不能 PR の守備範囲が狭まり、D4 のリスク管理は強化される。

### 再現性

pin 下では `package.json` 単体から解決されるバージョンが一意に定まる。ロックファイルを失った場合や、ロックファイルを使わない経路でインストールした場合でも、同じバージョンが入る。

### D3 / D4 との相互作用（実測により事実決着・決定不要）

d3b D2 は「`auto`（= `update-lockfile`）は D4 の `lockFileMaintenance` と PR が重複する既知の問題があり、`bump` は経路が分かれるためこれを回避する」と書いていた。pin では `update-lockfile` 経路そのものが消えるため、この重複は**構造的に起こり得ない**。`bump` が「経路を分けて回避」していた問題を、pin は「片方の経路を消して解消」する。D2 が `auto` を退けた理由は pin に対しては当たらない。

### `engines` / `peerDependencies`（実測により事実決着・決定不要）

pin してはならない depType の扱いは `:pinAllExceptPeerDependencies` の 2 本目のルール（`rangeStrategy: 'auto'`）が織り込み済みで、こちらで手当てする必要はない。加えて ESM には `engines`（ADR-20260728-44b で削除済み）も `peerDependencies`（`package.json` を grep して不在を確認）も存在せず、実影響はゼロである。プリセット名の "ExceptPeerDependencies" は本リポジトリでは空振りする条項にすぎない。

## 影響

- **`package.json` の全直接依存が exact バージョンになる**。初回は Dashboard の「Pin Dependencies」承認 → Pin PR マージで一括適用する（手順は §決定）
- **適用は Dependency Dashboard 上にオープン中の Renovate PR がないタイミングで行うこと**。pin 化は既存 PR ブランチを全面書き換えする
- **今後は patch 更新でも必ず `package.json` に差分が出る**。`bump` 下では in-range かつ下限を超えない更新はロックファイルのみだったが、pin ではすべての更新が宣言の変更を伴う。PR 件数は変わらないが、1 PR あたりの差分は `package.json` へ必ず及ぶ
- **`lockFileMaintenance` PR の守備範囲が推移的依存のみに狭まる**（D4 の強化。レビュー不能 PR が直接依存を動かさなくなる）
- **`rangeStrategy` の正は Renovate 本体のプリセット定義に依存する**（0b6 でグルーピングについて生じた依存が、レンジ戦略にも及ぶ）。`config:js-app` の定義が変わればこちらの実効設定も変わる
- **検証は初回 Pin PR で行う**。`pnpm-lock.yaml` の diff が specifier 行のみで resolved バージョンが不変であること、CI が通ることを確認する

## 関連

- ADR-20260726-d3b（D2 を本 ADR が改訂。同 D2 に追い注記を追記済み。D3 / D4 との相互作用も本 ADR で事実決着）
- ADR-20260730-0b6（`rangeStrategy` をスコープ外として #697 に委ねた。extends の二重 extend 排除方針・プリセット委譲方針を本 ADR が踏襲）
- ADR-20260728-44b（`engines.node` の削除。pin の depType 例外が空振りする根拠）
- Issue #697（本変更の経緯・グリルセッションの記録）
- Issue #639（Dashboard による検証手順）
- Renovate ソース: [config.preset.ts](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/internal/config.preset.ts) / [default.preset.ts](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/internal/default.preset.ts)
