# 承認チェーン構築パイプライン

見積申請の承認フロー（承認チェーン）が、どのコンポーネントの協調で組み立てられるかを解説する開発者向けドキュメント。金額から「何段の承認が要るか」を決め、組織構造から「具体的に誰が承認するか」を解決し、申請集約の承認ステップ実体まで組み上げる一連の流れを扱う。

- 業務視点（何を承認するか・閾値）の正は `docs/business/estimate/システム設計書(申請).md`。
- 設計判断の正は ADR-0062（承認段階の返却と役職解決の分離）/ ADR-0063（深さ算出＋4段 fail-fast）。
- 本書はそれらを前提に、コード上の責務分担とデータフローを束ねて示す。

## 設計の核心：「2つの問い」を分離する

承認チェーンの構築は、本質的に独立した2つの問いに分かれる。

```
問い①「この見積は “誰の段階” まで承認が要るか？」  ← 金額・区分から決まる（抽象）
問い②「その段階の “具体的な役職/役割” は誰か？」    ← 組織構造から決まる（具体）
```

ADR-0062 の根幹は **この①と②を絶対に混ぜない**こと。①は estimate ドメインの業務ルール、②は組織（position/role）の構造。`ApprovalGoalTier`（承認段階）という抽象を間に挟むことで、estimate ドメインは「どの役職が課長か」を知らずに承認要否を判定でき、組織サブドメインは承認都合の段階概念を持たずに済む。依存は `estimate → 組織` の一方向に保たれる。

## 全体像（データフロー）

```
                      ┌─────────────────────────────────────────────┐
   見積(金額/区分)  →  │ ① ApprovalRequirementPolicy.judge()          │
                      │    → goalTier: ApprovalGoalTier（抽象段階）   │  例: 部長段階
                      └──────────────────┬──────────────────────────┘
                                         │ goalTier
   組織グラフ(役職)  →  ┌────────────────┴──────────────────────────┐
   (position)          │ ② resolveApprovalGoalTiersByDepth()          │
                      │    PositionId → ApprovalGoalTier の Map       │
                      └──────────────────┬──────────────────────────┘
                                         │ positionTier を埋める
   組織グラフ(役割)  →  ┌────────────────┴──────────────────────────┐
   (role/employee)     │ ③ ApprovalChainBuilder.build()               │
                      │    起点から goalTier 到達まで役割を辿る        │
                      └──────────────────┬──────────────────────────┘
                                         │ returns
                      ┌──────────────────┴──────────────────────────┐
                      │ ④ ApprovalChainPlan（設計図 VO）              │
                      │    goalPositionId + 順序付き roleIds[]        │
                      └──────────────────┬──────────────────────────┘
                                         │ plan を渡す
                      ┌──────────────────┴──────────────────────────┐
                      │ ⑤ EstimateApplication.create()               │
                      │    plan から EstimateApprovalStep を事前生成  │
                      └─────────────────────────────────────────────┘
```

## 各コンポーネントの役割

### ① ApprovalRequirementPolicy — 承認要否と「抽象段階」の決定

`src/server/subdomains/estimate/domain/policies/ApprovalRequirementPolicy.ts`

副作用のない純粋ポリシー。バリエーションのスナップショット属性（税込合計・末端明細の商品区分・見積区分）を引数で受け、免除か承認必要かを判定する。

- 事後見積／消耗品のみ／10万円未満は免除（理由付き）。
- 承認必要なら金額段階から**抽象的なゴール段階** `ApprovalGoalTier` を返す（10万=課長／100万=部長／1000万=本部長／3000万=社長・税込・ADR-0055）。
- 返すのは段階のみで、`Position` の identity は知らない（ADR-0062）。

### ② resolveApprovalGoalTiersByDepth — 「役職 → 段階」の翻訳辞書

`src/server/subdomains/estimate/application/shared/resolveApprovalGoalTiersByDepth.ts`

③が必要とする `positionTier`（各役職の抽象段階）を**先に解決しておく**アプリ層の純関数（issue #408・ADR-0063）。

- **入力**: 役職グラフの最小射影 `{ positionId, superiorPositionId }[]`。position サブドメインの集約エンティティ型に依存しない（ADR-0030/0052）。
- **解決方式**: 最上位役職（社長 = `superiorPositionId` が null）を構造的アンカーとし、根からの距離で段階を割る（距離0→社長 … 距離3→課長）。`PositionName` の自由文字列にも専用マスタにも依存せず、「4役職 = 4承認段階」という業務不変条件を構造から導出する。
- **出力**: `Map<positionId.value, ApprovalGoalTier>` ＝ 役職IDを引けば段階が返る辞書。
- **fail-fast**: 「最上位を起点に正確に4段の単一鎖」でなければ `BusinessRuleViolationError`。係長・専務などの段追加で前提が破れたとき、段がズレて黙って誤承認するのを**申請時に顕在化**させる（ADR-0063）。

> なぜアプリ層の純関数か:
> `ApprovalGoalTier` は estimate が承認のために定義した語彙で、汎用の position サブドメインには存在させない。翻訳の所有権を estimate 側に置き依存を一方向に保つ一方、ドメイン純度（リポジトリ非依存）を守るため組織グラフは**引数で渡す**。よって「ドメインサービスではなくアプリ層の純関数」という配置になる。

### ③ ApprovalChainBuilder — チェーンの探索エンジン

`src/server/subdomains/estimate/domain/services/ApprovalChainBuilder.ts`

承認フロー構築の心臓。`build()` の本体はグラフ探索ひとつ。

- **起点**: 申請者の上位役割（`applicantSuperiorRoleId`）。本人ではなく上司から始まる（ADR-0003：常に上位承認を求める）。
- **辿り方**: `superiorRoleId` で役割を1段ずつ上へ。
- **停止条件**: 辿り着いた役割の役職段階がゴール段階以上になったら停止（`current.positionTier.isAtLeast(goalTier)`）。
- **副次検証**: 役割グラフの循環・ゴール到達不能・承認者不在で例外。
- **返すもの**: 子エンティティ `EstimateApprovalStep` は集約外なので生成できない（ADR-0027）。そのため設計図 VO `ApprovalChainPlan` のみを返す。

> ビルダーが `positionTier.isAtLeast(goalTier)` と**比較するだけ**で済むのは、各役割ノードに段階が**すでに埋まっている**前提だから（`ApprovalChainOrgRole.positionTier`）。ビルダー自身は「どの役職が部長か」を一切知らない。この「知らなくていい」を成立させるのが②の resolver の仕事。

### ④ ApprovalChainPlan — ③→⑤を繋ぐ設計図 VO

`src/server/subdomains/estimate/domain/values/ApprovalChainPlan.ts`

ビルダー（services 層）と集約（entities 層）の間の受け渡し専用 VO。中身は2つだけ。

- `goalPositionId`: 解決済みの最終承認役職（`finalApprovalPositionId` になる）。
- `roleIds`: 起点からゴールまで順序付けされた承認対象役割の列（最低1件・ADR-0003）。

> この VO が存在する理由は純粋に集約境界。子エンティティ `EstimateApprovalStep` を生成できるのは集約ルート `EstimateApplication` だけ（ADR-0027/0036）。ビルダーはルート外なので子を作れない。そこで「子の型を露出しない、役割IDの列という設計図」を返すことで、境界を破らずに『何段の承認が要るか』を集約へ伝える。

### ⑤ EstimateApplication.create — 設計図から実体を組む

`src/server/subdomains/estimate/domain/entities/EstimateApplication.ts`

集約内ファクトリ（ADR-0036）。`plan.roleIds` を `EstimateApprovalStep` に変換し、`stepOrder` を1始まり連番で付与。`plan.goalPositionId` を `finalApprovalPositionId` として確定する。ここで承認フローが実体（永続化対象）になる。

## 一連の流れ（具体例：税込120万円の見積を、課長の部下が申請）

```
① ApprovalRequirementPolicy.judge({ finalTotal: ¥1,200,000, ... })
     100万以上1000万未満 → goalTier = DEPARTMENT_MANAGER（部長段階）

② resolveApprovalGoalTiersByDepth(役職グラフ)
     → { POS課長→SECTION_MANAGER, POS部長→DEPARTMENT_MANAGER,
         POS本部長→DIVISION_MANAGER, POS社長→PRESIDENT }
   アプリ層はこの辞書で各役割の positionId から positionTier を引き、
   ApprovalChainOrgSnapshot.roles を組み立てる

③ ApprovalChainBuilder.build({ goalTier: DEPARTMENT_MANAGER, snapshot })
     起点 = 申請者の上司（課長役職の役割）から superiorRoleId を辿る
       課長役割: positionTier = SECTION_MANAGER     < 部長 → 続行・chain に追加
       部長役割: positionTier = DEPARTMENT_MANAGER  >= 部長 → 停止
     → ApprovalChainPlan { goalPositionId: POS部長,
                           roleIds: [課長役割, 部長役割] }

⑤ EstimateApplication.create({ plan, ... })
     Step1: 課長役割の承認待ち
     Step2: 部長役割の承認待ち
     finalApprovalPositionId = POS部長
```

これで「課長 → 部長」の2段承認フローが生成される。

## 責務分担サマリ

| 関心 | 担当 | 層 | 知らないこと |
|---|---|---|---|
| いくらで誰の段階が要るか | `ApprovalRequirementPolicy` | domain/policies | Position の実体 |
| 役職 → 段階の翻訳 | `resolveApprovalGoalTiersByDepth` | application/shared | 金額・チェーン構築 |
| 起点から辿る探索 | `ApprovalChainBuilder` | domain/services | 役職をどう段階化したか・リポジトリ |
| 設計図の運搬 | `ApprovalChainPlan` | domain/values | ステップ実体 |
| 実体の組み立て | `EstimateApplication.create` | domain/entities | 探索ロジック |

> ②と③はどちらも「役職段階」を扱うが役割が違う。②は「役職の階層構造から段階を*定義*する（静的な辞書化）」、③は「その段階を使って*探索する*（動的なルート決定）」。②が無ければ③は `positionTier` を埋められず、③は②の結果を消費する側になる。

## 未接続のピース（現状）

②の出力（段階の辞書）・①の goalTier・組織からの役割グラフを一つにまとめて③へ渡す「アプリ層の申請ユースケース（組織スナップショット組立て）」は、本書時点で**別 issue として未実装**。

- issue #408 のスコープは②（純関数 resolver）まで。①③④⑤は既存（#386）。
- リポジトリの Prisma 実装は #407（インフラ層）。
- この**組立て役**が実装されると「金額 → 段階 → 役職 → チェーン → ステップ」が端から端まで繋がる。

## 関連

- ADR-0062（承認段階の返却と役職解決の分離）
- ADR-0063（役職の承認段階は階層深さで算出し、4段不変条件を申請時に fail-fast で守る）
- ADR-0002/0003（常に上位承認を求める）/ ADR-0027/0036（集約境界・ファクトリ）
- ADR-0030/0052（越境データの引数渡し）/ ADR-0025（ドメイン純関数）/ ADR-0055（税込でゴール判定）
- CONTEXT.md「承認段階（Approval Goal Tier）」「最終承認役職（Final Approval Position）」
- `docs/business/estimate/システム設計書(申請).md`（業務視点の正）
