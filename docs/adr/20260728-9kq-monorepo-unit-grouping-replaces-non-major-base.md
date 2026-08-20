# ADR-20260728-9kq: packageRules の non-major ベース層を廃止し、モノレポ単位 + 連動必須ファミリーのグルーピングに再設計する

| 項目 | 値 |
|------|-----|
| ステータス | 採用 |
| 起票日 | 2026-07-28 |
| 最終更新日 | 2026-07-30 |

## コンテキスト

ADR-20260726-d3b の D5 は `packageRules` を「ベース → 型分離 → major 分離 → ファミリー復活」の 4 段構成とし、その 1 段目に「0.x を除く minor/patch を単一グループ `non-major` に集約する」ベース層を置いた。

運用を始めると、Dependency Dashboard 上で**互いに無関係なパッケージが `non-major` として 1 つの PR にまとめて提案**される問題が顕在化した。原因は Renovate のルール解決構造にある。

- `packageRules` は first-match ではなく、マッチした全ルールがオプション単位で順に上書きされる（後勝ち）
- `extends` のプリセット由来ルールが先に評価され、ユーザー定義の `packageRules` がその後に適用される。**プリセットのルールはユーザーのルールに構造的に勝てない**
- `config:recommended` に含まれる `group:monorepos` は、同一モノレポ出身のパッケージ群（`conform` / `radix-ui-primitives` / `dnd-kit` 等。定義データは Renovate 本体の `lib/data/monorepo.json`）にグループ名を付与するが、`non-major` ベース層が全 minor/patch にマッチしてこれを**すべて `non-major` で上書きしていた**
- prisma / react / next 等が正しくグループ化されていたのは、ベース層の後に手書きルールで塗り直していたためにすぎない。手書きしていないモノレポ（conform / radix / dnd-kit / tanstack / testing-library 等）はすべて `non-major` に吸われていた

d3b §保留事項 5 は「`group:monorepos` との重複ルールは削減できる可能性があるが、初回は残して観察する」としており、本 ADR はその観察結果に基づく決着でもある。

## 検討した選択肢

### A. ベース層を廃止し、モノレポ単位グループ + 連動必須ファミリーの手書きルールに再設計する（採用）

`non-major` ルールを削除し、minor/patch のグルーピングを `group:monorepos`（モノレポ単位）に任せる。`extends` に `group:monorepos` を明記する（`config:recommended` に含まれるため機能的には冗長だが、モノレポ単位グループ化に依存する設計であることを設定上で明示する）。加えて、major でも連動が必要なファミリー（conform / radix）の手書きルールを major 分離ルールの後ろに追加する。

### B. ベース層を維持し、手書きグループを後置きで追加して塗り直す（不採用）

conform / radix 等の手書きルールを `non-major` の後ろに足せば、それらのモノレポは正しく分離される。しかし手書きしていない残りの無関係パッケージ（zod / sonner / better-auth 等）は引き続き `non-major` に混載され、問題が部分的に残る。モノレポが増えるたびに手書きが必要になり、プリセットの定義データを活用できない。

### C. ベース層を廃止するだけで、ファミリー手書きルールは追加しない（不採用）

最小差分だが、プリセット由来のグループ名はユーザー定義の major 分離ルール（`groupName: null`）に後勝ちで上書きされるため、**conform の major で `@conform-to/react` と `@conform-to/zod` が別 PR に分解され、片方だけマージできてしまう**。これは d3b D5 が「設計が壊れる」と定義した構造（バージョン連動必須ファミリーの major 分解）そのものであり、既存 ADR が自ら禁じた状態をプリセット任せの範囲に再導入することになる。

## 決定

**A を採用する。** ベース `non-major` 層を廃止してモノレポ単位グループ化に移行し、major 連動が必要な conform / radix のみ手書きファミリールールを追加する。

## 根拠

### グルーピングの 3 基準

グループ化の判断は「パッケージが似ているか」ではなく、次の 3 基準で行う。

| 基準 | 扱い | 例 |
|------|------|-----|
| 1. 連動して壊れる（同一モノレポ・バージョン一致必須・本体追随） | 必ず束ねる | prisma / react / conform |
| 2. リスク同質・実行時影響なし | 無関係でも束ねてよい | `@types/**`（`tsc` が全数検出） |
| 3. それ以外の無関係な依存 | 束ねない | zod / sonner / better-auth |

基準 3 の理由は **bisect 可能性**である。グループ PR が CI で赤くなったとき、無関係なパッケージが混在していると原因の切り分けができない。「PR 数が増えてノイズになる」への対策は `dependencyDashboardApproval` + `prConcurrentLimit: 3` が既に担っており、巨大グループで兼ねる必要がない。ベース層は基準 3 を犠牲にノイズ削減を二重化していた。

### 手書きファミリー追加の基準は「major が連動リリースされるか」

minor/patch のグルーピングはプリセットが担うため、手書きルールの唯一の役割は **major 分離ルールを後勝ちで上書きし返し、major でもグループを維持すること**である（d3b D5 の 4 段目「ファミリー復活」と同じ機構）。追加するのは major が連動リリースされるファミリーに限る。

- **conform（追加）** — ロックステップ型。`@conform-to/react` と `@conform-to/zod` は常に同一バージョンでリリースされ、major の片側マージは壊れる
- **radix（追加）** — 同一ランタイム共有型。統合パッケージ `radix-ui` が各プリミティブを内包再エクスポートするため、`@radix-ui/*` 個別パッケージと版がずれると同一プリミティブの新旧 2 実体が共存し、Context 不一致等の実行時破綻リスクがある
- **dnd-kit / testing-library（追加しない）** — 同一モノレポ出身だが**独立採番型**（現に 6.x / 9.x / 10.x 等でバラバラ）。同時 major がそもそも発生しないため束ねる対象がなく、パッケージ間整合は peerDependencies と CI が検出する。minor/patch はプリセットで束なり、major は個別承認に落ちる

この基準を明文化することで、D5 の 4 段目への恣意的な追加の積み重なりを防ぐ。

> **改訂（2026-07-30 / #696 → ADR-20260730-0b6）**
> この基準は廃止し、「プリセット定義（monorepo.json + group プリセット群）に存在しない連動で、かつ片方だけ上げると壊れることが実測で確認されたもの」の 2 条件に置き換えた。major グループ解除ルール自体が廃止されたため「major 分離を後勝ちで上書きし返す」という手書きルールの役割が消滅し、conform / radix を含む 10 ファミリーの手書きルールはプリセット委譲へ移行した（現存する手書きグループは node + `@types/node` のみ）。独立採番型（dnd-kit / testing-library）の同時 major がグループ 1 本に束なる挙動も許容へ変更した。

### 既存手書きルールは全件維持する（d3b 保留事項 5 の決着 = 削減しない）

プリセットと重複して見える手書きルールを全件精査した結果、**削減可能な重複は 1 件もなかった**。全ルールが、プリセットには構造的に表現できない 2 種類の情報のいずれかを担っている。

- **位置の情報** — major 分離ルールの後ろに置くことで major 連動を復活させる（prisma / vitest / playwright 等）。プリセット由来ルールは必ずユーザールールより先に評価されるため、この位置は取れない
- **境界の情報** — モノレポの境界を跨ぐ連動（next↔eslint-config-next、react↔`@types/react`、node↔`@types/node`、commitlint+commitizen、tailwind+tw-animate-css）。リポジトリ単位でしか束ねないプリセットの定義データに存在し得ない

> **改訂（2026-07-30 / #696 → ADR-20260730-0b6）**
> この決着（全件維持）は、Renovate 本体ソースと npm レジストリの実測により前提が事実誤認と判明したため改訂した。「境界の情報」の代表例 next↔eslint-config-next は `eslint-config-next` の sourceUrl が `vercel/next.js` でありプリセット内、react↔`@types/react` も `config:recommended` 内蔵の `group:react`（`group:recommended` 経由）が名前ベースで表現済みで、「リポジトリ単位でしか束ねない」という前提自体が誤りだった。「位置の情報」は major グループ解除ルールの削除により概念ごと消滅した。手書きルールは node + `@types/node` のみ残し、他はプリセットへ全面委譲した。

### 0.x 除外はベース層とともに失効させる

d3b D5 の `matchCurrentVersion: "!/^0/"` は「0.x の実質 major が巨大グループに紛れ込む」ことへの防御だった。巨大グループ自体が消えるため守るべき対象がなくなり、現在の 0.x パッケージ（class-variance-authority / next-themes / lucide-react）は構造的に個別 PR になる。モノレポグループ内に 0.x メンバーがいる場合は連動リリースなので束ねるのが正しい（基準 1 が基準 3 に優先する）。代替ルールは追加しない。

### GitHub Actions の混載は構造的に解消する（d3b 保留事項 4 の決着）

`non-major` は manager 境界を無視して github-actions の更新も吸い込んでいた（検証手段・原因切り分け・ロールバック粒度が npm 依存と揃わない）。吸い込む土台ルールが消えることで npm 依存と Actions が同一 PR に混載される経路自体がなくなるため、`matchManagers: ["npm"]` による明示分離は行わない。存在しない問題への防御になる。

## 影響

- **単独パッケージの PR 数が増える。** グループなしの依存（zod / sonner / uuid 等）は 1 パッケージ = 1 PR になる。承認制 + `prConcurrentLimit: 3` が制御弁として機能するため PR 洪水にはならないが、Dashboard の行数は増える
- **プリセット由来グループの major は個別 PR に分解される。** dnd-kit / testing-library 等では意図した挙動（独立採番のため）。将来ロックステップ型のモノレポを依存に加えた場合は、手書きファミリールールの追加を判断すること
- **グルーピングの正はプリセットの定義データに依存する。** モノレポの束ね方は Renovate 本体の `lib/data/monorepo.json` の更新に追随する
- **検証は Dependency Dashboard で行う**（#639 の手順に準ずる。Mend のジョブログは gh から到達不可）。`non-major` グループが消え、モノレポ単位のグループに分かれていることを確認する

## 関連

- ADR-20260726-d3b（D5 の 1 段目を本 ADR が廃止。保留事項 4・5 は本 ADR で決着）
- Issue #666（本変更の経緯・スコープ）
- Issue #639（Dashboard による検証手順）
- Renovate 公式ドキュメント: [group:monorepos](https://docs.renovatebot.com/presets-group/#groupmonorepos) / [packageRules](https://docs.renovatebot.com/configuration-options/#packagerules)
