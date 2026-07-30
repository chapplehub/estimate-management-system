# Issue #696: renovate.json の手書きグループルールをプリセット委譲に整理し、major グループ解除を廃止する（9kq 保留事項 5 の改訂） — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`renovate.json` の手書きグループルール（12 ルール）を `config:recommended` 内蔵プリセットへの全面委譲に整理し、2 ルール（major ラベル付与 / node + `@types/node`）へ削減する。あわせて major グループ解除の概念を廃止する。判断の経緯は #696 本文（グリルセッション確定版に更新済み）を正とする。

- Renovate 本体ソースの実測により、9kq 保留事項 5 の決着「全件維持」の前提（位置の情報・境界の情報はプリセットに表現できない）が事実誤認と判明した
- `config:recommended` は `group:monorepos` に加え `group:recommended`（→ `group:react`）も内蔵しており、`@types/react` 系の react monorepo への合流は素の `config:recommended` だけで達成される
- `rangeStrategy` の pin 移行（d3b D2 の改訂）は **#697 に分離済み**。本 Issue では `rangeStrategy: "bump"` に触れない
- **適用タイミング条件**: マージは Dependency Dashboard 上にオープン中の Renovate PR がないタイミングで行う（グループ名変更により既存 PR が close → 新規作成されるため）。2026-07-30 時点でオープン中の Renovate PR は 0 件

## 設計判断

いずれもグリルセッション（2026-07-30）で決着済み。詳細な根拠は #696 本文を正とする。

### 独立採番型 monorepo の major グループ化の許容
- A. dnd-kit / testing-library の同時 major がグループ 1 本の PR に束なる挙動を許容する
- B. `matchSourceUrls` ベースの major 分解ルールを手書きで残す
- 採用: A（B は Issue が消そうとしている順序依存の再導入。束なっても同一 monorepo 内で bisect 可能性は毀損されず、承認制でマージ前に気づける。9kq との最大の設計差分として新 ADR に記録する）

### extends の構成
- A. Issue 原案どおり `group:definitelyTyped` + `group:react` を追加する
- B. 両方追加しない（`config:recommended` 内蔵の `group:react` に委譲する）
- 採用: B（`group:react` は `group:recommended` 経由で内蔵済み。definitelyTyped は現在メンバー 0 で実益がなく、後置すると内蔵 `group:react` を打ち消すため明示 `group:react` の再指定が必要になる——この順序依存ごと見送る。無所属 `@types/**` を将来束ねたくなったら definitelyTyped → react の順で追加する旨を description に記録する）

### 手書きルール追加基準の改訂（新 ADR に記録）
- 9kq の「major が連動リリースされるか」を廃止し、**2 条件**に置き換える: 「プリセット定義（monorepo.json + group プリセット群）に存在しない連動」かつ「片方だけ上げると壊れることが実測で確認済み」
- 現状該当は node + `@types/node` のみ。tailwind + tw-animate-css / commitlint + commitizen 系は第 2 条件を満たさず削除

### ドキュメント記録の構成
- 新規 ADR（プリセット全面委譲・major グループ解除廃止・追加基準 2 条件・独立採番型 major 束ね許容・tailwind / commitlint 削除と definitelyTyped / react 不採用の理由）
- 9kq へ解決注記（#666 と同形式。決定本文は書き換えない）
- d3b へ追い注記（D5 の #666 追記の直後と保留事項 5 の既存注記の下。既存注記が今回消える追加基準を参照しているため、参照切れ防止としてスコープに追加した）
- `docs/adr/INDEX.md` 更新

### rangeStrategy の扱い
- pin 移行は #697 に分離（d3b D2 の改訂として別途設計）。本 Issue では `"rangeStrategy": "bump"` を維持する

## ステップ

### Step 1: renovate.json をプリセット委譲版に改訂する
- [x] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル。検証はマージ後に Dependency Dashboard で行う——受け入れ条件参照）
- 作業内容:
  - `extends` から `group:monorepos` を削除する（`config:recommended` に内蔵のため二重 extend）。他の 4 エントリは変更しない
  - `description` に グループ化委譲のエントリを 1 件追加する（内蔵プリセットへの委譲・手書き追加基準の 2 条件・無所属 `@types/**` の将来の再追加手順と順序制約）。既存 4 エントリ（rebaseWhen 関連）は変更しない
  - `packageRules` を 12 → 2 ルールに削減する:
    - 削除: types / prisma / next / react / tailwind / vitest / playwright / commitlint / conform / radix-ui の 10 グループルール
    - major ルールを `matchUpdateTypes: ["major"]` + `addLabels: ["major"]` のみに縮小（`groupName: null` と `dependencyDashboardApproval: true` を除去し、description を更新）
    - node + `@types/node` ルールは一切変更しない
  - 確定 JSON は #696 本文「最終版 renovate.json」を正とする（description の文言調整は可）
- コミットメッセージ: `ci: renovate.json の手書きグループルールをプリセット委譲に整理する`

### Step 2: ADR を作成・改訂し INDEX を更新する
- [x] **完了**
- 対象ファイル: `docs/adr/20260730-{slug}-delegate-grouping-to-presets-and-drop-major-degrouping.md`（新規。slug は既存規約に従い採番）、`docs/adr/20260728-9kq-monorepo-unit-grouping-replaces-non-major-base.md`、`docs/adr/20260726-d3b-adopt-renovate-with-approval-and-two-layer-cooldown.md`、`docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新規 ADR を作成する。記録する論点は #696 本文「9kq からの判断変更点」の 4 点（保留事項 5 の改訂 / 追加基準の 2 条件化 / 独立採番型 major 束ねの許容 / 順序依存の完全解消）に加え、tailwind / commitlint 削除と definitelyTyped / react 不採用の理由
  - 9kq の「既存手書きルールは全件維持する」節と「手書きファミリー追加の基準」節に `> **改訂（2026-07-30 / #696 → 新 ADR）**` 形式の解決注記を追記する（決定本文は書き換えない）
  - d3b の D5 #666 追記の直後と保留事項 5 の既存注記の下に、各 1 段落の追い注記を加える（d3b の注記チェーン形式に合わせる）
  - `docs/adr/INDEX.md` に新規 ADR を追加する
- コミットメッセージ: `docs: グルーピングのプリセット全面委譲と major グループ解除廃止を ADR に記録する`
