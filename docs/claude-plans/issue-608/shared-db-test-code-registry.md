# Issue #608: role/employee のDB依存単体テストが並列実行時のみ flaky に落ちる — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

DB依存の単体テスト（vitest）は単一の共有テストDB上でファイルを別ワーカーで並列実行する（ADR-0012）。2ファイルが同じコードを使うと、`beforeEach`/`afterEach` の cleanup が互いの行を削除し合い、確率的（flaky）に落ちる。実害は `UpdateRoleCommand.test.ts` と `PrismaEmployeeQueryService.roleNames.test.ts` が役割コード `ROLE971-973` を共有していること（加えて `EMP990710/711` も roleNames × isSoleMember で二重占有）。

従来の対策（#327 のファイル別プレフィックスの明文化）は人間の規律頼みで、role/employee 空間では実際に破綻していた。本 Issue では、共有DBテストのコード割当を「**コードをキーにした `as const` レジストリ**」に集約し、二重割当を TypeScript **TS1117**（重複オブジェクトキー）でコンパイル時（pre-push `tsc`・エディタ）に禁止する。`roleCd`／`employeeCd` の2空間について、現消費者（ROLE9xx/EMP9xxxx を使う role/employee 系テスト約24ファイル）を**全て**レジストリへ移行し、静的一意性を穴なく成立させる（案A・完全統治）。

設計の全体像は ADR `docs/adr/20260715-f71-shared-db-test-code-registry-static-uniqueness.md` に記録済み。

## 設計判断

会話（/grill-with-docs）で確定済み。詳細は上記 ADR を参照。

### コード割当の一意性担保方式
- A. コードキーのレジストリ ＋ TS1117 による静的一意検証（**採用**）
- B. 承認系(#493)の所有者キー ＋ ランタイムのガードテスト
- C. テストごとにランダムID採番
- D. ファイル別プレフィックスの明文化（#327）
- E. トランザクションでラップしてロールバック（#62案）
- 採用理由: 隔離の不変条件「1コード=1所有ファイル」をデータ構造（キーの一意性）＝型検査で強制。承認系(B)より検出が前倒し・確実。有限な `roleCd` 空間（1000通り）でも決定的に衝突ゼロを保証し再現性も保つ。

### レジストリのファイル粒度
- コード空間（ユニークカラム）ごとに1ファイルを `src/server/__tests__/helpers/test-codes/` に配置（採用）。
- 理由: 一意性の防御単位はカラム単位。同一空間の全消費者が1ファイルに揃うことが発見可能性の実体であり、巨大な単一ファイルは不要。

### 消費API（生成とcleanupの drift 封じ）
- 所有者エントリ1つから「用途別コード（生成用）」と「全コード配列（cleanup用）」の**両方を同一ソースで導出**する（採用）。
- 理由: 生成用とcleanup用を別々に導出すると片方だけ増えて drift → 削除漏れ → 同型の再発。単一ソース化で構造的に一致させる。

### 適用範囲
- 案A: ROLE9xx/EMP9xxxx を使う role/employee 系テスト全消費者（約24ファイル）を移行し2空間を完全統治（**採用**）。
- 案B: 衝突ファイルのみ移行。
- 採用理由: 静的一意性は全消費者がレジストリに載って初めて穴なく成立する。案Bは未登録の既存ファイルとの衝突余地を残す。

### スコープ外
- 得意先・商品・納品先ほかの空間 → 別Issue #611 で同型に漸進移行。
- 承認系 `approvalTestBands.ts` の本方式への寄せ → 任意の別スコープ。
- #90（QueryService の読み取り側スキャン競合）→ 別クラスの障害。本 Issue の対象外。

## ステップ

### Step 1: `defineTestCodes` 共有ファクトリの実装
- [x] **完了**
- 対象ファイル:
  - `src/server/__tests__/helpers/test-codes/defineTestCodes.ts`（新規）
  - `src/server/__tests__/helpers/test-codes/__tests__/defineTestCodes.test.ts`（新規）
- テスト戦略: TDD（DB非依存の純ロジック＝派生索引の構築・形式ガード・不正時の throw。層判断上 TDD が適切）
- 作業内容:
  - `コード → { owner, use }` の `as const` マップを受け取り、`owner → { [use]: code, codes: string[] }` の派生索引を import 時に1回構築して返す。
  - 形式ガード: 与えた接頭辞パターン（例 `/^ROLE\d{3}$/`）に全キーが合致することを検証し、違反時は throw。
  - `codes` はその owner の全コード配列（cleanup 用・生成用と同一ソース）。
- コミットメッセージ: `test: 共有DBテストのコード割当を静的一意化する defineTestCodes ファクトリを追加 (#608)`

### Step 2: role/employee コードレジストリの定義（全消費者分を採番）
- [ ] **完了**
- 対象ファイル:
  - `src/server/__tests__/helpers/test-codes/roleTestCodes.ts`（新規）
  - `src/server/__tests__/helpers/test-codes/employeeTestCodes.ts`（新規）
- テスト戦略: テスト不要（データ宣言のみ。二重割当は TS1117、形式は Step 1 の `defineTestCodes` 形式ガードで担保。専用テスト不要）
- 作業内容:
  - 既存の役割系テスト全ファイルが使う `ROLE9xx` を owner/use 付きで採番。現状の衝突（`ROLE971-973` の二重占有）を解消するよう所有を一意化（片方の owner を空きコードへ退避）。
  - 従業員系の `EMP9xxxx` も同様に採番し、`EMP990710/711` の二重占有を解消。
  - `defineTestCodes` で派生索引を export。
- コミットメッセージ: `test: role/employee のDBテストコードをレジストリに集約し二重割当を解消 (#608)`

### Step 3: 衝突2ファイルをレジストリ参照へ移行（実害の解消）
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/role/application/commands/__tests__/UpdateRoleCommand.test.ts`
  - `src/server/subdomains/employee/infrastructure/queries/__tests__/PrismaEmployeeQueryService.roleNames.test.ts`
- テスト戦略: 実装後テスト（対象は既存テスト自体。移行後に当該2ファイル＋関連空間を反復実行して緑安定を確認）
- 作業内容:
  - ハードコードの `TEST_ROLE_CDS` 等を撤廃し、レジストリの派生索引から用途別コードと cleanup 用 `codes` を取得する形へ置換。
  - `pnpm test` 該当2ファイル＋周辺を複数回実行し flaky が出ないことを確認。
- コミットメッセージ: `fix: 役割コード二重占有による role/employee テストの並列 flaky を解消 (#608)`

### Step 4: 同2空間の残り全消費者をレジストリ参照へ移行（完全統治）
- [ ] **完了**
- 対象ファイル: ROLE9xx/EMP9xxxx を使う role/employee 系テストの残り全ファイル（`PrismaRoleQueryService.*`・`Search/Get/Create/Delete*Query|Command`・各 DomainService テスト・`PrismaEmployeeRepository`・`PrismaEmployeeQueryService.*` ほか。着手時に `grep -rl "ROLE9\|EMP99" src/**/__tests__` で全量確定）
- テスト戦略: 実装後テスト（対象は既存テスト群。移行後にフルスイート反復で緑安定を確認）
- 作業内容:
  - 各ファイルのハードコードコードをレジストリへ吸い上げ、派生索引参照＋`codes` による cleanup へ置換。未登録ファイルが残らないようにする（残ると TS1117 の保証に穴が空くため）。
  - 意味的なまとまり（サブドメイン/クエリ・コマンド別）で分割コミットしてよい。各コミットは関連テストが緑になる単位で区切る（pre-commit 規約）。
- コミットメッセージ（例）: `test: role/employee のDBテストコードをレジストリへ全面移行し2空間を完全統治 (#608)`

### Step 5: 検証（フルスイート反復で緑安定を確認）
- [ ] **完了**
- 対象ファイル: なし（検証のみ）
- テスト戦略: テスト不要（検証ステップ。失敗モードの厳密特定はせず、原因消失をフルスイート反復で実証する方針）
- 作業内容:
  - `pnpm test` フルスイートを複数回（目安 10〜20 回）連続実行し、role/employee 系 flaky の再発がないことを確認する。
  - 逸脱があれば `docs/claude-plans/issue-608/deviations.md` に記録する。
- コミットメッセージ: （検証のみのためコミットなし。修正が生じた場合は該当 Step へ戻す）
