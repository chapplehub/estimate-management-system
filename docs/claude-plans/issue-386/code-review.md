# コードレビュー結果: 見積申請・承認のドメイン層（PR #401 / issue-386）

/ レビュー実施日: 2026-06-20
/ 補正日: 2026-06-20（#1〜#5 を設計判断との照合で取り下げ）
/ 対象: `git diff develop...HEAD`（41ファイル・+2730行、全て新規追加のドメイン層）
/ 観点: xhigh effort（recall 重視）— 10検出アングル + ギャップスイープ + 検証

## サマリ

- `tsc --noEmit` / `vitest`(493 pass) / `eslint` はクリーン。CLAUDE.md の DDD レイヤリング規約違反・外部ライブラリ/Prisma 混入はなし。
- 初回レビューは指摘 15件（正確性・設計 8 / クリーンアップ 7）を挙げたが、**補正で #1〜#5 を取り下げ**た。いずれも確立した設計判断（ADR-0027・DDD reconstitution・schema 担保）への照合不足による過剰指摘だった。
- **取り下げの教訓**: recall 重視レビューは「`create` と `reconstruct` の検証の非対称」を機械的に「ガード漏れ」と誤判定しやすい。reconstruct の検証スキップは DDD の定石であり欠陥ではない。
- **有効な指摘は実質クリーンアップ系（旧 #9〜#15）**。最優先は #9 デッドコード / #10 Money.isAtLeast / #13 テストカバレッジ。

---

## 取り下げた指摘（レビュー後の検証で「設計通り」と確認・#1〜#5）

> recall 重視で挙げたが、プロジェクトの確立した設計判断と照合した結果、いずれも欠陥ではないと判断した。追跡性のため当初の指摘内容と取り下げ根拠を残す。

### #1【取り下げ】`steps` ゲッターが可変な子エンティティ実体を露出し、承認順序ガードを迂回できる
- 当初の指摘: `app.steps[0].recordApproval(...)` が `Readonly<EstimateApprovalStep>` 経由で型上呼べてしまい、`assertStepAwaiting`（§3.6 順序ガード）をバイパスできる。
- **取り下げ根拠（ADR-0027）**: 本件は ADR-0027「集約境界をバレル + ESLint で構造的に強制する」が**既知のトレードオフとして明示的に決着済み**。
  - ADR-0027 は「`Readonly<T>` はメソッド呼び出しを止めない」ことを明記したうえで、**型で完全に封じる選択肢 C（読み取り専用 View 型）を「`as` で剥がせる・二重管理・コード増」として不採用**にしている。
  - 採用は**選択肢 D（バレル非公開 + ESLint import 禁止）+ 補助的に `ReadonlyArray<Readonly<T>>`**。EstimateApplication は `entities/index.ts` 非公開 + `eslint.config.mjs:69` の import 禁止 + 戻り型注釈で**この3点セットに完全準拠**している。
  - import 経路を断つことで「子クラスを変数保持しづらく、mutator への到達ハードルを上げる」のが ADR の到達点であり、`recordApproval` が理論上書ける残存リスクは**承知のうえで受容**されている（ADR-0027「影響」§）。
  - 当初の対応案「読み取り専用 View 型」は ADR-0027 が却下した選択肢 C そのもので、プロジェクトの設計判断と逆行していた。
- 結論: **追加対応不要**。さらに塞ぐには ADR-0027 の再検討（全集約に波及）が必要で本 PR の範囲外。

### #2【取り下げ】`reconstruct` が空ステップを検証せず `every()` で空配列 → APPROVED に倒れる
- 当初の指摘: `reconstruct` がステップ0件を受理すると `_steps.every(isApproved)` が `true` を返し、承認していない申請が導出上 APPROVED になる。
- **取り下げ根拠（DDD reconstitution + schema 担保）**:
  - `reconstruct` が受け取るのは「過去に `create` を通過し検証済みの正当な永続化データ」であり、不変条件の再検証をスキップするのは DDD の定石（信頼境界の内側）。
  - 計画書 line 93 は構造的不変条件（最低1ステップ・連番・goalPositionId NOT NULL）を **`create` に紐付けて記述**し、`reconstruct` は復元専用として並記する設計意図。
  - 「申請は最低1ステップ」は最終的にスキーマの FK 存在制約・行の存在で担保される（プロジェクト方針「PostgreSQL ネイティブ機能優先・CHECK 制約」）。reconstruct での再検証は冗長で、制約進化時に正当データの読み込みを落とすリスクすらある。
- 結論: **設計通り。追加対応不要**。

### #3【取り下げ】`reconstruct` が `stepOrder` の連番・一意を検証しない
- 当初の指摘: 重複/欠番 stepOrder で復元すると `stepStatus` の AWAITING 判定が破綻し二重承認を許す。
- **取り下げ根拠**: #2 と同根。stepOrder の連番・一意は schema の `CHECK (step_order >= 1)` + `@@unique(applicationId, stepOrder)` で物理的に担保する設計。reconstruct はそれを通過したデータのみ受けるため再検証は不要。`create` は `index+1` で連番を保証済み。
- 結論: **設計通り。追加対応不要**。

### #4【取り下げ】`EstimateApprovalStep.reconstruct` が承認/差戻の相互排他を検証しない
- 当初の指摘: 承認行と差戻行を同時に持つ破損データを `reconstruct` が受理し、`isApproved()` と `isRejected()` が両 true になる。
- **取り下げ根拠**: #2 と同根。「1ステップ1決定」は `create` 経路の `isDecided()` ガード + 永続化スキーマ（承認/差戻の排他制約）で担保される。reconstruct は検証済みデータの復元口であり、相互排他の再検証は reconstitution パターンの責務外。
- 結論: **設計通り。追加対応不要**。

### #5【取り下げ】`reconstruct` が `input.steps` 配列を防御コピーしない（インバウンド共有）
- 当初の指摘: `reconstruct` が `input.steps` をそのまま `_steps` に保持するため、呼び出し側が同じ配列参照を後で変更すると集約内部が書き換わる。
- **取り下げ根拠**: `reconstruct` の唯一の呼び出し元は Mapper（ADR-0031 で限定された reconstitution 専用経路）であり、`new EstimateApprovalStep[]` を構築して即座に渡し以後参照を保持しない、信頼された infrastructure コード。汎用入力ではないため防御コピーは過剰防衛。ADR-0027 の「集約内の生産性を犠牲にしない」思想とも整合する。
- 結論: **設計通り。追加対応不要**（厳密化したいなら低優先のスタイル改善に留まる）。

---

## 有効な指摘

> 構造的な設計判断には抵触せず、実装の品質改善として有効なもの。

### #6 イベントVOが Date を内外で防御コピーしない（低）
- 箇所: `src/server/subdomains/estimate/domain/values/StepApproval.ts:19,29`（`StepRejection`/`ApplicationWithdrawal` も同型）
- 内容: `create(actor, occurredAt)` が `occurredAt` をそのまま保持し、`get occurredAt` も内部参照を返す。呼び出し側が同じ `Date` を後から変異させると不変イベントVOの発生日時と `equals`（`getTime` 比較）が事後に変わる。
- 補足: 既存 `Estimate` も raw Date を返す慣習。新規の不変イベントVOでは `new Date(d.getTime())` でのコピーが望ましいが、サブドメイン横断の既存課題でもあり優先度は低い。

### #7 `isAtLeastYen` が非JPYで例外を投げ、JSDoc と挙動が乖離（低）
- 箇所: `src/server/subdomains/estimate/domain/policies/ApprovalRequirementPolicy.ts:86-87`
- 内容: 閾値 `Money` を常に既定 JPY で生成するため、`finalTotal` が非JPY だと `Money.subtract` の `assertSameCurrency` で `InvalidArgumentError`。JSDoc は「通貨は finalTotal に合わせる」と書くが実際は JPY 固定で、記述と挙動が矛盾。
- 対応案: 現状 JPY 前提なので実害はないが、JSDoc を実態（JPY 固定）に合わせるか、将来の多通貨に備えコメントを修正。

### #8 `ApprovalChainBuilder` が「役割1段=役職1段」不変条件を無防備に信頼（低・altitude）
- 箇所: `src/server/subdomains/estimate/domain/services/ApprovalChainBuilder.ts:97`
- 内容: ADR-0062 は `finalApprovalPositionId` の一意性をこの入力不変条件に依存するが、break 条件は `isAtLeast` のみ。組織データが不変条件に反し役職段階を飛び越すと、ゴールを越えた positionId を確定する。
- 補足: ADR-0062 が前提として明記した入力不変条件であり、防御を足すかは altitude の判断。組織マスタ側の制約で担保されるなら不要。

### #9 `create` の `steps.length===0` バックストップは到達不能なデッドコード
- 箇所: `EstimateApplication.ts:64`
- 内容: `steps` は `plan.roleIds.map` 由来で、`ApprovalChainPlan.create` が `roleIds.length===0` で必ず例外（`ApprovalChainPlan.ts:33`）。plan がある時点で `roleIds >= 1` が保証され、この if は構造上 true にならない（コメント自身が「通常到達しない」と認める）。
- 対応案: 削除し、不変条件は `ApprovalChainPlan` に一本化。

### #10 `Money` に大小比較がなく、`isAtLeastYen` が `subtract().isNegative()` で再実装
- 箇所: `ApprovalRequirementPolicy.ts:86`
- 内容: コメントも「Money に大小比較がないため」と明記。比較イディオムがポリシー側に溜まり、境界（`>=`/`>`）や通貨整合の解釈が各所でばらつく。
- 対応案: `Money.isAtLeast(other)` / `compareTo` を追加して呼ぶ。

### #11 `approve`/`reject` が `_steps` を多重走査する（軽微）
- 箇所: `EstimateApplication.ts:196,211,181`
- 内容: `findStep` で step を得た直後 `assertStepAwaiting → stepStatus → findStep` で同一ステップを再探索し、さらに `stepStatus` が `applicationStatus`（`some`+`every`）と `filter().every()`（中間配列確保）を呼ぶ。1操作で `_steps` を約5〜6周。
- 対応案: 解決済み step を引き回し、AWAITING 判定は `_steps.every(o => o.stepOrder >= step.stepOrder || o.isApproved())` の無割り当て1パスに畳む（ドメイン層でステップ数少のため影響軽微）。

### #12 列挙型VOのボイラープレート重複（`EnumValueObject` 基底不在・低）
- 箇所: `src/server/subdomains/estimate/domain/values/ApprovalGoalTier.ts:69` ほか4VO
- 内容: `VALID_VALUES`＋`LABEL_MAP`＋`from()` の手書き switch＋`validate()` の includes が4新規VO（および既存10件超）で同型コピー。`from` の switch と `validate` で有効値を二重定義し、値追加時に片方を忘れても実行時まで露見しない。
- 対応案: 本PR固有というより基盤不在の表面化。別 issue での `EnumValueObject` 基底抽出が妥当。

### #13 `ApprovalChainBuilder` テストが循環検出・自己ループ・スナップショット欠落（`InvalidArgumentError`）を未カバー
- 箇所: `src/server/subdomains/estimate/domain/services/__tests__/ApprovalChainBuilder.test.ts`
- 内容: 本体は `visited` による循環検出と `lookup` 欠落時の `InvalidArgumentError` を実装するが、テストは `BusinessRuleViolationError` 系3ケースのみ。
- 対応案: 循環（A→B→A・自己ループ）と役割欠落のテストを追加。

### #14 `RANK_MAP` は `VALID_VALUES` の index から導出可能な二重管理（低）
- 箇所: `ApprovalGoalTier.ts:20`
- 内容: `RANK_MAP` の 1..4 は `VALID_VALUES` の添字+1 と必ず一致する派生値。段階挿入時に手で振り直す必要があり、配列順と rank が食い違っても気づかない。
- 対応案: `rank = VALID_VALUES.indexOf(value) + 1` で算出し `RANK_MAP` を削除。

### #15 導出VO（`ApplicationStatus`/`ApprovalStepStatus`）の `from()` は投機的API（低）
- 箇所: `src/server/subdomains/estimate/domain/values/ApplicationStatus.ts:53` / `ApprovalStepStatus.ts:53`
- 内容: 両VOの JSDoc 自身が「保存しない/Prisma に enum 列なし/導出計算のメモリ値」と明言するのに、永続化復元用 `from(string)` を実装。状態は導出ロジックが4シングルトンを返すのみで文字列再パース経路が無い。
- 対応案: 必要時に追加とし現状は削除。

---

## 検証で棄却した候補（初回レビュー時点）

- **「finalApprovalPositionId がゴールを上回る（起点 ≧ ゴール時）」** → ADR-0062 行46 + テスト（`ApprovalChainBuilder.test.ts:40`）より**意図通り**。goalTier は下限で、ADR-0003 により直属上位が必ず最低1段。
- **「不変性テストが退行を検出しない」** → 実際は検出できる（実体を返せば pop で内部が変わり失敗）。テストは妥当。
- **`new Date()` の非決定性** → 全兄弟エンティティ共通の house convention で逸脱なし。
- **`RejectionComment` の trim/MAX_LENGTH 境界** → trim 後に長さ判定で正しい。
- **クロスファイル整合・CLAUDE.md 規約** → 違反なし（tsc/vitest/eslint 全 pass、外部ライブラリ・Prisma 混入なし）。
