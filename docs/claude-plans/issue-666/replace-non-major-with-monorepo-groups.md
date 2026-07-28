# Issue #666: renovate の non-major グループを廃止し group:monorepos によるモノレポ単位グループ化に移行する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`renovate.json` の base ルール `non-major`（0.x を除く minor/patch を単一グループに集約）が、`config:recommended` に含まれる `group:monorepos` のグループ名を後勝ちで上書きし、無関係なパッケージが 1 つの PR にまとめられている。この base 層を廃止してモノレポ単位グループ化に移行し、あわせて major でも連動が必要な conform / radix の手書きファミリールールを追加する。決定は新規 ADR + ADR-20260726-d3b への追記で記録する。

計画の前提となる詳細スコープ・受け入れ条件は Issue #666 本文（grill セッション後に更新済み）を正とする。

## 設計判断

いずれも grill セッション（2026-07-28）でユーザーと合意済み。

### base `non-major` ルールの廃止方式
- A. `non-major` を削除し、モノレポ単位グループ化（`group:monorepos`）に任せる
- B. `non-major` を残し、手書きグループを後置きで追加して塗り直す
- 採用: A（B は無関係パッケージの混載が部分的に残る。ノイズ制御は `dependencyDashboardApproval` + `prConcurrentLimit: 3` が担うため、巨大グループでの抑制は不要）。`extends` に `group:monorepos` を明記する（機能的には冗長だが、設計依存を設定ファイル上で明示するため）

### 手書きファミリー追加の基準
- 基準は「**major が連動リリースされるか**」。conform（ロックステップ型: react / zod アダプタが同一バージョン）と radix（同一ランタイム共有型: 統合パッケージ `radix-ui` がプリミティブを内包再エクスポート）は該当し、**major ルールの後ろ**に手書きルールを追加して major でもグループを維持する
- dnd-kit / testing-library は同一モノレポ出身でも独立採番型（同時 major が発生しない）のため追加しない。minor/patch は `group:monorepos`、major は個別承認

### 0.x 除外（`matchCurrentVersion: "!/^0/"`）の扱い
- 代替ルールは追加せず失効させる。巨大グループという守るべき対象が消え、現在の 0.x パッケージは構造的に個別 PR になる。失効の経緯は新規 ADR に記録する

### 既存手書きルールの扱い（d3b 保留事項 5 の決着）
- 全件無変更で維持する。重複に見えるルールは全件が「位置の情報」（major ルール後置による major 連動復活）または「境界の情報」（モノレポ横断連動）を担い、プリセットには構造的に表現できない

### GitHub Actions の混載（d3b 保留事項 4 の決着）
- 追加ルールなしの「構造的解消」とする。吸い込む土台ルールが消えるため混載経路がなくなる。`matchManagers` による明示分離は書かない

### 決定の記録方法
- 新規 ADR + d3b への追記の 2 点構成（保留事項 2 → ADR-20260728-44b の前例踏襲）。d3b の決定本文は書き換えず、D5 への廃止注記と保留事項 4・5 の解決注記のみ追記する

## ステップ

### Step 1: renovate.json のグルーピング再設計
- [x] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - base `non-major` ルール（packageRules 先頭）を削除する
  - `extends` に `group:monorepos` を明記する
  - major ルールの**後ろ**に手書きファミリールールを 2 件追加する:
    - `@conform-to/**` → `groupName: "conform"`
    - `radix-ui`, `@radix-ui/**` → `groupName: "radix-ui"`
    - 各 description に「major ルールの後ろに置くことで major でも連動する」配置理由を記載する
  - 既存の手書きルール（types / major / prisma / next / react / tailwind / vitest / playwright / commitlint / node）は変更しない
- コミットメッセージ: `ci: renovate の non-major グループを廃止しモノレポ単位グループ化に移行する`（ボディに設計判断の要点を記載）

### Step 2: ADR の作成と d3b への追記
- [ ] **完了**
- 対象ファイル: `docs/adr/20260728-{id}-*.md`（新規）、`docs/adr/20260726-d3b-adopt-renovate-with-approval-and-two-layer-cooldown.md`、`docs/adr/INDEX.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新規 ADR を作成する（ID 採番・配置は ADR-0000 / TEMPLATE.md に従う）。記録内容:
    - グルーピングの 3 基準（連動必須は必ず束ねる / リスク同質は束ねてよい / それ以外は bisect のため束ねない）
    - 後勝ち解決の構造（プリセットはユーザールールに勝てない。手書きルールの「位置の情報」「境界の情報」）
    - ファミリー追加基準「major が連動リリースされるか」と conform / radix の該当理由、dnd-kit / testing-library の非該当理由
    - 0.x 除外の失効経緯
  - d3b に追記する（決定本文は書き換えない。様式は #667 で確立された blockquote 形式 `> **YYYY-MM-DD 追記（#xxx）**` に合わせる）:
    - D5 に「1 段目（ベース層）は新 ADR で廃止」の注記
    - D7 末尾の「副作用として、`non-major` グループに GitHub Actions の更新が混ざる」の一文に失効注記（non-major 廃止により混載経路が消滅）
    - 保留事項 4 に「解決済み → 新 ADR（構造的解消）」の注記
    - 保留事項 5 に「解決済み → 新 ADR（削減しない）」の注記
  - `docs/adr/INDEX.md` に新規 ADR を追加する
- コミットメッセージ: `docs: packageRules グルーピング再設計の ADR を追加し d3b の保留事項 4・5 を決着する`

## 備考

- 受け入れ条件の最終項目「Dependency Dashboard で `non-major` グループが消えモノレポ単位に分かれていることの確認」は**マージ後**の検証であり、本計画のステップには含まれない。検証手順は #639 に準ずる（Mend のジョブログは gh から到達不可。Dashboard の issue 本文で確認する）
