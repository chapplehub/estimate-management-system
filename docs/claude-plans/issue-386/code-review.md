# コードレビュー結果: 見積申請・承認のドメイン層（PR #401 / issue-386）

/ レビュー実施日: 2026-06-20
/ 対象: `git diff develop...HEAD`（41ファイル・+2730行、全て新規追加のドメイン層）
/ 観点: xhigh effort（recall 重視）— 10検出アングル + ギャップスイープ + 検証

## サマリ

- `tsc --noEmit` / `vitest`(493 pass) / `eslint` はクリーン。CLAUDE.md の DDD レイヤリング規約違反・外部ライブラリ/Prisma 混入はなし。
- 指摘 **15件**（正確性・設計 8 / クリーンアップ 7）。
- 最重要は **#1（`steps` 経由の集約境界漏れ）** と **#2〜#5（`reconstruct` の構造的不変条件の素通し）**。
- 検証で **棄却した候補**（意図通り・誤検出）は末尾に記録。

---

## 正確性・設計（最優先）

### 1. `steps` ゲッターが可変な子エンティティ実体を露出し、承認順序ガードを迂回できる
- 箇所: `src/server/subdomains/estimate/domain/entities/EstimateApplication.ts:127`
- 内容: 配列は `[...this._steps]` でコピーするが**要素は内部と同一の `EstimateApprovalStep` インスタンス**。`recordApproval`/`recordRejection` は public で、TS の `Readonly<T>` はメソッド呼び出しを封じない。
- 発火: 集約外コードが `app.steps[0].recordApproval(StepApproval.create(...))` を直接呼ぶと、`assertStepAwaiting`（§3.6 順序ガード）を完全にバイパスし「1段目未承認のまま2段目を承認」「PENDING でない申請を差戻」等が成立する。集約境界（ADR-0027）の実害ある漏れ。
- 対応案: `recordApproval`/`recordRejection` を集約内部限定にするか、`steps` を読み取り専用スナップショット/DTO に射影して返す。

### 2. `reconstruct` が空ステップを検証せず、`every()` で空配列 → APPROVED に倒れる
- 箇所: `EstimateApplication.ts:82`（復元）/ `:157`（`every`）
- 内容: `create` は `steps.length===0` をガードするが `reconstruct` は無検証。`applicationStatus` は `this._steps.every((s)=>s.isApproved())` で判定し、**空配列に対し `every` は `true`** を返す。
- 発火: ステップ0件の壊れた行集合から復元すると「承認していない申請が導出上 APPROVED」になる。クラス JSDoc が「承認ステップを1件以上」を構造的不変条件（§12・ADR-0029）と宣言しているのに復元経路だけ素通し。
- 対応案: `reconstruct` でも `steps.length >= 1` を検証。

### 3. `reconstruct` が `stepOrder` の連番・一意を検証せず、`stepStatus` の前進判定が破綻
- 箇所: `EstimateApplication.ts:82` / `:181-184`
- 内容: AWAITING 判定 `_steps.filter(o => o.stepOrder < step.stepOrder).every(isApproved)` は stepOrder の厳密な連番・一意を暗黙前提にする。`create` は `index+1` で連番を保証するが `reconstruct` は無検証。
- 発火: 重複（例 `[1,1,2]`）/欠番のステップで復元すると、同順位ステップが下位扱いから漏れ、未承認の同順位があっても AWAITING を返し**二重承認を許す**。
- 対応案: 復元時に stepOrder の連番性を検証。

### 4. `EstimateApprovalStep.reconstruct` が承認/差戻の相互排他を迂回し、両方 non-null を復元できる
- 箇所: `src/server/subdomains/estimate/domain/entities/EstimateApprovalStep.ts:44`
- 内容: `create` 経路は `recordApproval`/`recordRejection` の `isDecided()` ガードで「1ステップ1決定」を強制するが、`reconstruct` はそれを迂回。
- 発火: 承認行と差戻行を同時に持つ破損データがそのまま通り、`isApproved()` も `isRejected()` も true の矛盾ステップが成立する。
- 対応案: 復元時に `approval` と `rejection` の同時 non-null を拒否。

### 5. `reconstruct` が `input.steps` 配列を防御コピーせず内部に取り込む（インバウンド共有）
- 箇所: `EstimateApplication.ts:91-99`
- 内容: `create` は `.map` で新規配列を作るが、`reconstruct` は `input.steps` をそのまま `_steps` に保持する。
- 発火: リポジトリ実装が同じ配列参照を握ったまま後で `push`/`sort` すると集約内部が外部から書き換わる。#1 はアウトバウンド（ゲッター）、本件は構築時のインバウンド漏れで別経路。
- 対応案: `[...input.steps]` で取り込む。

### 6. `isAtLeastYen` が非JPYで例外を投げ、JSDoc の「通貨は finalTotal に合わせる」と矛盾
- 箇所: `src/server/subdomains/estimate/domain/policies/ApprovalRequirementPolicy.ts:86-87`
- 内容: `amount.subtract(Money.fromMajorUnits(thresholdYen))` の閾値は**常に既定 JPY** で生成される。`finalTotal` が非JPY だと `Money.subtract` の `assertSameCurrency` で `InvalidArgumentError`。
- 発火: 現状 JPY 前提だが、コメントは「finalTotal に合わせる」と書いており実装と乖離。多通貨拡張時にサイレントに壊れる。
- 対応案: コメント修正＋（将来）通貨非依存の比較に。

### 7. イベントVOが Date を内外で防御コピーしない
- 箇所: `src/server/subdomains/estimate/domain/values/StepApproval.ts:19,29`（`StepRejection`/`ApplicationWithdrawal` も同型）
- 内容: `create(actor, occurredAt)` が `occurredAt` をそのまま保持し、`get occurredAt` も内部参照をそのまま返す。
- 発火: 呼び出し側が同じ `Date` を後から `setHours` 等で変異させると、不変イベントVOの発生日時と `equals`（`getTime` 比較）が事後に変わる。既存 `Estimate` も raw Date を返す慣習だが、新規の不変イベントVOでは `new Date(d.getTime())` でのコピーが望ましい（低）。

### 8. `ApprovalChainBuilder` が「役割1段=役職1段」不変条件を無防備に信頼し、段階スキップを検出しない
- 箇所: `src/server/subdomains/estimate/domain/services/ApprovalChainBuilder.ts:97`
- 内容: ADR-0062 は `finalApprovalPositionId` の一意性をこの入力不変条件に全面依存するが、break 条件は `isAtLeast` のみ。
- 発火: 組織データが不変条件に反し役職段階を飛び越す（課長→本部長で部長を飛ばす）と、goalTier=部長でも本部長で break し、ゴールを黙って飛び越した positionId を確定。唯一の検証チョークポイントなのに防御がない（低・altitude）。
- 補足: 「起点役職がゴール以上のとき1段で finalApproval が起点役職になる」挙動は **バグではなく ADR-0003+ADR-0062 の意図通り**（goalTier は下限）と確認済み。

---

## クリーンアップ（正確性の後）

### 9. `create` の `steps.length===0` バックストップは到達不能なデッドコード
- 箇所: `EstimateApplication.ts:64`
- 内容: `steps` は `plan.roleIds.map` 由来で、`ApprovalChainPlan.create` が `roleIds.length===0` で必ず例外（`ApprovalChainPlan.ts:33`）。plan がある時点で `roleIds >= 1` が保証され、この if は構造上 true にならない（コメント自身が「通常到達しない」と認める）。
- 対応案: 削除し、不変条件は `ApprovalChainPlan` に一本化。

### 10. `Money` に大小比較がなく、`isAtLeastYen` が `subtract().isNegative()` で再実装
- 箇所: `ApprovalRequirementPolicy.ts:86`
- 内容: コメントも「Money に大小比較がないため」と明記。比較イディオムがポリシー側に溜まり、境界（`>=`/`>`）や通貨整合の解釈が各所でばらつく。
- 対応案: `Money.isAtLeast(other)` / `compareTo` を追加して呼ぶ。

### 11. `approve`/`reject` が `_steps` を多重走査する
- 箇所: `EstimateApplication.ts:196,211,181`
- 内容: `findStep` で step を得た直後 `assertStepAwaiting → stepStatus → findStep` で同一ステップを再探索し、さらに `stepStatus` が `applicationStatus`（`some`+`every`）と `filter().every()`（中間配列確保）を呼ぶ。1操作で `_steps` を約5〜6周。
- 対応案: 解決済み step を引き回し、AWAITING 判定は `_steps.every(o => o.stepOrder >= step.stepOrder || o.isApproved())` の無割り当て1パスに畳む（ドメイン層でステップ数少のため影響軽微）。

### 12. 列挙型VOのボイラープレート重複（`EnumValueObject` 基底不在）
- 箇所: `src/server/subdomains/estimate/domain/values/ApprovalGoalTier.ts:69` ほか4VO
- 内容: `VALID_VALUES`＋`LABEL_MAP`＋`from()` の手書き switch＋`validate()` の includes が4新規VO（および既存10件超）で同型コピー。`from` の switch と `validate` で有効値を二重定義し、値追加時に片方を忘れても実行時まで露見しない。
- 対応案: 本PR固有というより基盤不在の表面化。別 issue での `EnumValueObject` 基底抽出が妥当（低）。

### 13. `ApprovalChainBuilder` テストが循環検出・自己ループ・スナップショット欠落（`InvalidArgumentError`）を未カバー
- 箇所: `src/server/subdomains/estimate/domain/services/__tests__/ApprovalChainBuilder.test.ts`
- 内容: 本体は `visited` による循環検出と `lookup` 欠落時の `InvalidArgumentError` を実装するが、テストは `BusinessRuleViolationError` 系3ケースのみ。
- 対応案: 循環（A→B→A・自己ループ）と役割欠落のテストを追加。

### 14. `RANK_MAP` は `VALID_VALUES` の index から導出可能な二重管理
- 箇所: `ApprovalGoalTier.ts:20`
- 内容: `RANK_MAP` の 1..4 は `VALID_VALUES` の添字+1 と必ず一致する派生値。段階挿入時に手で振り直す必要があり、配列順と rank が食い違っても気づかない。
- 対応案: `rank = VALID_VALUES.indexOf(value) + 1` で算出し `RANK_MAP` を削除。

### 15. 導出VO（`ApplicationStatus`/`ApprovalStepStatus`）の `from()` は投機的API
- 箇所: `src/server/subdomains/estimate/domain/values/ApplicationStatus.ts:53` / `ApprovalStepStatus.ts:53`
- 内容: 両VOの JSDoc 自身が「保存しない/Prisma に enum 列なし/導出計算のメモリ値」と明言するのに、永続化復元用 `from(string)` を実装。状態は導出ロジックが4シングルトンを返すのみで文字列再パース経路が無い。
- 対応案: 必要時に追加とし現状は削除（低）。

---

## 検証で棄却した候補（参考）

- **「finalApprovalPositionId がゴールを上回る（起点 ≧ ゴール時）」** → ADR-0062 行46 + テスト（`ApprovalChainBuilder.test.ts:40`）より**意図通り**。goalTier は下限で、ADR-0003 により直属上位が必ず最低1段。
- **「不変性テストが退行を検出しない」** → 実際は検出できる（実体を返せば pop で内部が変わり失敗）。テストは妥当。
- **`new Date()` の非決定性** → 全兄弟エンティティ共通の house convention で逸脱なし。
- **`RejectionComment` の trim/MAX_LENGTH 境界** → trim 後に長さ判定で正しい。
- **クロスファイル整合・CLAUDE.md 規約** → 違反なし（tsc/vitest/eslint 全 pass、外部ライブラリ・Prisma 混入なし）。
