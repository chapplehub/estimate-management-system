# Issue #493: 承認系テスト見積番号帯レジストリ（恒久的な衝突防止） — 実装計画

## 概要

承認系（`N9907xxx` 帯）の実DB統合テストは、共有テストDB上で各ファイルが「10番号=1サブ帯」を
占有する暗黙慣習で隔離してきた。しかし #493 で追加した `GetVariationApplicationStatesQuery.test.ts`
が既存 `ApproveStepCommand.test.ts` の **03x 帯（N9907030-032）を二重占有**し、vitest フルスイート
（pre-push）の並列実行時に `estimateNumber @unique` 制約または `beforeEach` cleanup の相互削除で
1テストが確率的に落ちる競合を生んだ（初回 push が中断した原因）。

本計画は、承認系テストの番号帯を **単一ソースの TS 定数 `APPROVAL_TEST_BANDS` に集約**し、
**全番号のグローバル一意性をコンパイル/ユニットテストで強制**することで、この種の衝突を恒久的に
封じる。既存6ファイルの `EN` 定義をこの定数参照へ移行し、衝突中の query テストを空き帯 05x へ退避する。

### 現状の帯割り当て（洗い出し結果）

| サブ帯 | 所有ファイル | 番号 | 状態 |
|---|---|---|---|
| 00x | `PrismaEstimateApprovalExemptionRepository.test.ts` | N9907001-003 | 確定 |
| 01x | `PrismaEstimateApplicationRepository.test.ts` | N9907010-018 | 確定 |
| 02x | `WithdrawApplicationCommand.test.ts` | N9907020-022 | 確定 |
| 03x | `ApproveStepCommand.test.ts` | N9907030-032 | 確定 |
| 03x | `GetVariationApplicationStatesQuery.test.ts`（#493 新規） | N9907030-037, 039 | ⚠ 03x を ApproveStep と二重占有 → **05x へ退避** |
| 04x | `RejectStepCommand.test.ts` | N9907040-043 | 確定 |
| **05x** | `GetVariationApplicationStatesQuery.test.ts`（退避先） | **N9907050-059** | 新規予約（空き確認済み） |

## 設計判断

### 帯マップの置き場所
- A. 共有ヘルパー（`ensureApprovalFixtures.ts`）先頭にコメント表で集約
- B. `docs/` 配下の専用ドキュメント
- C. TS 定数（`APPROVAL_TEST_BANDS`）として集約し各テストが参照
- **決定: C**（会話で合意）。理由: 帯を「文書」ではなく「実行される単一ソース」にすることで、
  各テストの `EN` が定数を参照 → 番号のハードコード重複自体が起きにくくなり、後述のガードテストで
  衝突をCIが機械的に検出できる。ドキュメントは実装から乖離し陳腐化するが、定数＋ガードテストは
  乖離した瞬間にテストが赤くなる。

### 衝突の恒久防止メカニズム
- A. 定数を置くだけ（運用規律に依存）
- B. 定数＋**全帯の番号をフラット化しグローバル一意性を検証するガードテスト**
- **決定: B**。理由: 「恒久的に衝突しない」を運用規律ではなくテストで担保する。将来誰かが帯を
  追加/重複させても、`Set` サイズ ≠ 総数 で即座に fail する高速ユニットテスト（DB非依存）が
  pre-commit / pre-push の両方で門番になる。これが本計画の中核価値。

### 定数ファイルの配置レイヤー
- 承認系テスト専用のフィクスチャ基盤である `src/server/__tests__/helpers/` に置く
  （既存 `ensureApprovalFixtures.ts` / `cleanupApprovalFixtures` と同居する隔離基盤の一部）。
  DDD レイヤ規約はテストヘルパーには適用されない（プロダクションコードではない）。

### 移行順序（バグ修正を先、全体リファクタを後）
- Step 1 で定数＋ガードを作り、Step 2 で**衝突中の query テストだけを先に 05x へ退避**して
  flaky を解消（最優先・pre-push を通す）、Step 3 で残る5ファイルを定数参照へ移行（番号不変の
  純リファクタ）。理由: 出荷済み・安定している既存帯の番号は変えず、新参の query テストを動かすのが
  最小破壊。flaky の解消を先行させ、広域リファクタのリスクと分離する。

### コミットタイプ
- 変更対象はすべてテストコード/テストヘルパーのため `test:` を使う（`fix:` ではない。プロダクション
  挙動は不変で、修正対象はテスト隔離の欠陥のため）。Step 2 のボディに「flaky（番号帯衝突）の解消」
  という fix 的意図を記す。

## ステップ

### Step 1: 番号帯レジストリ定数とグローバル一意性ガードテストを追加
- 対象ファイル:
  - `src/server/__tests__/helpers/approvalTestBands.ts`（新規）
  - `src/server/__tests__/helpers/__tests__/approvalTestBands.test.ts`（新規）
- 作業内容:
  - `APPROVAL_TEST_BANDS` を `as const` の `Record<所有者名, readonly string[]>` で定義。
    キーは所有ファイルを表す名前（`exemptionRepository` / `applicationRepository` /
    `withdrawCommand` / `approveStepCommand` / `rejectStepCommand` / `variationQuery`）。
    値は各サブ帯の見積番号タプル（既存5帯は現状の番号をそのまま、`variationQuery` は 05x=
    N9907050-059）。ファイル先頭コメントに上記「帯割り当て表」を記載し単一ソース化する。
  - ガードテスト: 全帯をフラット化し「重複番号ゼロ（`new Set(all).size === all.length`）」を
    アサート。加えて全番号が `N9907` 接頭辞かつ 8 桁である形式不変条件も検証（帯外流出の検出）。
    DB非依存の純ユニットテストとして pre-commit/pre-push 双方の門番にする。
  - TDD: まずガードテストを書き（RED: 定数未存在）、定数を作って GREEN。
- コミットメッセージ:
  ```
  test: 承認系テスト見積番号帯のレジストリ定数と一意性ガードを追加

  承認系(N9907xxx)統合テストは共有DB上でファイル毎に10番号=1サブ帯を占有する
  暗黙慣習で隔離していたが単一ソースが無く、#493 で 03x の二重占有(flaky)を招いた。
  帯を APPROVAL_TEST_BANDS 定数へ集約し、全番号のグローバル一意性を検証する
  DB非依存ガードテストで衝突を機械検出できるようにする。

  置き場所に定数(コメント/専用docではなく)を選択。理由: 帯を実行される単一ソース化し
  乖離をテストで即検出するため。
  ```

### Step 2: query テストを 05x へ退避し定数参照へ（flaky 解消）
- 対象ファイル:
  - `src/server/subdomains/estimate/application/queries/__tests__/GetVariationApplicationStatesQuery.test.ts`
- 作業内容:
  - ローカル `EN` の番号を `APPROVAL_TEST_BANDS.variationQuery`（N9907050-059）から引くよう変更。
    03x（ApproveStep 所有）との重複を解消する。テストの論理（9ケース）は不変。
  - 帯宣言コメントを「05x 帯・レジストリ参照」に更新。
  - 関連スペックを実行し 9 ケース GREEN を確認（`ApproveStepCommand.test.ts` と**同時実行**しても
    衝突しないことを、両ファイル同時 run で確認する）。
- コミットメッセージ:
  ```
  test: 申請状態参照クエリのテスト見積番号を05x帯へ退避（flaky解消）

  GetVariationApplicationStatesQuery.test.ts が ApproveStepCommand.test.ts の
  03x帯(N9907030-032)を二重占有し、vitestフルスイート並列時に estimateNumber
  一意制約 / beforeEach 相互削除で1テストが確率的に落ちていた(初回push中断の原因)。
  レジストリの variationQuery(05x=N9907050-059)を参照し衝突を解消する。
  ```

### Step 3: 既存5ファイルの EN をレジストリ参照へ移行（番号不変）
- 対象ファイル:
  - `PrismaEstimateApprovalExemptionRepository.test.ts`
  - `PrismaEstimateApplicationRepository.test.ts`
  - `WithdrawApplicationCommand.test.ts`
  - `ApproveStepCommand.test.ts`
  - `RejectStepCommand.test.ts`
- 作業内容:
  - 各ファイルのハードコード `EN` を `APPROVAL_TEST_BANDS.<所有者名>` 由来へ差し替える
    （番号の値は一切変えない・純リファクタ）。各ファイルの帯宣言コメントを「レジストリ参照」に更新。
  - 各ファイルの関連スペックを実行し回帰ゼロを確認。番号を変えないためデータ挙動は同一。
  - 意味のあるまとまりでコミット（1ファイル=1コミット、または repository系/command系でまとめる）。
- コミットメッセージ（例・分割時は同型を繰り返す）:
  ```
  refactor: 承認系テストの見積番号をレジストリ定数参照へ統一

  ハードコードされた見積番号を APPROVAL_TEST_BANDS 参照に置換する(番号の値は不変)。
  番号帯の単一ソース化により、将来のテスト追加時の帯重複をガードテストが検出できる。
  ```
