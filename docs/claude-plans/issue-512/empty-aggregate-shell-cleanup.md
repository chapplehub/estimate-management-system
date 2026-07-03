# Issue #512: 販売単価の「空集約シェル」問題（全期間削除後に削除→再登録が ValidationError で詰まる） — 実装計画

## 概要

未来開始行だけを持つ販売単価/原価集約から、その最後の1行を `deletePeriod`（誤入力訂正）で削除すると、子（期間行）が0件になっても親行（集約ルート）が残り「空集約シェル」になる。この状態で再登録すると、edit query が `version:<非null>` を返す一方 UI は「未設定＝新規登録」として `expectedVersion` を送らないため `ValidationError`（`RegisterCommand` の既存集約分岐）で詰まる。

本 issue は **B案（最終期間の削除で親行ごと削除し、空シェルを一切残さない）** で修正する。DB状態を CONTEXT.md の用語定義「**未設定** ＝ 期間行を1件も持たない派生状態」に一致させ、不変条件「**親行の存在 ⟺ 期間行≥1件**」を回復する。バグは「コードが既存の用語定義から乖離していた」ものであり、修正はコードを用語定義へ寄せる。

## グリルで確定した根本原因（ユーザー確認済み）

- **空シェルの発生機序**: 未設定商品に未来開始行を1件登録 → 親行（version 1）生成 → その未来行を `deletePeriod` で削除（`CommonSellingPrice.ts:144`、未来開始行の物理削除は許可）→ 親行が version 2・期間0件で残存。
- **再登録の ValidationError**: `PrismaCommonSellingPriceEditQueryService.ts:61` は親が在れば `version:<実値>`、無ければ `version:null` を返す。空シェルは親が在るので `version:<実値>` を返すが、UIは0件を「新規登録モード」と見なし version を送らない → `RegisterCommand` の既存集約分岐が `expectedVersion` 欠落で `ValidationError`（`RegisterCommonSellingPricePeriodCommand.ts:63-67`）。
- **削除の失敗**: 空シェルには消すべき行が無く `requireRow`（`CommonSellingPrice.ts:168`）が「指定された適用期間行が存在しません」＝`BusinessRuleViolationError`（起票は ValidationError と表現）。
- **空シェルへの唯一の到達経路は `deletePeriod`**。`addPeriod`/`editPeriod`/`endDatePeriod` は集約を0件にできないため、修正は delete 経路だけに載る。

## 修正スコープ（ユーザー確認済み）

delete-period 経路の実在＝空シェル到達可能性で判定：

| 集約 | delete-period | 空シェル到達 | 本 issue の対象 |
|---|---|---|---|
| 共通販売単価 `CommonSellingPrice` | あり | 到達（バグ実在） | **対象** |
| 得意先別販売単価 `CustomerSellingPrice` | あり | 到達（バグ実在） | **対象** |
| 原価 `CostPrice` | あり | 到達（バグ実在） | **対象** |
| 納品先別販売単価 `DeliveryLocationSellingPrice` | **なし** | 到達不能 | 変更対象なし（前方ポリシー） |

原価は Issue の「販売単価」の文言からは外れるが、ADR-0066 が「CommonSellingPrice と完全同型」と明言し delete-period が実在するため同じ深刻度で到達可能。3集約を同一PRで直す（画面追加を伴わない単一の永続化不変条件の回復であり、スコープ分割方針が戒める「複数画面の同時実装」には当たらない）。

## 設計判断

### 空になった集約の扱い（Issue 未決事項）
- 案A: 空シェルを許容し read/write 各経路に「親あり・0件＝未設定」の特別扱いを教える
- 案B: 最終期間の削除で親行ごと削除し、空シェルを残さない
- **採用: 案B**（ユーザー確認済み）。(1) DB状態が用語定義「未設定＝0件」と一致し不変条件を回復、(2) 空シェルを全経路で特別扱いする代わりに既存の `null → insert` 経路へ合流、(3) ゴミ行が残らない。#476 で不採用にした「最低1期間のハード強制」とは無関係（0件を禁止するのでなく、0件になった器を片付けるだけ）。

### 「空なら親削除」の判断をどのレイヤーに置くか（Issue 未決事項）
- 案C1: `repository.update()` の中で0件を検知して親削除に切り替える（コマンド無変更）
- 案C2: アプリ層の delete コマンドが空判定で `repository.delete` / `update` を選択（`repository.delete` を新設）
- **採用: 案C2**（ユーザー確認済み）。`RegisterCommand` が既にアプリ層で `existing === null ? insert : update` と永続化オペを選択（「insert/update の選択はインフラ関心としてここで吸収する」）しており、「消滅なら delete・残るなら update」はその鏡像。`update()` に「実は集約ごと消す」二重人格を持たせず、集約消滅のライフサイクル遷移をアプリ層に可視化できる。

### `repository.delete` の楽観ロック
- `deleteMany where {key, version: expectedVersion}` → `assertVersionBumped(count)` を流用（ADR-0039一貫）。親削除で `onDelete: Cascade` が残りの期間行を掃除するので削除は親1本で完結。無条件削除は「A が最終行削除中に B が期間追加」の競合を握り潰すため採らない（version 不一致で ConflictError にする）。

### 再登録経路（Issue 未決事項）
- **register への変更は不要**。親が消えれば `findByProductId` が `null` を返し既存の insert 経路（version 1）へ。edit query も自然に `version:null`＝新規登録モードを返す。B案が「詳細画面に留まる→未設定表示→そのまま再登録できる」を破綻なく成立させる（既存の設計決定8「成功時 redirect せず詳細に留まる」と噛み合う）。

### 既存の空シェルの後始末（Issue 未決事項）
- 案E1: クリーンアップ・マイグレーションで既存シェルを一掃 ＋ register は純B案のまま
- 案E2: マイグレーションせず register を防御的に寛容化
- **採用: 案E1**（ユーザー確認済み）。B案を選んだ以上シェルは定義上ゴミであり掃除するのが完全な修正。E2 の防御的寛容化は却下した案A の特別扱いを register に呼び戻すため不採用。将来シェルが現れたら不変条件違反として既存 ValidationError で loud failure させ気づけるようにする。

### `isEmpty` のドメインメソッド化
- コマンドの空判定は `aggregate.periods.length === 0` でなく **`get isEmpty()`** をドメインに置く。不変条件の語彙を集約が持ち、テスト単位としても純粋関数で扱いやすい。

### ADR 起票
- **不要**（ユーザー判断）。決定内容は既存 ADR-0032/0039/0066/20260624-8tg・#476 の適用に閉じ、独立 ADR を要するアーキテクチャ判断ではない。

## 前方ポリシー（将来 issue への申し送り）

1. **納品先別販売単価に delete-period（保守画面/コマンド）を実装する将来 issue**では、同型の空判定分岐（`isEmpty` → `repository.delete`）とクリーンアップ運用を必ず同時に載せる。B案の不変条件を4集約横断で維持する。

## TDD 進め方（red-green-refactor）

各ステップは「先に失敗するテストを書き（red）→ 実装で通し（green）→ 整理（refactor）」の順で進める。テスト単位は次の3層：

- **ドメイン単体**: `isEmpty`（純粋・DB不要、Vitest）
- **アプリ単体**: delete コマンドの分岐（モックリポジトリで `delete`/`update` の呼び分けを検証）
- **インフラ結合**: `PrismaXxxRepository.delete`（実DB。親＋cascade で期間行が消える／version 不一致で ConflictError／削除後に insert で再登録できる）

3集約は完全同型のため、各ステップは同一編集の ×3。commit は層ごとの意味のあるまとまりで行う（一括コミットしない）。

## ステップ

### Step 1: 計画ファイルの保存
- 対象ファイル: `docs/claude-plans/issue-512/empty-aggregate-shell-cleanup.md`（新規）
- 作業内容: 本計画を保存
- コミットメッセージ: `docs: #512 空集約シェル修正（B案・親削除）の実装計画`

### Step 2: ドメイン `isEmpty` を3集約に追加（red → green）
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/entities/CommonSellingPrice.ts`
  - `src/server/subdomains/pricing/domain/entities/CustomerSellingPrice.ts`
  - `src/server/subdomains/pricing/domain/entities/CostPrice.ts`
  - 各 `__tests__/*.test.ts`
- 作業内容:
  - red: 各エンティティテストに「期間0件で `isEmpty === true`、1件以上で `false`」を追加（`reconstruct` で0件/複数件を組んで検証）
  - green: `get isEmpty(): boolean { return this._periods.length === 0; }` を追加
- コミットメッセージ: `feat: #512 販売単価/原価集約に isEmpty を追加（空判定の語彙）`

### Step 3: repository インターフェースに `delete` を追加＋delete コマンドを分岐（red → green）
- 対象ファイル:
  - `src/server/subdomains/pricing/domain/repositories/CommonSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/domain/repositories/CustomerSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/domain/repositories/CostPriceRepository.ts`
  - `src/server/subdomains/pricing/application/commands/DeleteCommonSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/DeleteCustomerSellingPricePeriodCommand.ts`
  - `src/server/subdomains/pricing/application/commands/DeleteCostPricePeriodCommand.ts`
  - 各コマンドの `__tests__/*.test.ts`（無ければ新規）
- 作業内容:
  - インターフェースに `delete(aggregate, expectedVersion): Promise<void>` を追加（insert の対。JSDoc に「集約が空になったときルートごと削除・cascade で期間行も消える・version 条件付き」を記す）
  - red: コマンド単体テスト（モックリポジトリ）で
    - 「最後の1行を削除し集約が空 → `repository.delete(aggregate, expectedVersion)` が呼ばれ `update` は呼ばれない」
    - 「複数行のうち1行削除し集約が非空 → `repository.update` が呼ばれ `delete` は呼ばれない」
  - green: 各コマンドの末尾を
    ```ts
    aggregate.deletePeriod(...);
    if (aggregate.isEmpty) {
      await this.repository.delete(aggregate, input.expectedVersion);
    } else {
      await this.repository.update(aggregate, input.expectedVersion);
    }
    return aggregate;
    ```
    に変更
- コミットメッセージ: `feat: #512 最終期間削除で集約ルートごと削除するようdeleteコマンドを分岐`

### Step 4: `PrismaXxxRepository.delete` の実装（red → green）
- 対象ファイル:
  - `src/server/subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository.ts`
  - `src/server/subdomains/pricing/infrastructure/prisma/PrismaCostPriceRepository.ts`
  - 各 `__tests__/*.test.ts`
- 作業内容:
  - red: リポジトリ結合テスト（実DB）で
    - 「期間1件の集約を insert → その集約を空にして `delete` → 親行・期間行がともに消える（cascade）」
    - 「`expectedVersion` 不一致で `delete` → `ConflictError`」
    - 「`delete` 後に同一キーで `insert` が成功する（version 1・再登録経路の回帰）」
  - green: 各リポジトリに typed な条件付き削除を実装
    ```ts
    async delete(aggregate, expectedVersion) {
      const result = await prisma.<model>.deleteMany({
        where: { <key>: ..., version: expectedVersion },
      });
      assertVersionBumped(result.count); // count===0 → ConflictError
    }
    ```
    （複合キーの得意先別は `where: { customerId, productId, version }`。期間行は FK cascade に委ねるので子の明示削除は書かない）
- コミットメッセージ: `feat: #512 空集約をルート行ごと削除するrepository.deleteを3集約に実装`

### Step 5: 既存の空シェルを一掃するクリーンアップ・マイグレーション（E1）
- 対象ファイル: `prisma/migrations/<timestamp>_cleanup_empty_selling_price_shells/migration.sql`（新規。`prisma migrate dev --create-only` で枠を作り SQL を手書き。`20260627000100_backfill_cost_price` が先例）
- 作業内容:
  - 期間行を1件も持たない親行を3テーブルから削除（冪等）:
    ```sql
    DELETE FROM common_selling_prices p
     WHERE NOT EXISTS (SELECT 1 FROM common_selling_price_periods c WHERE c.product_id = p.product_id);
    DELETE FROM cost_prices p
     WHERE NOT EXISTS (SELECT 1 FROM cost_price_periods c WHERE c.product_id = p.product_id);
    DELETE FROM customer_selling_prices p
     WHERE NOT EXISTS (SELECT 1 FROM customer_selling_price_periods c
                        WHERE c.customer_id = p.customer_id AND c.product_id = p.product_id);
    ```
  - `pnpm db:migrate` で適用確認
- コミットメッセージ: `feat: #512 既存の空集約シェルを一掃するクリーンアップmigration`

### Step 6: E2E 回帰テスト（共通販売単価の全経路）
- 対象ファイル: `src/app/(features)/common-selling-prices/common-selling-prices-crud.e2e.ts`（既存へ追記。ADR-0012/0017/0020・create-e2e-test スキル準拠）
- 作業内容:
  - シナリオ: 未設定商品に未来開始行を登録 → その行を削除 → 詳細画面に留まり「適用期間が未設定です。共通販売単価が無いと価格決定が解決できません。」が表示される → 同一商品で再登録が成功する
  - seed は today 相対（ADR-20260629-3x5）。得意先別・原価は同型のためインフラ結合＋コマンド単体で担保し、E2E は共通を代表とする（E2E肥大を避ける）
- コミットメッセージ: `test: #512 空集約シェル解消の回帰E2E（削除→未設定→再登録）`

### Step 7: 全体確認
- 作業内容: `pnpm test` / `pnpm lint` / `pnpm build`、`pnpm e2e` を通す。計画との逸脱があれば `docs/claude-plans/issue-512/deviations.md` に記録
- コミットメッセージ: （必要時のみ）`fix: #512 …`
</content>
</invoke>
