# ADR-0062: 承認要否ポリシーは抽象ゴール段階を返し、具体役職はチェーンビルダーが組織スナップショットで解決する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-19 |
| 最終更新日 | 2026-06-19 |

## コンテキスト

issue #386 で見積申請・承認の **ドメイン層** を設計する段。承認要否判定 `ApprovalRequirementPolicy`（§4）と承認チェーン構築 `ApprovalChainBuilder`（§5）の入出力境界を確定する必要がある（`システム設計書(申請).md`）。

論点が衝突する。

1. **金額閾値は業務ルールでドメインが所有すべき。** 「10 万円以上＝課長／100 万円以上＝部長／1000 万円以上＝本部長／3000 万円以上＝社長」（税込 finalTotal・ADR-0055）は見積承認の業務ルールで、ポリシー（ADR-0023）に閉じるべき。
2. **役職の identity は組織マスタが所有する。** 「どの `Position` が課長か」は employee / role / position サブドメインが所有する事実で、estimate ドメインの持ち物ではない。`Position` は `superiorPositionId` の連結リストで明示的な level 列を持たない。
3. **永続化値は具体役職。** `EstimateApplication.finalApprovalPositionId`（ADR-0055・schema）は具体 `PositionId`。

ポリシーが具体 `PositionId` を返そうとすると、(a) 段階→`PositionId` 対応（組織マスタ）をポリシー入力に混ぜてポリシーが組織 identity を知るか、(b) 金額閾値を外部テーブルに出してドメインから業務ルールを漏らすかの、どちらかを強いられる。

なお本リポジトリは、集約を越える対象属性・組織グラフを **メソッド引数で渡し**、ドメインにリポジトリポートを持たせない流儀（ADR-0030 / ADR-0052）を採る。

## 検討した選択肢

### A. ポリシーが具体 `finalApprovalPositionId` を返す（不採用）

渡された役職テーブル（段階→`PositionId`）からポリシーが直接具体役職を選ぶ。出力が即永続化値になる利点はあるが、金額閾値（業務ルール）と段階→`PositionId` 対応（組織マスタ）が同じポリシー入力に同居し、ポリシーが組織 identity を知る。閾値を外部テーブル化すればドメインから業務ルールが漏れる。

### B. ポリシーは抽象ゴール段階を返し、ビルダーが具体役職を解決する（採用）

ポリシーは純関数 `judge(finalTotal, leafCategories, estimateType) → Exempt(reason) | Required(goalTier)` を返す。`goalTier` は estimate ドメインが定義する **抽象的な承認ゴール段階**。金額閾値はポリシー内（ドメイン）に保持する。`ApprovalChainBuilder` が組織スナップショット（役割グラフ・役職段階対応・承認者有無）を引数で受け、申請者の上位役割から `goalTier` の役職に到達するまで辿り、**到達したステップの役割の役職**を `finalApprovalPositionId` として確定する。

### C. ビルダー／ポリシーにリポジトリポートを注入して組織を都度引く（不採用）

ドメインサービスが role / position リポジトリを直接引く。ADR-0030 / ADR-0052（引数渡し・ドメインにポートを持たせない）に反し、純粋単体テストが難しくなる。

## 決定

**B を採用する。** `ApprovalRequirementPolicy` は抽象ゴール段階（`goalTier`）を返し、`Position` の identity を一切知らない。金額閾値はポリシー内（ドメイン）に保持する。`ApprovalChainBuilder` が組織スナップショットを引数で受け、具体 `finalApprovalPositionId` を **到達役職** として解決する。

## 根拠

- **正しい帰属**: 業務ルール（金額→段階）はドメインのポリシーに、組織 identity（段階→具体役職）は組織サブドメイン由来のスナップショットに、それぞれ帰属する。
- **テスト容易性**: ポリシーが `Position` identity から独立するため、純関数として金額境界（10 万/100 万/1000 万/3000 万）・消耗品のみ・事後見積のみで網羅テストできる。
- **既存流儀との整合**: 組織グラフは引数渡し、ドメインにポートを持たせない（ADR-0030 / ADR-0052）。
- **永続化値は一意に決まる**: 「上位役割に指定できるのは役職の上位役職に属する役割のみ」という不変条件（`business-definition.md`・§5.1）により、役割を1段上がると役職もちょうど1段上がりゴールを飛び越さない。よってポリシーが具体役職を返さなくても、ビルダーが辿り着いた役職として `finalApprovalPositionId` が一意に確定する。

不採用理由:

- **A**: 業務ルールと組織 identity が混ざり、ポリシーが組織を知るか業務ルールが外部に漏れる。
- **C**: ADR-0030 / ADR-0052 に反し、純粋単体テストを損なう。

## 影響

- `ApprovalRequirementPolicy` の出力型は `Exempt(EstimateExemptionReason) | Required(goalTier)`。`goalTier` は estimate ドメインの抽象段階値。
- `ApprovalChainBuilder` の入力は組織スナップショット（`applicantSuperiorRoleId` / 役割グラフ / 役職段階対応 / `roleHasApprover`）。戻り値は VO 計画 `ApprovalChainPlan`（`goalPositionId` ＋ 順序付き `roleId` 列）で、子エンティティ型を露出しない（ADR-0036 / ADR-0027）。
- アプリ層（別 issue）が組織サブドメインからスナップショットを組み立ててビルダーへ渡す。本 issue のドメイン層はリポジトリポートを持たない。
- 関連: ADR-0055（ゴール税込金額）/ ADR-0002（事前生成）/ ADR-0003（常に上位承認）/ ADR-0030・ADR-0052（引数渡し）/ ADR-0023（ポリシー）/ ADR-0036・ADR-0027（集約境界・ファクトリ）。
