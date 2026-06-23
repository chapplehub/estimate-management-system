# Issue #417: 見積申請ユースケース（SubmitEstimateApplicationCommand ＋ 組織スナップショット組立て） — 実装計画

## 概要

estimate サブドメインの **application 層**に、見積申請の「未接続のピース」（`docs/approval-chain-construction.md`）を実装する。金額→抽象段階（`ApprovalRequirementPolicy.judge`）と組織構造→具体役職（`resolveApprovalGoalTiersByDepth` ＋ `ApprovalChainBuilder`）を application 層で配線し、`ApprovalChainOrgSnapshot` を組み立てて承認チェーンを構築、`EstimateApplication`（または承認免除）を永続化する。

業務フロー（`docs/business/estimate/システム設計書(申請).md` §6）に従い、**`PreviewApplication`（クエリ・副作用なし）と `SubmitApplication`（コマンド・永続化）が、judge＋組織スナップショット組立て＋チェーン構築の純粋ロジックを共有**する構成とする。

**前提・依存**: #386（ドメイン層）/#408（resolver）実装済み。#407（申請・免除リポジトリの Prisma 実装）に依存。
**スコープ外（別 issue）**: 確認モーダルの UI・Server Action 配線（presentation 層）／ADR-0048 の商品コード・区分の確定時凍結機構（read-through で judge 入力を得るに留める。受注スライス着手前に別途起票）。

## 設計判断

すべて本 issue の設計 grill で合意済み。直列化機構は **ADR-0066** に記録済み。

### コマンド構造（EXEMPT 分岐の置き場）
- A. 単一 `SubmitApplication` が `judge` を再評価し内部分岐（EXEMPT→免除／REQUIRED→申請+steps／BLOCKED→例外）。正常結末は `ApplicationSubmitted | ApprovalExempted` の union。
- B. judge を呼び出し側で実行し、申請用/免除用の別コマンドへ出し分け。
- **採用: A**。理由: 申請は単一ジェスチャで結末が2通り（`checkTaxRateThenSave`/ADR-0037 と同型）。TOCTOU 防御のため Submit が judge を再評価する（§6.3）以上、分岐はサーバ側に必須。免除を作る application 層の担い手は他に存在しない。

### Preview のスコープ
- `PreviewApplication`（クエリ）も #417 に含め、Submit と共有組立てを両用設計する。
- 理由: §6.2/§6.3 が同じ judge＋組立て＋buildChain を共有する設計。#419 は inbox/状況参照クエリで Preview を含まない。

### 組織データ取得方式
- A. 既存 QueryService（position/role/employee）を消費＋汎用射影2つを各本拠に追加。estimate 側は純粋アセンブラ（引数のみ・ADR-0030/0052）。
- B. estimate 専用の1本 join 読取りモデル（他サブドメインのテーブル直読み）。
- **採用: A**。理由: `CreateEstimateCommand` の `ProductQueryService` 消費（ADR-0052）と同じ作法。承認探索は4段有界（ADR-0063）で N+1・性能問題なし。追加射影（`superiorRoleId`・役割メンバー有無）は承認固有でない汎用事実なので本拠に置く。

### 「1見積1前進」の直列化とトランザクション境界（→ ADR-0066）
- A. `Estimate.version` の条件付き更新を申請挿入の**前段の関門**にし、兄弟チェック（逐次）＋関門（同時）で担保。分散トランザクション不要。
- B. 2集約（Estimate / EstimateApplication）を単一トランザクションで原子化（新抽象導入）。
- **採用: A**（ADR-0066）。理由: 唯一の隙「bump成功・insert失敗」は無害な version 空振りで再 Preview で回復。B が消すのはこの無害ケースのみでコスト倒れ。version トークン1個で TOCTOU（§6.3）＋同時直列化を兼ねる。

### エラーの3分岐
- ケース1: bump 失敗 → `ConflictError`（既存・整形済み文言「すでに更新されています」）。
- ケース2: bump 成功・insert 失敗 → **新設 `EstimateApplicationPersistError`** →「申請に失敗しました。もう一度申請してください。」。`error-handler.ts` の推奨ラップパターンで写像。
- ケース3: 両成功 → 正常 union。
- 採用理由: ADR-0037/0038（失敗＝例外／複数の正常結末＝union）。リカバリは「申請ボタン再押下→再Preview」に乗る。

### BLOCKED の表現（共有 builder の契約）
- ア. `ApprovalChainBuilder.build` を `BUILT | BLOCKED(NO_SUPERIOR_ROLE | GOAL_UNREACHABLE | NO_APPROVER)` の union 返却へ改修（#386 出荷済み改修）。循環・スナップショット欠落（`superiorRoleId` が指す役割がスナップショットに無い）は従来どおり `InvalidArgumentError`（呼び出し側の組立て不備＝バグ）。
- イ. throw のまま型付き例外を新設し Preview が型で catch。
- **採用: ア**。理由: BLOCKED は Preview にとって正常結果（「申請できるか？」への正当な答え）。Preview は union を写像、Submit は境界で `BusinessRuleViolationError` へ昇格。検証ロジックは builder 1箇所のまま（ドリフト防止）。
- **BLOCKED 理由は3値**。①上長未設定＝`NO_SUPERIOR_ROLE`／②ゴール段階到達前に上位役割が尽きる＝`GOAL_UNREACHABLE`／③チェーン上に承認者不在＝`NO_APPROVER`。②を業務状態（BLOCKED）とする根拠: `goalTier` は **judge＝金額由来**（最大で社長）だが、`resolveApprovalGoalTiersByDepth` が4段を強制するのは**役職**側だけ。walk-up するのは**役割チェーン**（`superiorRoleId`）という別グラフで、申請者の上長役割が4段に届かず途切れることは正当にあり得る（役職に本部長/社長が存在しても当該役割チェーンに配線されているとは限らない）。よって「金額が要求する承認段階に役割グラフが届かない」は①③と同じ家族の正当な業務回答であり、バグ（`InvalidArgumentError`）は循環・スナップショット欠落のみに限る。

### コマンド入力・採番・ガード（文書から確定）
- 入力: `{ variationId, operatorEmployeeId, version }`（AC1＋§6.3）。組織文脈は入力せず employee から取得。
- `attempt`: `findByVariationId` の最大+1（初回1・§6.3）。同一バリエーションへの同時再申請も version 関門で直列化。
- INACTIVE バリエーションは申請不可（§3.4/§12）。
- 新射影2つの Prisma 実装は **#417 の責務**（#407 は申請・免除リポジトリ専用）。

## テスト戦略

`/tdd`（vertical slice・1テスト→1実装・公開 IF 越しのふるまい検証）と `testing-backend` 規約に従う。**horizontal slicing 禁止**（全テスト先書き→全実装はしない）。各 Step 内で behavior 単位の red→green を回す。

### レイヤー別の方式（testing-backend §1）
- **純粋関数・純粋ドメインサービス（DB 非依存）＝ インメモリ単体テスト**。`ApprovalChainBuilder` と本 issue の純粋アセンブラは引数のみ（ADR-0030/0052）なので統合ではなく単体。既存 `ApprovalChainBuilder.test.ts`・`resolveApprovalGoalTiersByDepth.test.ts` と同形（スナップショット/DTO をインメモリ生成して assert）。
- **Application 層（Query/Command）＝ 実 Prisma の統合テスト・モック禁止**。実 DB に組織階層（社長→本部長→部長→課長の単一鎖・役割チェーン・`EmployeeRole` メンバー）＋対象見積（バリエーション・末端明細・商品区分）を seed し、公開 IF 越しに検証。
- **Infrastructure・ローダー（内部協調者）＝ 個別テストを書かない**。ローダーは Preview/Submit の統合テストが間接カバー（公開 IF 経由で検証する /tdd の方針）。

### 規約（testing-backend §2）
- `it()`・`describe()` 第一引数はクラス/関数名・記述は日本語・AAA。
- エラーは**発生源で型＋ハードコード文字列**を検証（バブルアップは検証不要）。
- DB を叩くテストは**ユニーク制約列にファイル別プレフィックス**（並列実行の P2002 回避・#327）。FK 依存は `upsert` 冪等・`beforeEach`/`afterEach` の両方で cleanup。
- 組織階層の seed は重いので、テスト用の**組織階層ビルダー helper**（4役職単一鎖＋役割チェーン＋メンバー）を用意する。見積側は既存 `estimateAggregateBuilder` を活用。

### 要確認（/tdd 計画フェーズで優先度を決定）
- **ケース2（bump成功・insert失敗）**: 実 Prisma で insert 失敗を決定的に起こすのが困難。`EstimateApplicationPersistError` への変換を検証するか／するなら失敗注入の Fake リポジトリを許容するか（規約はモック禁止だが Fake は外部依存に許容）を決める。
- **同時実行の真のレース**（同瞬間2申請）は決定的に統合テストしづらい。version 関門は楽観ロック基盤（ADR-0039・既存実績）に委ね、**逐次で検証可能なふるまい**（兄弟前進→拒否／stale version→ConflictError）に絞る。

## ステップ

> 各 Step は vertical slice。テストは「ふるまい」を列挙（実装手順ではない）。Step 内で1ふるまいずつ red→green。

### Step 1: ApprovalChainBuilder を BLOCKED union 返却へ改修（ドメイン）
- 対象ファイル: `src/server/subdomains/estimate/domain/services/approval/ApprovalChainBuilder.ts`、同 `__tests__/ApprovalChainBuilder.test.ts`
- 作業内容:
  - `build()` の戻り値を `{ kind: "BUILT"; plan } | { kind: "BLOCKED"; reason: "NO_SUPERIOR_ROLE" | "GOAL_UNREACHABLE" | "NO_APPROVER" }` に変更。
  - 申請者の上位役割未設定→`NO_SUPERIOR_ROLE`、walk-up 中にゴール段階到達前で上位役割が尽きる（`superiorRoleId === null`）→`GOAL_UNREACHABLE`、チェーン上の役割に承認者不在→`NO_APPROVER` を union で返す。循環・スナップショット欠落（`superiorRoleId` が指す役割がスナップショットに無い）は `InvalidArgumentError` のまま（呼び出し側の組立て不備＝バグ）。
- テスト（**単体・インメモリ**、既存テストを改修）:
  - 起点〜ゴールの役割列で `BUILT`（plan の goalPositionId・roleIds 順序）を返す。
  - 申請者の上位役割未設定 → `BLOCKED(NO_SUPERIOR_ROLE)`（旧 throw 期待を union 期待へ変更）。
  - ゴール段階到達前に上位役割が尽きる → `BLOCKED(GOAL_UNREACHABLE)`（旧 throw 期待を union 期待へ変更）。
  - チェーン上に承認者不在の役割 → `BLOCKED(NO_APPROVER)`（旧 throw 期待を union 期待へ変更）。
  - 循環・スナップショット欠落 → `InvalidArgumentError`（型＋メッセージ据え置き）。
- コミットメッセージ: `refactor: ApprovalChainBuilder は BLOCKED を union で返す（Preview と共有するため）`

### Step 2: 組織データの汎用射影2つを各本拠に追加（employee / role）
- 対象ファイル: `employee/application/queries/EmployeeQueryService.ts`＋Prisma 実装＋DTO、`role/application/queries/RoleQueryService.ts`＋Prisma 実装、各 `__tests__`
- 作業内容:
  - `EmployeeQueryService.findSuperiorRoleId(employeeId): Promise<string | null>` を追加・実装。
  - `RoleQueryService.findRoleIdsWithMembers(roleIds): Promise<Set<string>>`（メンバー有無＝`EmployeeRole` 存在）を追加・実装。
- テスト（**統合・実 PrismaQueryService**）:
  - `findSuperiorRoleId`: 上位役割を持つ従業員→その roleId／持たない従業員→null。
  - `findRoleIdsWithMembers`: メンバーのいる役割 ID だけを集合で返す／メンバー不在・空入力→空集合。
- コミットメッセージ: `feat: 承認チェーン組立て用に上位役割ID・役割メンバー有無の射影を追加する`

### Step 3: 純粋アセンブラ（judge＋resolve＋snapshot＋build）
- 対象ファイル: `estimate/application/shared/approval/assembleApprovalChain.ts`（新規）、`__tests__`
- 作業内容:
  - 引数（バリエーション属性・positions/roles/membership の素データ・申請者上位役割）のみを受け、`judge` → `resolveApprovalGoalTiersByDepth` → `ApprovalChainOrgSnapshot` 組立て → `ApprovalChainBuilder.build` を実行。
  - 結果を `EXEMPT(reason) | REQUIRED(plan) | BLOCKED(reason)` で返す純関数（DB 非依存・ADR-0030/0052）。
- テスト（**単体・インメモリ**、resolver テストと同形）:
  - 事後/消耗品のみ/10万未満 → `EXEMPT(reason)`。
  - 金額段階に応じてゴールへ到達する `REQUIRED(plan)`（goalPositionId・roleIds 順序）。
  - builder の `BLOCKED` を透過する。
  - 役職が4段単一鎖でない → `BusinessRuleViolationError`（resolver 由来・型＋メッセージ）。
- コミットメッセージ: `feat: 承認チェーン組立ての純粋アセンブラを追加する`

### Step 4: 越境読取りローダー（QueryService/Repository 集約）
- 対象ファイル: `estimate/application/shared/approval/loadApprovalChainInputs.ts`（新規）
- 作業内容:
  - `EstimateRepository`（finalTotal・estimateType・variation 有効性）、`ProductQueryService`（leafCategories・read-through/ADR-0048）、`EmployeeQueryService`/`PositionQueryService`/`RoleQueryService`（上位役割・全役職・役割群・メンバー有無）を集約し、アセンブラ入力を組み立てる。
  - 役割チェーンは申請者上位役割から根まで walk-up（≤4）。
- テスト: **個別テストは書かない**（内部協調者。Step 5/7 の統合テストが公開 IF 経由で間接カバー）。
- コミットメッセージ: `feat: 組織スナップショット入力の越境ローダーを追加する`

### Step 5: PreviewApplication クエリ
- 対象ファイル: `estimate/application/queries/PreviewApplicationQuery.ts`（新規）、`dto/PreviewResultDTO.ts`、factory、`__tests__`
- 作業内容:
  - ローダー＋アセンブラを呼び、`{ EXEMPT(reason) | REQUIRED(goalPosition, steps[{order, roleName, positionName}]) | BLOCKED(reason) }` を返す（§6.2）。副作用なし。
- テスト（**統合・実 Prisma**、組織階層＋見積を seed）:
  - 免除見積（消耗品のみ等） → `EXEMPT(reason)`。
  - 承認要見積 → `REQUIRED(goalPosition, steps の roleName/positionName が起点→ゴール順)`。
  - 上位役割未設定 → `BLOCKED(NO_SUPERIOR_ROLE)`／役割チェーンがゴール段階に届かない → `BLOCKED(GOAL_UNREACHABLE)`／承認者不在役割 → `BLOCKED(NO_APPROVER)`。
  - 呼び出し後に申請行・免除行が増えない（副作用なし）。
- コミットメッセージ: `feat: 申請プレビュー（確認モーダル用）クエリを追加する`

### Step 6: EstimateApplicationPersistError とエラー写像
- 対象ファイル: `estimate/application/.../errors`（新規 or 既存 errors）、（presentation 接続は別 issue のため #417 では型のみ）
- 作業内容:
  - `EstimateApplicationPersistError`（アプリ層例外）を新設。
- テスト（**単体**）: 所定メッセージと `cause` を保持する。
- コミットメッセージ: `feat: 申請保存失敗を表す EstimateApplicationPersistError を追加する`

### Step 7: SubmitApplication コマンド（version 関門→挿入・ADR-0066）
- 対象ファイル: `estimate/application/commands/SubmitApplicationCommand.ts`（新規）、factory、`__tests__`
- 作業内容:
  - 入力 `{ variationId, operatorEmployeeId, version }`。Estimate ロード→INACTIVE/兄弟チェック→`judge` 再評価→`EstimateRepository.update(expectedVersion=version)` で関門→通過後に分岐（EXEMPT=`Exemption.insert` / REQUIRED=`EstimateApplication.create`(`attempt`採番)+`insert` / BLOCKED=`BusinessRuleViolationError`）。
  - 関門後 insert 失敗は `EstimateApplicationPersistError` で包んで再送出（ケース2）。
- テスト（**統合・実 Prisma**、組織階層＋見積を seed）:
  - REQUIRED: 申請＋ステップ列が永続化（`finalApprovalPositionId`・stepOrder 連番・`attempt=1`）。
  - EXEMPT: 免除1件が永続化し、申請行は作られない。
  - BLOCKED（承認者不在）: `BusinessRuleViolationError`（型＋メッセージ）。
  - INACTIVE バリエーション: 拒否（型＋メッセージ）。
  - 兄弟が前進中: 拒否（1見積1前進・型＋メッセージ）。
  - stale version（取得後に他更新）: `ConflictError`（関門・型）。
  - 差戻後の再申請: `attempt=2`。
  - （要確認）ケース2: `EstimateApplicationPersistError`（テスト要否は /tdd 計画で決定）。
- コミットメッセージ: `feat: 見積申請コマンド（version関門で1見積1前進を直列化）を追加する`

### Step 8: 結線（factories / index バレル）
- 対象ファイル: `estimate/application/factories/`、関連 barrel
- 作業内容: Preview/Submit のファクトリ配線、必要な公開エクスポート整理。
- テスト: 個別テスト不要（Step 5/7 の統合テストが間接カバー）。
- コミットメッセージ: `chore: 申請プレビュー・申請コマンドのファクトリを結線する`
