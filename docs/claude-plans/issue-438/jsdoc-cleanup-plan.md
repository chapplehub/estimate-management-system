# 実装計画: Issue #438 — shared 昇格後の Money/Currency JSDoc から estimate 固有スペック参照を整理

## Context（背景・目的）

#436 で `Money` / `Currency` 値オブジェクトを `shared/domain/values/` へ**逐語移動**（git 上で純粋なリネームに見えるようコメント無修正）した。その結果、共有層 (`shared`) の VO の JSDoc に **estimate サブドメイン固有のスペック参照**（`§8.1`・掛率/税率の例示・`Decimal(12,2)`）が残った。

共有 VO が特定サブドメインのスペック節番号を参照するのは概念的なねじれであり、estimate スペック再編時にダングリング参照化するリスクがある。本 issue でこれを整理する。

**重要な前提（調査で確認済み）:**
- `§8.1` は estimate の「金額計算フロー」スペック節番号。`src/server/subdomains/estimate/domain/policies/LineItemAmountPolicy.ts` / `EstimateAmountPolicy.ts` が**正当に**参照しており、業務文脈はそちらに残る。
- 設計判断（applyRate=銭未満切捨／§8.1=円未満切捨、掛率・税率の比率適用、Decimal(12,2)→scale=2）は既に **ADR-0022** に記録済み。共有層から外しても情報は失われない。
- `Money.ts:146` は既に `ADR-0022` を参照済み（ADR 参照はこのファイルの既存慣習）。

**スコープ: コメント（JSDoc）のみ。挙動・公開 API・シグネチャは一切変更しない。**

## 確定した方針（ユーザー回答）

1. **節番号参照** → 節番号を外し、一般記述化（`§8.1` を削除し概念だけ残す）
2. **掛率・税率の例示** → 汎用表現（「比率の適用」）へ一般化
3. **scale=2 の根拠** → `ADR-0022` 参照へ簡潔化（`Decimal(12,2)`・`§8.1` の具体記述を外す）

## 変更内容

### ファイル1: `src/server/shared/domain/values/Money.ts`（3箇所）

**(a) クラス JSDoc（8行目付近）** — 方針2
- 現状: 「…金額は常に整数で保持し、**掛率・税率の乗算**も可能な限り整数演算で行う…」
- 変更後: 「掛率・税率の乗算」→「**比率の乗算**」へ一般化

**(b) `applyRate` JSDoc（95・101〜102行目）** — 方針2
- 現状: 「比率 `numerator / 10^scale` を掛ける（**掛率・税率の適用**）。」
- 変更後: 「（**比率の適用**）」へ一般化
- `@param numerator`「例: **掛率**0.95 → 9500」→「例: 0.95 → 9500」へ汎用化
- `@param scale`「例: **掛率は4**」→「例: 小数4桁なら 4」へ汎用化
- 99行目「さらに『円未満切捨』が必要な場合は…」は estimate 固有語でないため**維持**

**(c) `truncateToMajorUnit` JSDoc（117行目）** — 方針1
- 現状: 「主単位（円）未満を切り捨てる（ゼロ方向）。**§8.1「端数切捨」の単位は円。**」
- 変更後: 「主単位（円）未満を切り捨てる（ゼロ方向）。」（`§8.1` 参照節を削除。一般記述のみ残す）

### ファイル2: `src/server/shared/domain/values/Currency.ts`（1箇所）

**クラス JSDoc（設計判断の段落）** — 方針3
- 現状: scale=2 の根拠として「**DB スキーマが金額を Decimal(12,2) で保持**」「なお **§8.1** の計算途中の端数処理は『1円未満切捨』であり…」を記述
- 変更後: 「JPY は scale=2（銭精度）で定義する。ISO 4217 では 0 桁だが銭精度の保持が必要なため scale=2 とする。**根拠の詳細は ADR-0022 を参照。**」へ簡潔化
- `Decimal(12,2)` の具体・`§8.1` 言及・「銭精度の保持と切り捨て単位は別概念」の節を削除（情報は ADR-0022 が保持）

## コミット計画（One step = one commit）

設計判断（estimate 臭の除去）が単一テーマで小さいため、**1コミットにまとめる**:
- `docs: 共有 Money/Currency の JSDoc から estimate 固有スペック参照を整理 (#438)`
- ボディに「§8.1/掛率税率/Decimal(12,2) を一般化・ADR-0022 参照化。業務文脈は ADR-0022 と estimate ポリシーに残る」旨を記載

## 検証（Verification）

コメントのみの変更のため挙動は不変。以下で回帰がないことを確認:

```bash
pnpm lint                                    # JSDoc 整形・未使用参照の検出
pnpm test src/server/shared/domain/values    # Money/Currency のユニットテスト緑
grep -rn "§8.1\|掛率・税率\|Decimal(12,2)" src/server/shared/domain/values/  # → 0 件（除去確認）
grep -rn "ADR-0022" src/server/shared/domain/values/Currency.ts              # → 参照が入ったこと確認
```

- `applyRate` / `truncateToMajorUnit` を参照する estimate 側ポリシー（`LineItemAmountPolicy` 等）の `§8.1` コメントは**意図的に維持**されること（共有層のみ整理）。

## 実装後タスク

- 計画からの逸脱があれば `docs/claude-plans/issue-438/deviations.md` に記録。
