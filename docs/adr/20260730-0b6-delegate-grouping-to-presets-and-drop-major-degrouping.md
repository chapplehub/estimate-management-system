# ADR-20260730-0b6: グルーピングを config:recommended 内蔵プリセットに全面委譲し、major グループ解除を廃止する

| 項目 | 値 |
|------|-----|
| ステータス | 採用 |
| 起票日 | 2026-07-30 |
| 最終更新日 | 2026-07-30 |

## コンテキスト

ADR-20260728-9kq は non-major ベース層の廃止と同時に、「既存手書きルールは全件維持する」（d3b 保留事項 5 の決着）と「手書きファミリー追加の基準は major が連動リリースされるか」を決めた。全件維持の根拠は、手書きルールがプリセットには構造的に表現できない 2 種類の情報——**位置の情報**（major 分離ルールの後置による major 連動の復活）と**境界の情報**（next↔eslint-config-next 等、モノレポ境界を跨ぐ連動）——を担っている、というものだった。

今回、Renovate 本体のソース（`lib/config/presets/internal/config.preset.ts` / `group.preset.ts` / `lib/data/monorepo.json`）と npm レジストリの `repository.url` 実測に基づき再調査した結果、**この前提の大半が事実に反する**ことが判明した（調査の全記録は #696 本文を正とする）。

1. **`group:monorepos` は `config:recommended` に内蔵されている。** extends への明記（9kq が「設計依存の明示」として採った）は二重 extend だった
2. **`group:recommended` も `config:recommended` に内蔵されており、その中に `group:react` が含まれる。** `group:react` は `@types/react` / `@types/react-dom` / `@types/react-is` に `react monorepo` というグループ名を**名前ベースで**付与し、sourceUrl マッチで同名グループを得る react 本体と合流させる。つまり**リポジトリ境界を跨ぐ合流はプリセットで表現可能**であり、「境界の情報はプリセットに存在し得ない」は monorepo.json しか見ていなかったことによる事実誤認だった
3. **「境界の情報」の代表例だった next↔eslint-config-next は、そもそも境界を跨いでいなかった。** npm レジストリの実測で `eslint-config-next` の sourceUrl は `vercel/next.js` であり、`group:monorepos` が束ねる。同様に `@vitest/coverage-v8` / `@playwright/test` / 統合パッケージ `radix-ui` もすべて本体と同一 sourceUrl で、手書き 10 ファミリー中 7 つはプリセットが完全カバーする
4. **「位置の情報」は、major グループ解除ルール自体を消せば概念ごと不要になる。** `separateMajorMinor`（既定 `true`）はグループを維持したまま major と minor/patch を別 PR に分けるため、ロックステップ系の「major でも連動」はプリセットのグループ化だけで自然に満たされる。現行設定は 10 ファミリー全てで後置きルールによりグループ解除を打ち消しており、設計が自己矛盾していた
5. **major ルールの `dependencyDashboardApproval: true` は完全に冗長。** トップレベルで全更新に承認を要求済みであり、「major は個別に承認」という特別扱いはそもそも存在しない。実効機能は `addLabels: ["major"]` のみだった

## 検討した選択肢

### A. グルーピングをプリセットに全面委譲し、major グループ解除を廃止する（採用）

extends から `group:monorepos` を削除（内蔵のため）し、packageRules を 2 ルール（major ラベル付与 / node + `@types/node`）に削減する。major の `groupName: null` と個別承認を廃止し、major と minor/patch の分離は `separateMajorMinor` に任せる。

### B. 現状維持（9kq の「全件維持」を継続する）（不採用）

前提（位置の情報・境界の情報）が実測で否定された以上、10 ファミリーの手書きルールはプリセット定義の劣化コピーである。Renovate 本体の monorepo 定義が更新されても手書き側には反映されず、二重管理の乖離リスクだけが残る。

### C. プリセットに委譲しつつ、major グループ解除は維持する（不採用）

9kq の設計意図（独立採番型 monorepo の major は個別 PR）を保存する案。しかし major 解除ルールはプリセット由来のグループ名を後勝ちで上書きするため、ロックステップ系（prisma / conform / radix 等）の major 連動を復活させる後置き手書きルールが再び必要になる。Issue が消そうとしている順序依存と手書き管理の構造がそのまま残り、委譲の意味がなくなる。

### D. extends に `group:definitelyTyped` + `group:react` を追加する（Issue 原案・不採用）

`group:react` は `group:recommended` 経由で内蔵済みのため冗長。`group:definitelyTyped` は無所属の `@types/**` が現在 0 件（node / react 系のみで全て他グループへ引き抜かれる）で実益がない。しかも definitelyTyped を後置すると内蔵 `group:react` を後勝ちで打ち消すため、それを打ち消し返す明示の `group:react` が必要になる——extends 内に新たな順序依存（definitelyTyped → react）を持ち込むことになり、この順序依存ごと見送る。将来無所属の `@types/**` を束ねたくなったら、この順序セットで extends に追加する（手順と順序制約は `renovate.json` の description に記録済み）。

## 決定

**A を採用する。** `renovate.json` は extends 4 エントリ + packageRules 2 ルールになる。設定の全文は `renovate.json` を正とする。

- extends: `config:recommended` / `security:minimumReleaseAgeNpm` / `:semanticCommitTypeAll(chore)` / `:maintainLockFilesMonthly`
- packageRules 1: major に `addLabels: ["major"]` のみ（グループ解除・個別承認は廃止）
- packageRules 2: node + `@types/node` グループ（ADR-20260728-44b。変更なし）

### 手書きルール追加基準の改訂

9kq の「major が連動リリースされるか」を廃止し、次の **2 条件**に置き換える。

1. **プリセット定義（monorepo.json + group プリセット群）に存在しない連動**であること
2. **片方だけ上げると壊れることが実測で確認済み**であること

現状該当するのは node + `@types/node` のみ（nvm manager と npm を跨ぐ連動はプリセットに構造的に存在しない）。9kq の「グルーピングの 3 基準」は上位概念として存続し、変わるのは基準 1（連動して壊れる）の実現手段——手書きからプリセット委譲へ——である。

## 根拠

### 9kq 保留事項 5 の決着「全件維持」を改訂する

「境界の情報」は実測で二重に否定された。代表例 next↔eslint-config-next は sourceUrl が同一でプリセット内であり、真に境界を跨ぐ react↔`@types/react` も内蔵 `group:react` が名前ベースで表現済みだった。「プリセットはリポジトリ単位でしか束ねられない」という前提自体が誤りである。「位置の情報」は major グループ解除ルールの削除により、守るべき対象（解除の打ち消し）ごと消滅する。

### 独立採番型 monorepo の major 束ねを許容する（9kq との最大の設計差分）

9kq は dnd-kit / testing-library 等の独立採番型 monorepo について「同時 major がそもそも発生しないため束ねる対象がない」として major を個別 PR に落とす設計だった。本 ADR ではグループ解除の廃止により、同時に複数 major が存在する場合はグループ 1 本の major PR に束なる。これを許容する理由は次の 3 点。

- 独立採番型で同時 major が発生する頻度はそもそも低い（9kq 自身の認定）
- 束なっても同一 monorepo 内であり、無関係プロジェクト間の bisect 可能性（9kq 基準 3 の根拠）は毀損されない
- 全更新が承認制のため、Dashboard 上で構成を確認してから PR を作成できる

### tailwind + tw-animate-css / commitlint + commitizen 系の手書きルールを削除する

いずれも「境界の情報」としてプリセット外（`tw-animate-css` / `commitizen` 系は別リポジトリ）だが、追加基準の第 2 条件「片方だけ上げると壊れることが実測で確認済み」を満たさない。リスク同質・利便性ベースの束ねであり、プリセット定義に存在しない連動を手書きで増やす基準を「壊れる実測」に絞る以上、削除する。必要性が実測で確認されたら再追加を検討する。

### 順序依存の packageRules 設計（d3b D5 に由来）を完全に解消する

d3b D5 の 4 段構成は「記述順が意味を持つ」設計であり、9kq 後も型分離 → major 分離 → ファミリー復活の順序依存が残っていた。本 ADR により packageRules の記述順依存が消え、選択肢 D の見送りにより extends 内の順序依存も発生しない。記述順が意味を持つ構造が設定全体から消滅する。

## 影響

- **グループ名が手書き名からプリセット命名に変わる**（`prisma` → `prisma monorepo` 等）。ブランチ名が変わるため、切替時に既存の Renovate PR は close → 新規作成される。**適用は Dependency Dashboard 上にオープン中の Renovate PR がないタイミングで行うこと**
- **`tw-animate-css` / `commitizen` / `cz-conventional-changelog` が個別 PR になる**
- **独立採番型 monorepo の同時 major はグループ 1 本の major PR に束なる**（上記根拠のとおり許容）
- **無所属の `@types/**` は個別 PR になる**（現在 0 件のため実影響なし。`definitelyTyped` グループは作られない）
- **グルーピングの正は Renovate 本体のプリセット定義に全面依存する**（9kq の同項の帰結がさらに強まる。monorepo.json / group プリセットの更新に追随する）
- **検証は Dependency Dashboard で行う**（#639 の手順に準ずる）。モノレポ単位（`* monorepo` 命名）のグループ構成、`@types/react` 系の react monorepo への合流、`definitelyTyped` グループの不存在を確認する
- `rangeStrategy: "bump"` は本 ADR のスコープ外（pin への移行は #697 で別途設計する）

## 関連

- ADR-20260728-9kq（保留事項 5 の決着と手書き追加基準を本 ADR が改訂。解決注記を追記済み）
- ADR-20260726-d3b（D5 の順序依存設計を本 ADR が完全解消。追い注記を追記済み）
- ADR-20260728-44b（node + `@types/node` グループ。本 ADR で唯一維持する手書きルール）
- Issue #696（本変更の経緯・調査の全記録・スコープ）
- Issue #697（rangeStrategy の pin 移行。本 ADR のスコープ外）
- Issue #639（Dashboard による検証手順）
- Renovate ソース: [config.preset.ts](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/internal/config.preset.ts) / [group.preset.ts](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/internal/group.preset.ts) / [monorepo.json](https://github.com/renovatebot/renovate/blob/main/lib/data/monorepo.json)
