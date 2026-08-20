# 可変statusカラムを終端イベント表に分解し、状態を行の存在で導出する

作成日: 2026-06-18

## 概要

見積申請の承認ステップ（`EstimateApprovalStep`）の設計をグリル中、「予定」と「結果」を1行に同居させた可変・nullable構造への違和感から、構造をごっそり組み替えた。当初設計は次のように1テーブルに状態を持たせていた。

```prisma
model EstimateApprovalStep {
  id, applicationId, stepOrder, roleId
  approverEmployeeId String?   // 承認/差戻するまで NULL
  status   ApprovalStepStatus  // NOT_STARTED→AWAITING→APPROVED/REJECTED と上書き
  decidedAt DateTime?          // 決定するまで NULL
  comment  String @default("") // 差戻理由。承認時は空のまま
}
```

これを「不変の骨格テーブル」＋「終端イベント表」に分解し、**状態（status）を行の存在から導出**する形に変更した。きっかけは #375（見積申請のPrismaスキーマ）。

## 詳細

### 違和感のシグナル: nullable ＝「予定を後で結果で塗る」可変行

`approverEmployeeId`・`decidedAt` が nullable なのは、1行に**寿命の違う2つの関心**を同居させているから。

- **予定（骨格）**: 申請時に確定し以後不変（どの順序でどの役割が承認するか）
- **結果（イベント）**: 後から発生（誰がいつ承認/差戻したか、差戻理由）

「作成時は予定だけ埋め、後で結果で上書きする」から、行が可変になり結果側カラムが nullable になる。**nullable＋可変statusは、予定と結果が同居しているサイン**。

### 分解後の構造

```prisma
model EstimateApprovalStep {        // 骨格・完全不変（nullableゼロ）
  id, applicationId, stepOrder, roleId
  @@unique([applicationId, stepOrder])
  @@index([roleId])
}

model EstimateStepApproval {        // 承認イベント（行の存在＝承認済）
  stepId @id                        // 1ステップ1承認 → 自然キー（ADR-0041と同型）
  approverEmployeeId                // NOT NULL（承認者）
  // 承認日時 = createdAt に集約
}

model EstimateStepRejection {       // 差戻イベント（行の存在＝差戻）
  stepId @id
  rejectedByEmployeeId              // NOT NULL（差戻者）
  comment VarChar(2000)            // NOT NULL・defaultなし＝差戻理由を必須化
  // 差戻日時 = createdAt に集約
}

model EstimateApplicationWithdrawal { // 取下イベント（行の存在＝取下）
  applicationId @id
  withdrawnByEmployeeId             // NOT NULL
  // 取下日時 = createdAt に集約
}
```

### 状態は全て「行の存在＋順序」から導出（status カラム・enum を廃止）

ステップ状態:
```
差戻行あり → REJECTED ／ 承認行あり → APPROVED
決定行なし＋下位stepOrderが全て承認済＋申請PENDING → AWAITING
決定行なし＋下位に未承認あり → NOT_STARTED
```

申請状態（取下表を足すと完全導出可能）:
```
取下行あり → WITHDRAWN（部分承認済でも取下が最優先）
いずれかのステップに差戻行 → REJECTED
全ステップに承認行 → APPROVED
上記なし → PENDING
```

結果、enum `ApprovalStepStatus` / `ApplicationStatus` を**2つとも廃止**。nullable・可変カラムが消え、`decidedAt` もイベント行の `createdAt` に集約して廃止。`comment` は意味を持つ差戻表にだけ必須カラムとして配置（承認に理由欄は不要）。

### これはこのリポジトリの確立パターン

「状態を保存カラムで持たず、行の存在で導出する」は既存の流儀そのもの。
- `Order` ＋ `OrderConfirmation`／`OrderCancellation`（受注の確定/取消を行の存在で導出。statusカラムを持たない）
- ADR-0054 承認免除（免除を専用表の行の存在で表現）
- 見積表示ステータスの §1.3 導出ルール

承認ステップだけ可変enumで状態を持つのは一貫していなかった。分解はこれをOrderパターンに揃えるもの。

### 受け入れた代償（タダではない）

1. **単一テーブルに張れるDB不変条件を手放す**: status保存カラムが消えるため、`(estimate_id) WHERE status IN ('PENDING','APPROVED')` のような部分ユニークが張れない。「1見積につき前進バリエーションは1つ」のDBバックストップは諦め、**アプリ層（見積アグリゲートの楽観ロック）に一元化**した。これに伴い冗長 `estimate_id` 列・複合FK整合ガードも不要になり消滅（スキーマはむしろ単純化）。
2. **Inboxクエリが反結合になる**: `status='AWAITING'` で引けず、「承認行も差戻行も無く下位が全て承認済のステップ」をNOT EXISTSで引く。承認待ち集合の部分インデックスは張れない（→ `index-partial-vs-composite-selectivity.md` の実例はこの決定で覆った）。
3. **終端イベントの跨ぎレースを別表のuniqueで防げない**: 同一ステップへ「承認」と「差戻」を同時実行すると別表に各1行入り矛盾しうる。同一ステップ二重承認は `stepId @unique` で防げるが、跨ぎは防げない。ここは `EstimateApplication.version`（ADR-0039のルート楽観ロック）でアグリゲート全体の変更を直列化して締める。version の意義は「申請行自体が更新される」から「**ルートが子イベント挿入を含むアグリゲート変更を直列化する**」に変わる。

## 教訓

- **nullable＋可変statusは「予定」と「結果」が1行に同居しているサイン**。分解して結果を終端イベント表に出し、状態は行の存在で導出する。
- 「行の存在で状態を導出」はこのリポジトリの流儀（Order系・ADR-0054）。新しい状態モデルもこれに揃える。
- ただしタダではない: **単一テーブルに張れるDB不変条件（部分ユニーク等）を失う**。失う保証は妥当か、アプリ層（アグリゲート楽観ロック）で代替できるかを天秤にかける。今回は nullable 除去の一貫性を優先し、横断不変条件はアプリ層へ移した。
- 状態を複数の終端イベント表に割ると、**跨ぎの矛盾レース**が生まれる。同一行の二重化は unique で防げるが、跨ぎはアグリゲートルートの version（楽観ロック）で直列化して防ぐ。
- 「決定日時」のような業務日時は、イベント表に分解すると**そのイベント行の createdAt に一致**するので独立カラムが不要になる（業務日時のcreatedAt集約。Order系と同方針）。

## 参考

- `docs/business/estimate/システム設計書(申請).md` §3（データモデル）, §7（承認・差戻・取下フロー）
- ADR-0054（承認免除を専用テーブルで表現＝行の存在で状態導出）
- ADR-0039（アグリゲートルートの version による横断的楽観ロック）
- ADR-0041（1:1サテライトの自然キー化）
- `prisma/schema.prisma`（`Order`/`OrderConfirmation`/`OrderCancellation` の導出パターン、業務日時のcreatedAt集約）
- `learning/index-partial-vs-composite-selectivity.md`（この決定でAWAITING部分インデックスの前提が覆った）
- issue #375
