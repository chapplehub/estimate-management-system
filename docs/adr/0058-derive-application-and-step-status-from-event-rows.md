# ADR-0058: 見積申請・承認ステップの状態を行の存在で導出し、単一テーブルのDBバックストップを手放す

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-18 |
| 最終更新日 | 2026-06-18 |

## コンテキスト

issue #375（見積申請のPrismaスキーマ）で、`システム設計書(申請).md` §3 のデータモデルを実装に落とす段でレビューした。当初設計は次の構造だった。

- `EstimateApplication` … `status`（PENDING/APPROVED/REJECTED/WITHDRAWN）を保存カラムで持つ。承認・差戻・取下で書き換わる可変ルート。
- `ApprovalStep` … `status`（NOT_STARTED/AWAITING/APPROVED/REJECTED）を保存カラムで持ち、承認/差戻するまで `approverEmployeeId`・`decidedAt` は **nullable**。`comment` は全ステップに `default ""` で付与。
- 「1見積につき前進バリエーションは1つ」を担保するため、申請に冗長 `estimate_id` を持たせ、`(estimate_id) WHERE status='PENDING'` の **部分ユニークインデックス（DBバックストップ）** を張る。

レビューで2つの問題が浮かんだ。

1. **`ApprovalStep` が「予定」と「結果」を1行に同居させている。** 申請時に確定する骨格（順序・対象役割）と、後から発生する結果（誰がいつ承認/差戻したか・差戻理由）が同じ行にあるため、行が可変になり結果側カラムが nullable 化する。これは本リポジトリの「状態を保存カラムで持たず行の存在で導出する」流儀（`Order`＋`OrderConfirmation`/`OrderCancellation`、ADR-0054 承認免除）と逆行し、NULL徹底排除方針（ADR-0034）にも反する。

2. **DBバックストップが半端である。** 真の業務不変条件は「1見積につき**申請中＋承認済＋免除**のバリエーションは1つ」で、3状態×2テーブル（申請・免除）にまたがる。単一テーブルの部分ユニークでは横断5パターン中1つ（同時PENDING同士）しか塞げず、残り（PENDING＋免除、承認済＋任意、免除＋免除など）は最初からアプリ層依存だった。さらに業務はこの制約を「他のバリエーションを取り下げてください」というユーザー向けエラーで運用しており、本質的にアプリ層の関心である。

「状態をどこまで導出に倒すか」と「導出に倒すと保存カラム前提のDBバックストップが張れなくなる」がトレードオフとして衝突したため、方針を確定する必要がある。

## 検討した選択肢

### A. 状態を保存カラムで持ち、部分ユニークでDBバックストップを張る（当初設計・不採用）

`status` を保存し、`(estimate_id) WHERE status IN (...)` でDB側に「1見積1前進」を一部強制する。DBで一部の同時実行レースを原子的に防げる反面、`ApprovalStep` の nullable・可変が残り、冗長 `estimate_id` とその整合を守る複合FKが必要になり、しかもバックストップは5穴中1穴しか塞がない。

### B. ステップ状態のみ導出・申請 status は保存してバックストップ維持（ハイブリッド・不採用）

`ApprovalStep` は骨格＋承認/差戻イベント表に分解して導出するが、`EstimateApplication.status` は保存して部分ユニークを残す。ステップの nullable は消えるが、「ステップは導出・申請は保存」という非対称が残り、冗長 `estimate_id`＋複合FK整合ガードも残る。バックストップの半端さ（横断1穴のみ）は解消しない。

### C. 申請・ステップとも状態を終端イベント表の行の存在から完全導出し、DBバックストップは手放してアプリ層に一元化する（採用）

承認・差戻・取下を専用の終端イベント表とし、申請・ステップの状態をすべて行の存在＋順序から導出する。`status` 保存カラム（enum 2種）を廃止。これにより部分ユニークの前提が消えるので、横断不変条件「1見積1前進」は**アプリ層（見積アグリゲートの楽観ロック）に一元化**する。冗長 `estimate_id`・複合FK整合ガードは不要になり消える。

```prisma
model EstimateApprovalStep {        // 骨格・完全不変（nullableゼロ）
  id, applicationId, stepOrder, roleId
  @@unique([applicationId, stepOrder])
}
model EstimateStepApproval {        // 行の存在＝承認済
  stepId @id                        // 1ステップ1承認（自然キー・ADR-0041）
  approverEmployeeId                // NOT NULL
}
model EstimateStepRejection {       // 行の存在＝差戻
  stepId @id
  rejectedByEmployeeId              // NOT NULL
  comment VarChar(2000)            // NOT NULL・defaultなし＝差戻理由を必須化
}
model EstimateApplicationWithdrawal { // 行の存在＝取下
  applicationId @id
  withdrawnByEmployeeId             // NOT NULL
}
```

状態導出:
```
# ステップ
差戻行あり→REJECTED / 承認行あり→APPROVED
決定行なし＋下位stepOrder全て承認済＋申請PENDING→AWAITING / それ以外→NOT_STARTED
# 申請
取下行あり→WITHDRAWN / いずれかのステップに差戻行→REJECTED
全ステップに承認行→APPROVED / 上記なし→PENDING
```

## 決定

**C を採用する。** 承認・差戻・取下を終端イベント表（`EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal`）として持ち、申請・承認ステップの状態を行の存在から導出する。enum `ApplicationStatus` / `ApprovalStepStatus`（命名は `EstimateApplicationStatus` / `EstimateApprovalStepStatus`）は廃止する。「1見積につき前進バリエーションは1つ」のDB強制は**手放し**、見積アグリゲートの楽観ロック（ADR-0039）でアプリ層に一元化する。冗長 `estimate_id`・部分ユニーク・複合FK整合ガードは設けない。

## 根拠

- **NULL徹底排除・既存流儀との一貫**: ステップから nullable（`approverEmployeeId`・`decidedAt`）・可変 `status` が消える。`Order`系・ADR-0054 と同じ「行の存在で状態を導出」に揃う。`decidedAt` はイベント行の `createdAt` に集約でき独立カラム不要（業務日時のcreatedAt集約・Order系と同方針）。`comment` は意味を持つ差戻表にだけ必須カラムとして置ける。
- **概念を正直にモデル化**: 「承認」「差戻」「取下」は別個の終端イベントであり、可変statusの上書きより専用行の存在で表す方が正直（ADR-0054 と同じ論法を申請本体まで拡張）。
- **半端なバックストップを捨て、一貫した線引きにする**: 横断不変条件はもともと5穴中1穴しかDBで塞げず、残りはアプリ層依存だった。1穴だけDBに残すより、横断不変条件は全てアプリ層（見積アグリゲートのロック）に寄せる方が一貫する。これに伴い冗長 `estimate_id` と複合FK整合ガードが消え、スキーマはむしろ単純化する。
- **跨ぎレースはルートの version で締める**: 状態を複数の終端イベント表に割ると「同一ステップへ承認と差戻を同時」「最終承認と取下を同時」といった跨ぎの矛盾レースが生じる。同一行二重化は `stepId @unique` で防げるが跨ぎは防げないため、`EstimateApplication.version`（ADR-0039 のルート楽観ロック）でアグリゲート全体の変更を直列化する。version の意義は「申請行が更新される」から「ルートが子イベント挿入を含むアグリゲート変更を直列化する」に変わる。

不採用理由:
- **A**: nullable・可変・冗長 `estimate_id`・複合FKを抱えたまま、バックストップは半端。
- **B**: ステップの nullable は消えるが、申請保存・ステップ導出の非対称と冗長 `estimate_id`＋複合FKが残り、バックストップの半端さも解消しない。

## 影響

- enum `ApplicationStatus` / `ApprovalStepStatus` を廃止。残る enum は `EstimateExemptionReason` のみ。
- テーブルが増える（`EstimateStepApproval` / `EstimateStepRejection` / `EstimateApplicationWithdrawal`）。`Order`系（Order＋確定＋取消）と同型の増え方で、関心の分離として正当化される。
- 申請の冗長 `estimate_id` 列・部分ユニークインデックス・`EstimateVariation` の `@@unique([id, estimateId])`・複合FKは**いずれも不要**になり設けない。免除も `variation_id @unique` のみに戻る。
- 「1見積1前進バリエーション」はアプリ層の不変条件になる。`SubmitApplication`／免除確定コマンドは見積アグリゲートを版管理付きで読み書きし、同一見積への同時操作を version で直列化する（実装はドメイン層 issue）。
- 承認 Inbox（AQ3）は `status='AWAITING'` で引けず、「承認行も差戻行も無く下位が全て承認済のステップ」を反結合（NOT EXISTS）で引く。承認待ち集合の部分インデックスは張れない。
- 状態導出は「申請テーブル」「ステップ」「3種のイベント表」「免除テーブル」を参照する読み取りモデルの関心になる（見積側 §1.3 と整合）。
- 価格申請が将来追加された際、承認進行ロジックを `shared` へ抽出する方針（ADR-0053）は変わらない。導出の考え方も共通化対象になる。
