# Renovate Dependency Dashboard のチェックボックスの意味と復旧手順

作成日: 2026-07-31

## 概要

Renovate の Dependency Dashboard は独立した UI ではなく、**Renovate が立てて自動で書き換え続ける 1 個の GitHub issue**（本リポジトリでは #639）である。人間との通信手段は issue body の Markdown チェックボックスだけで、`- [ ]` を `- [x]` にすることが Renovate への唯一の指示経路になっている。

このチェックボックスは見た目がどれも同じ箇条書きだが、意味はセクションごとに大きく違う。特に `## Pending Status Checks` のチェックは**供給網 cooldown を意図的にスキップする**操作であり、automerge を導入した環境では誤クリック 1 回で二層のゲートが同時に無効化されうる（→ #719）。

以下は Renovate 本体のソース（`lib/workers/repository/dependency-dashboard.ts` / `lib/workers/repository/update/branch/index.ts` / `lib/config/options/index.ts`）で裏を取った挙動。

## 詳細

### 1. セクション見出しはブランチの `result` 値と 1 対 1

ダッシュボードの各セクションは、Renovate が各ブランチに付ける `result` 値でフィルタして生成されている。見出しは全 18 種。

```
Config Migration Needed / Config Migration Needed (Blocked) / Repository Problems /
Deprecations - Replacements / Abandoned Dependencies / Pending Approval /
Group Size Not Met / Awaiting Schedule / Rate-Limited / Errored /
PR Creation Approval Required / PR Edited (Blocked) / Pending Status Checks /
Pending Branch Automerge / Other Branches / Open / PR Closed (Blocked) / Vulnerabilities
```

つまり「どのセクションを触ってよいか」という粒度で運用ルールを書くと、Renovate の内部モデルとちょうど一致するため壊れにくい。

### 2. `dependencyDashboardCheck` は種類を区別しない単一の truthy 値

チェックボックスのマーカー（`approve-branch=` / `approvePr-branch=` / `recreate-branch=` / `rebase-branch=` 等）は読み取り時に `dependencyDashboardChecks[branchName] = type` として記録されるが、**下流の `processBranch` は type を見ず、値が truthy かどうかだけを見る**。

```ts
// いずれも「!dependencyDashboardCheck」でガードされている
if (!branchExists && branchConfig.pendingChecks && !dependencyDashboardCheck) { /* result: 'pending' */ }
if (config.dependencyDashboardApproval && !dependencyDashboardCheck) { /* result: 'needs-approval' */ }
if (!config.isScheduledNow && !dependencyDashboardCheck) { /* result: 'not-scheduled' */ }
if (!branchExists && isLimitReached('Branches', ...) && !dependencyDashboardCheck) { /* branch-limit-reached */ }
if (!branchExists && branchConfig.minimumGroupSize > ... && !dependencyDashboardCheck) { /* group size */ }
```

Renovate はチェックを「人間が明示的に意思表示した」というエスケープハッチとして扱い、cooldown・承認・スケジュール・並行数上限・グループサイズを**まとめて**飛ばす。**これが誤クリック 1 回で二層ゲートが同時に消える機構的な理由**であり、種類ごとの粒度は存在しない。

### 3. cooldown 待ちの更新は `Pending Approval` に出ない

`processBranch` の早期 return は `pendingChecks`（cooldown 待ち）→ `dependencyDashboardApproval` の順で評価される。したがって cooldown 中の更新は `## Pending Approval` には現れず、`## Pending Status Checks` にだけ出る。

「承認セクションで承認 → cooldown 明けに PR 作成」という二段構えにはなっておらず、cooldown 明けを待って初めて承認セクションへ移動する。Pending Status Checks を押すことは、**承認セクションを経由せずに PR を作る**ことを意味する。

### 4. チェック状態は永続化されない（押した直後なら戻せる）

`getCheckedBranches()` は実行のたびに issue body を読み直すだけで、チェック状態はどこにも保存されない。押した時点では何も起きず、実際に効くのは次回の Renovate 実行時。

→ **誤って押しても、次の実行までにチェックを外せばブランチも PR も作られない。** ただし実行契機（スケジュール + push）は Mend Cloud 側にあり、猶予の長さは自分では制御できない。

また body は毎回 Renovate に丸ごと組み立て直されるため、**人間がこの issue の body に書き足した内容は次の実行で消える**。`dependencyDashboardHeader` を使うのは、それが Renovate 自身に書かせる = 上書きに耐える唯一の書き込み経路だから。

### 5. `internalChecksFilter` は表示制御ではない

「Pending Status Checks セクションごと消せないか」と考えたときに手が伸びる設定だが、これは**バージョン選択段階の filter**であって表示制御ではない。

```ts
{ name: 'internalChecksFilter', allowedValues: ['strict', 'flexible', 'none'], default: 'strict' }
```

`strict`（既定）は pending なリリースを候補から除外する。`none` は pending でも最高バージョンをそのまま採用し、`flexible` は全バージョンが pending の場合に最高 pending バージョンで PR を作る。つまり**非 strict 値は cooldown 自体を壊す**。セクションを消すためのノブは存在しない。

### 6. cooldown をマージゲートにする手段はあるが、GitHub 側の粒度で使えない

Renovate はブランチに `renovate/stability-days` というステータスチェックを打っている。

```ts
{ name: 'statusCheckNames', default: {
    artifactError: 'renovate/artifacts',
    configValidation: 'renovate/config-validation',
    mergeConfidence: 'renovate/merge-confidence',
    minimumReleaseAge: 'renovate/stability-days',
} }
```

cooldown 中はこれが yellow になるため、ruleset の required checks に入れれば **force 作成された PR も cooldown 満了まで platformAutomerge がマージできない**。cooldown を「PR 作成ゲート」から「マージゲート」に格上げでき、対策として最も本質的。

**ただし required checks はマージ先ブランチ単位でしか設定できず、`renovate/*` ブランチだけに絞れない。** ruleset は develop への全 PR に適用されるため、この context が永久に来ない人間の PR が恒久ブロックされる。制約を置きたい場所（Renovate の PR だけ）と置ける場所（develop への全 PR）がずれており、そのまま採用できない。

### 7. 事後の復旧手順

**PR が作られてしまったら、close ではなく auto-merge を解除する。** `platformAutomerge`（GitHub ネイティブ auto-merge）は required checks の完了を待つため、誤クリックから実マージまでには CI の実行時間ぶんの猶予がある。

close しても復旧はできる。ダッシュボードに `PR Closed (Blocked)` セクション（"The following updates are blocked by an existing closed PR. To recreate the PR, click on a checkbox below."）が現れ、`recreate-branch=` のチェックで作り直せる。

ただし照合はブランチ名 + ベースブランチで行われるため、**バージョンを含まないグループ名は永久にブロックされうる**。

| ブランチ名 | close 後の挙動 |
|---|---|
| `renovate/uuid-14.x` | 次のメジャーで別のブランチ名になるため自然に新しい PR が立つ |
| `renovate/react-monorepo` | ブランチ名が不変。放置すると同じグループが黙って止まり続ける |

「気づく手段が実質ない」という点で、ADR-20260729-d8c が `rebaseWhen` で問題にした状況と同型。

## まとめ

- ダッシュボードで日常的に触ってよいのは `## Pending Approval` だけ
- `## Pending Status Checks` のチェックは cooldown のスキップであり、automerge 環境では自動マージまで到達する
- 押しても次回実行前ならチェックを外して無効化できる。PR ができた後は close ではなく auto-merge 解除

## 参考

- #719（本件の検討）/ #639（Dependency Dashboard 実体）/ #701（automerge 導入）
- ADR-20260726-d3b（承認 + 二層 cooldown の導入意図）
- ADR-20260730-t6e（platformAutomerge の導入。誤クリックの帰結が悪化した原因）
- [Renovate: Dependency Dashboard](https://docs.renovatebot.com/key-concepts/dashboard/)
