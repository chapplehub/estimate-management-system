# 見積申請・承認ドメイン層 クリーンアップ実装計画（PR #401 / issue-386）

/ 起票日: 2026-06-20
/ 出典: `docs/claude-plans/issue-386/code-review.md` の有効な指摘のうち、本PR内で完結するもの

## Context

PR #401 のコードレビュー（`code-review.md`）で挙がった有効な指摘のうち、**新規追加した
ドメイン層ファイル内で完結し、他集約・共有VO・基盤に波及しない6件**をまとめて修正する。
サブドメイン横断・基盤導入・設計判断を伴う指摘（#6/#8/#10/#12）は別イシューに分離済み
（末尾参照）。

レビュー指摘の #1〜#5 は ADR-0027 / DDD reconstitution / schema 担保に照らし取り下げ済み
（`code-review.md` 参照）。本計画はそれ以降の有効な指摘のみを対象とする。

## 対象（本PR内で完結する6件）

### A. #9 デッドコード削除（`EstimateApplication.create`）
- 箇所: `src/server/subdomains/estimate/domain/entities/EstimateApplication.ts:64-69`
- 現状: `const steps = input.plan.roleIds.map(...)` の直後に `if (steps.length === 0) throw ...`。
  `ApprovalChainPlan.create` が `roleIds.length===0` で必ず例外（`ApprovalChainPlan.ts:33`）を
  投げるため、plan がある時点で `roleIds >= 1` が保証され、この分岐は構造上到達不能。
- 修正: 行 64-69 の `if` ブロックを削除。`BusinessRuleViolationError` の import は
  `withdraw`(221) / `assertStepAwaiting`(230) / `findStep`(239) で使用中のため**保持**。
- テスト影響: なし（到達不能なので既存テストは緑のまま）。

### B. #14 `RANK_MAP` を `VALID_VALUES` の index 導出に（`ApprovalGoalTier`）
- 箇所: `src/server/subdomains/estimate/domain/values/ApprovalGoalTier.ts`（`RANK_MAP` 19-25行 / `rank` getter 58-61行）
- 現状: `RANK_MAP` の 1..4 は `VALID_VALUES`（4-9行）の添字+1 と必ず一致する派生値の二重管理。
- 修正: `RANK_MAP` 定数を削除し、`rank` getter を
  `return VALID_VALUES.indexOf(this._value as ApprovalGoalTierValue) + 1;` に変更。
- テスト影響: `__tests__/ApprovalGoalTier.test.ts` の rank/isAtLeast テストが緑のままか確認
  （値は不変なので維持されるはず）。

### C. #7 `isAtLeastYen` の JSDoc を実態に修正（`ApprovalRequirementPolicy`）
- 箇所: `src/server/subdomains/estimate/domain/policies/ApprovalRequirementPolicy.ts:82-84`
- 現状: JSDoc が「通貨は finalTotal に合わせる（既定 JPY）」と記すが、実際は閾値を常に既定 JPY で
  生成するため finalTotal 非JPY では `Money.subtract` の `assertSameCurrency` で例外になる。記述と
  挙動が乖離。
- 修正: コメントを実態（JPY 固定前提・本ドメインは税込 JPY の finalTotal を扱う）に合わせて
  書き換える。挙動変更はしない（多通貨対応は別スコープ）。
- テスト影響: なし（コメントのみ）。

### D. #15 投機的 `from()` の削除（導出VO 2件）
- 箇所: `ApplicationStatus.ts`(`from` 52-68行付近) / `ApprovalStepStatus.ts`(同) の `from(value: string)`
- 現状: 両VOの JSDoc 自身が「保存しない/Prisma に enum 列なし/導出計算のメモリ値」と明言するのに
  永続化復元用 `from()` を実装。**プロダクション参照は0件**（テストのみ）。`validate()` は残るので
  static シングルトン生成時のコンストラクタ検証（`ValueObject` 基底）は維持される。
- 修正: 両VOの `from()` メソッドを削除。`validate()` は残す。
  - 併せてテストを削除: `__tests__/ApplicationStatus.test.ts:24-32` と
    `__tests__/ApprovalStepStatus.test.ts:24-32`（`from()` の正常系/異常系テスト）。
- 判断メモ: 「将来 read model で必要になったら追加」という方針。今は YAGNI で削る。

### E. #13 `ApprovalChainBuilder` のテストカバレッジ追加
- 箇所: `src/server/subdomains/estimate/domain/services/__tests__/ApprovalChainBuilder.test.ts`
- 現状: 本体は `visited` 循環検出（`InvalidArgumentError`「役割グラフに循環があります」92行）と
  `lookup` 欠落（`InvalidArgumentError`「組織スナップショットに役割が含まれていません」78行）を
  実装するが、テストは `BusinessRuleViolationError` 系3ケースのみ。
- 修正: 異常系テストを追加（`buildRoleChain` を加工）:
  1. **自己ループ** `roles[0].superiorRoleId = roles[0].roleId` → `InvalidArgumentError`
  2. **多重循環** `roles[i].superiorRoleId = roles[j].roleId`(j<i) → `InvalidArgumentError`
  3. **スナップショット役割欠落** `applicantSuperiorRoleId` がスナップショットの `roles` に無い
     → `InvalidArgumentError`
- テスト影響: 追加のみ。

### F. #11 `approve`/`reject` の二重 `findStep` 解消（効率・軽微）
- 箇所: `EstimateApplication.ts`（`approve` 195-199 / `reject` 205-213 / `assertStepAwaiting` 228-234 / `stepStatus` 170-185 / `findStep` 236-242）
- 現状: `approve(stepId)` が `findStep` で step を得た直後、`assertStepAwaiting(stepId)` →
  `stepStatus(stepId)` → 再び `findStep(stepId)` で同一ステップを再探索（`_steps` 二重走査）。
- **重要な制約**: `stepStatus(stepId)` は §3.6 の**公開API**で、テストが
  `app.stepStatus(app.steps[0].id)` と stepId で呼ぶ契約。**公開シグネチャは変更しない**。
- 修正方針（公開契約を保ったまま二重探索を解消）:
  - 解決済み step を受ける private ヘルパ `deriveStepStatus(step: EstimateApprovalStep): ApprovalStepStatus` を切り出す。
  - public `stepStatus(stepId)` は `findStep` で解決して `deriveStepStatus(step)` に委譲（1回）。
  - `assertStepAwaiting` を `assertStepAwaiting(step: EstimateApprovalStep)` に変え（private なので変更可）、
    `approve`/`reject` は最初の `findStep` で得た step を渡す。
  - 余力があれば AWAITING 判定の `filter().every()` を
    `_steps.every(o => o.stepOrder >= step.stepOrder || o.isApproved())` の無割り当て1パスに畳む。
- テスト影響: 公開 `stepStatus(stepId)` を維持するため既存テストは緑のまま。挙動不変を確認。
- 優先度: 低（ステップ数少で実害軽微）。A〜E の後に着手し、複雑なら見送り可。

## 実装順序

依存の無い独立した小修正なので、CLAUDE.md の「意味のあるまとまりでコミット」に従い個別にコミット:
A（デッドコード）→ B（RANK_MAP）→ C（JSDoc）→ D（from削除）→ E（テスト追加）→ F（効率・任意）

## 検証

```bash
pnpm test src/server/subdomains/estimate/domain   # 全ドメインテスト緑（現状 493 pass）
pnpm lint                                          # eslint クリーン
pnpm exec tsc --noEmit                             # 型エラー0
```

- D（from削除）後、`ApplicationStatus`/`ApprovalStepStatus` の他テスト（label/述語/各シングルトン）が
  緑のままであること。
- F 後、§3.6 の状態導出テスト（初期 AWAITING、approve 前進、reject/withdraw 後の NOT_STARTED）が
  挙動不変で緑であること。

## 別イシューに分離した指摘（本計画の対象外・起票済み Status: draft）

- **#12** `EnumValueObject` 基底の抽出（サブドメイン横断・既存10件超）→ [#402](https://github.com/chapplehub/estimate-management-system/issues/402)
- **#10** `Money.isAtLeast`/`compareTo` 追加（共有VO ADR-0022 の公開API拡張）→ [#403](https://github.com/chapplehub/estimate-management-system/issues/403)
- **#6** イベントVO の Date 防御コピー（サブドメイン横断の既存慣習）→ [#404](https://github.com/chapplehub/estimate-management-system/issues/404)
- **#8** `ApprovalChainBuilder` の段階スキップ防御（ADR-0062 前提の入力不変条件・設計判断）→ [#405](https://github.com/chapplehub/estimate-management-system/issues/405)
