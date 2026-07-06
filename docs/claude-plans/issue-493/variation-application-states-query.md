# Issue #493: 見積申請 バリエーション別 申請状態参照クエリ（GetVariationApplicationStates） — 実装計画

## 概要

見積詳細画面（S2）の「申請ボタン出し分け」と「バリエーション別バッジ」を駆動する参照系ユースケースを実装する。`GetVariationApplicationStatesQuery(estimateId)` を新設し、バリエーション単位の現在申請状態（6値）と `canApply`（申請可否ゲート）を `{ variationId, applicationState: { code, label }, canApply }[]` として返す。DTO 形・状態語彙・`canApply` セマンティクスは #491 で合意（ADR-0069）。本 issue はその型定義と実装を担う（BE 分担）。

読み取り側と書き込み側（`SubmitApplicationCommand`）が「前進判定」「§3.6 状態導出」で**ドリフトしない**よう、両者を純粋関数で共有する。

## 設計判断

会話（/grill-with-docs）で確定した判断。

### 6値 code 語彙の置き場所（→ ADR-20260706-u7z）
- X. 新6値ドメインVO `VariationApplicationState` を新設し `ApplicationStatus`(4値)を再利用
- X'. `ApplicationStatus` 自体を6値に拡張
- Y. 読み取り層の union 型（`ApplicationStatusCode | "NONE" | "EXEMPTED"`）
- **採用: X**。主語が違う（`ApplicationStatus`=1申請の状態／`VariationApplicationState`=バリエーションの状態）。X' は getter の戻り型が偽り（4値しか返せないのに6値約束）になり申請VOに免除意味論が漏れる。Y はドリフト防止は満たすが CONTEXT 語彙に振る舞い付きの実体VOを与えられず還元一本化の利点を失う。ADR 起票済み。

### 状態ラベルの正準文言
- EXEMPTED=「承認不要」（表示ステータスと統一・同一の免除事実に表示語を割らない）、NONE=「未申請」。
- 申請と重なる4値のラベルは `ApplicationStatus.label` へ委譲（二重定義しない＝ラベルもドリフトさせない）。

### §3.6 状態導出の共有（読み取り／書き込みのドリフト封じ）
- (a) QueryService でエンティティ再ハイドレート / (b) §3.6 導出を純粋関数へ抽出し getter と read model で共有 / (c) SQL 側で再現
- **採用: (b)**。`EstimateApplication.applicationStatus` getter を純粋関数へ委譲化し、read model も同じ関数を使う。微妙な優先順位ロジックを単一ソースに。CQRS の投影スタイルとも一貫し read は軽いまま。

### 前進判定の共有
- **採用**: バリを `VariationApplicationState` へ還元 → `.isAdvancing()`（＝前進バリエーション：申請中・承認済・免除）。見積単位ゲート（「1つでも前進なら申請不可」）を純粋ポリシーとして command（throw）と query（canApply）で共有。`SubmitApplicationCommand.assertNoAdvancingVariation` の2 throw を1つに統一。

### バリエーション単位の畳み込み規則
- 上から評価: ①免除行あり→承認不要（最優先）②申請行あり→最新 attempt（`max(attempt)`）の導出状態 ③どちらも無し→未申請。還元先は `VariationApplicationState`。

### DTO の形・配置
- 全バリ返却（INACTIVE 含む）／variationNumber 昇順／INACTIVE は canApply=false／application 層に置き FE は直 type-import（ADR-0069）／`code` 型は VO 由来 `VariationApplicationStateCode`。
- `canApply` は BLOCKED（承認チェーン構築可否）を**含めない**＝preview 専任。

### コンパイル時消費テスト
- `never` ガードの消費スタブ1本のみ（runtime 反復は作らない）。既存 pre-push `tsc --noEmit`（全プログラム型検査）が gate。CI/hook 拡張なし。

## ステップ

### Step 1: `ApplicationStatusCode` の export
- 対象ファイル: `domain/values/approval/ApplicationStatus.ts`
- 作業内容:
  - `VALID_VALUES` を export 可能にし、`ApplicationStatusCode`（4値 code 型）を `VALID_VALUES as const` から export。VO 本体（4値）は据え置き。
- コミットメッセージ: `feat: ApplicationStatus に code 型を export（VALID_VALUES 由来の単一ソース）`

### Step 2: §3.6 導出の純粋関数抽出
- 対象ファイル: `domain/values/approval`（新規純粋関数）／`domain/entities/approval/EstimateApplication.ts`
- 作業内容:
  - `deriveApplicationStatus({ hasWithdrawal, hasAnyRejection, allStepsApproved })` を純粋関数として抽出。
  - `EstimateApplication.applicationStatus` getter を、自分の行から3真偽値を作って同関数へ委譲する形に refactor（振る舞い不変）。
  - 純粋関数の導出テスト（優先順位・各状態）。
- コミットメッセージ: `refactor: 申請状態の §3.6 導出を純粋関数へ抽出し getter を委譲化（read model と共有）`

### Step 3: `VariationApplicationState` VO（6値）
- 対象ファイル: `domain/values/approval/VariationApplicationState.ts`（新規）
- 作業内容:
  - 6値 `VALID_VALUES`（NONE/PENDING/REJECTED/WITHDRAWN/APPROVED/EXEMPTED）＋ `VariationApplicationStateCode` export。
  - label: 4値は `ApplicationStatus.label` へ委譲、NONE=「未申請」/ EXEMPTED=「承認不要」を自前。
  - `isAdvancing()`（PENDING/APPROVED/EXEMPTED→true）。
  - 畳み込み還元ファクトリ（免除最優先→最新 attempt→未申請）。入力は materialize 済みの事実（免除有無・各申請の導出状態＋attempt）。
  - VO・還元・isAdvancing の導出テスト。
- コミットメッセージ: `feat: バリエーション申請状態VO（6値・ApplicationStatus再利用・畳み込み還元）`

### Step 4: 前進判定の共有ポリシー＋command 載せ替え
- 対象ファイル: `domain/policies/approval`（新規）／`application/commands/SubmitApplicationCommand.ts`
- 作業内容:
  - 見積単位の前進ゲート（各バリを `VariationApplicationState` へ還元し `isAdvancing()`、前進バリを検出）を純粋ポリシーとして実装。
  - `assertNoAdvancingVariation` を同ポリシーへ載せ替え（免除 throw と申請 throw を統一）。
  - ポリシーの導出テスト（兄弟をまたいだ判定）。
- コミットメッセージ: `refactor: 前進判定を見積単位の共有ポリシーへ一元化（command と query で共有）`

### Step 5: 読み取り DTO 型
- 対象ファイル: `application/queries/dto`（新規 DTO）
- 作業内容:
  - `VariationApplicationStateDTO`（`{ variationId, applicationState:{code,label}, canApply }`）と `VariationApplicationStateCode`（VO 由来）を定義。FE 直 type-import 前提（ミラー禁止・ADR-0069）。
- コミットメッセージ: `feat: バリエーション申請状態の読み取りDTO型を定義（FE直type-import・ADR-0069）`

### Step 6: `GetVariationApplicationStatesQuery` ＋ infra QueryService
- 対象ファイル: `application/queries/GetVariationApplicationStatesQuery.ts`（新規）／`infrastructure/queries`（Prisma QueryService）／query factory 配線
- 作業内容:
  - Prisma で見積配下の全バリ・各申請の §3.6 導出入力・免除有無を読み、Step 2/3 の共有関数で状態へ還元。
  - `canApply(v) = v.ACTIVE && 見積内に前進バリ無し`（Step 4 の共有ゲート）。INACTIVE は false。
  - variationNumber 昇順で返す。Factory へ登録。
  - 導出テスト（各状態への導出・兄弟をまたいだ canApply）を実 DB（seed）で。
- コミットメッセージ: `feat: GetVariationApplicationStatesQuery（バリ別申請状態＋canApply・実DB導出）`

### Step 7: コンパイル時消費スタブ
- 対象ファイル: 消費スタブ（型検査専用ファイル）
- 作業内容:
  - `VariationApplicationStateCode` 全6値を網羅 switch し `default` で `const _exhaustive: never = code` ガード。DTO の全フィールド（code/label/canApply）を読む。実行時アサートなし＝pre-push tsc が合否。
- コミットメッセージ: `test: バリエーション申請状態DTOのコンパイル時消費スタブ（never網羅・ADR-0069）`
