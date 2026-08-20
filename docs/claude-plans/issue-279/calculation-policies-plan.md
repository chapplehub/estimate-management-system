# 見積ドメイン: 金額計算ポリシーの実装

## Context

Issue #279 のスコープは **「金額計算の値オブジェクト + 計算ポリシー（§8、依存ゼロ・即テスト可）」** だが、第1コミット時点では値オブジェクト 6 つのみ実装され、計算ポリシーが未実装のまま PR #281 を作成してしまった。本計画はその欠落分を同じブランチ `feat/issue-279` に追加し、PR #281 を完成させるためのもの。

`docs/business/estimate/ユースケース一覧(見積).md` のバックエンド着手順序:
1. 値オブジェクト ✅ (実装済)
2. **計算ポリシー** ← 本計画の対象
3. Entity / Repository / UseCase (後続 PR)

設計書の対応箇所: §8.1 金額計算フロー / §8.3 消費税端数処理 / §8.4 粗利計算 / 付録 B.4 エラー一覧。

## 設計判断（既決）

ユーザー対話で以下を確定:

1. **配置方針: Policy 派（純粋分離）**
   Entity (EstimateItem / EstimateVariation) は未着手のまま、計算規約を独立した Policy クラスとして実装する。Entity 着手時はラッパーメソッドで Policy を呼ぶ形で発展させる（Entity が貧血モデルにはならない設計）。
2. **負の最終金額: Policy 内で即 throw**
   `明細値引 > 掛率適用後金額` または `全体値引 > 明細小計` のとき `BusinessRuleViolationError` を投げる。設計書付録 B.4 「最終金額がマイナス → 値引き額を調整」と整合。
3. **粗利スコープ: 見積バリエーション全体の粗利のみ**
   納品先用バリエーションの最終合計 vs 得意先用バリエーションの最終合計を比較。RevisedEstimateItemDetail.deliveryPrice の明細単位スナップショットを活用する明細レベル粗利は本計画では対象外。
4. **命名・形式・配置: `LineItemAmountPolicy` のような static class、`domain/policies/` 新設**
   業務文書「計算ポリシー」と語彙を揃え、既存 `domain/services/` の DomainService（リポジトリ DI が必要な越境チェック用途）と責務の輪郭を分ける。

## 実装ファイル

### 1. `src/server/subdomains/estimate/domain/policies/LineItemAmountPolicy.ts`

明細レベル §8.1 (1)-(3) を担う。

```typescript
export type LineItemAmountResult = {
  baseAmount: Money;        // §8.1(1) 基本金額  = 数量×単価（円未満切捨）
  discountedAmount: Money;  // §8.1(2) 掛率適用後 = 基本金額×掛率（円未満切捨）
  finalAmount: Money;       // §8.1(3) 最終明細  = 掛率適用後 − 明細値引
};

export class LineItemAmountPolicy {
  private constructor() {}

  static calculate(
    unitPrice: Money,
    quantity: Quantity,
    discountRate: DiscountRate,
    itemDiscount: Money,
  ): LineItemAmountResult {
    const baseAmount = unitPrice.times(quantity.value).truncateToMajorUnit();
    const discountedAmount = baseAmount
      .applyRate(discountRate.numerator, DiscountRate.SCALE)
      .truncateToMajorUnit();
    const finalAmount = discountedAmount.subtract(itemDiscount);
    if (finalAmount.isNegative()) {
      throw new BusinessRuleViolationError("値引き後の金額がマイナスになります");
    }
    return { baseAmount, discountedAmount, finalAmount };
  }
}
```

中間値（baseAmount, discountedAmount）も返すのは `EstimateItem` テーブルが 3 つを別カラムで保持するため（再計算時にすべて保存対象）。

### 2. `src/server/subdomains/estimate/domain/policies/EstimateAmountPolicy.ts`

見積レベル §8.1 (4)-(7) を担う。

```typescript
export type EstimateAmountInput = {
  finalLineAmounts: Money[];      // §8.1(3) の結果列
  overallDiscount: Money;          // 全体値引金額
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
};

export type EstimateAmountResult = {
  subtotal: Money;                 // §8.1(4) Σ(最終明細金額)
  afterOverallDiscount: Money;     // §8.1(5) 小計 − 全体値引
  taxAmount: Money;                // §8.1(6) 全体値引後 × 税率（区分丸め）
  finalTotal: Money;               // §8.1(7) 全体値引後 + 税額
};

export class EstimateAmountPolicy {
  private constructor() {}

  static calculate(input: EstimateAmountInput): EstimateAmountResult {
    const subtotal = input.finalLineAmounts.reduce(
      (acc, m) => acc.add(m),
      Money.zero(),
    );
    const afterOverallDiscount = subtotal.subtract(input.overallDiscount);
    if (afterOverallDiscount.isNegative()) {
      throw new BusinessRuleViolationError("値引き後の金額がマイナスになります");
    }
    const rawTax = afterOverallDiscount.applyRate(input.taxRate.numerator, TaxRate.SCALE);
    const taxAmount = input.taxRoundingType.applyTo(rawTax);
    const finalTotal = afterOverallDiscount.add(taxAmount);
    return { subtotal, afterOverallDiscount, taxAmount, finalTotal };
  }
}
```

入力は `EstimateAmountInput` オブジェクトに集約（4 つの引数を順番で渡すより呼び出し側でフィールド名が明示される）。

### 3. `src/server/subdomains/estimate/domain/policies/GrossProfitPolicy.ts`

§8.4 を担う。粗利率は `number`（比率）として返し、表示時の桁丸めは presentation 層に委ねる。

```typescript
export type GrossProfitResult = {
  grossProfit: Money;       // 納品先価格 − 得意先価格
  grossProfitRate: number;  // 粗利 / 納品先価格（0..1 の比率）
};

export class GrossProfitPolicy {
  private constructor() {}

  static calculate(deliveryPrice: Money, customerPrice: Money): GrossProfitResult {
    if (deliveryPrice.isZero()) {
      throw new BusinessRuleViolationError("納品先価格が0の場合、粗利率を計算できません");
    }
    const grossProfit = deliveryPrice.subtract(customerPrice);
    const grossProfitRate = grossProfit.minorUnits / deliveryPrice.minorUnits;
    return { grossProfit, grossProfitRate };
  }
}
```

`grossProfit` は **負を許容する**（得意先価格 > 納品先価格の場合 = 逆ザヤ）。設計書 §8.4 に「マイナスを禁止する」記述はなく、業務上ありえる（特売・販促等）。

割り算ゼロは `納品先価格 = 0` のときのみ。これは見積として不正だが、ここで防御的にチェックする。

### 4. テストファイル（同階層 `__tests__/`）

- `LineItemAmountPolicy.test.ts`
  - 正常系: 設計書 §8.2 の例「単価100,000円×掛率0.95 = 95,000円、−明細値引5,000円 = 90,000円」を再現
  - 端数切捨: 銭→円の 2 段階切捨が両方効くケース（端数の出る単価 × 掛率）
  - 異常系: 明細値引 > 掛率適用後金額 → `BusinessRuleViolationError`「値引き後の金額がマイナスになります」

- `EstimateAmountPolicy.test.ts`
  - 正常系: 明細3つの小計→全体値引→税額→最終合計の流れ。端数処理 3 区分それぞれで税額が変わることを確認
  - 異常系: 全体値引 > 小計 → throw
  - 0 明細での挙動: `subtotal = 0`、税額 0、最終合計 0（設計書に空明細禁止のルールはあるが、ここはポリシーの数学的入力に対する振る舞いのテスト）

- `GrossProfitPolicy.test.ts`
  - 正常系: 設計書 §8.4 の例「1,200,000円 − 1,000,000円 = 200,000円 / 16.7%」を再現（`rate ≈ 0.1666...` の浮動小数比較は `toBeCloseTo`）
  - 逆ザヤ: 得意先価格 > 納品先価格 で `grossProfit` が負、`grossProfitRate` が負
  - 異常系: 納品先価格 0 → throw

### 5. （任意）`src/server/subdomains/estimate/domain/policies/index.ts`

Policy 群と Result 型の barrel export。Policy 利用側のインポート文が短くなる。

## 命名規約・配置の決定要約

| 項目 | 決定 |
|---|---|
| クラス命名 | `XxxAmountPolicy` / `XxxPolicy` |
| 形式 | static メソッドのみのクラス。`private constructor()` でインスタンス化禁止を型で表明 |
| メソッド名 | `calculate`（複数 Policy で語彙統一） |
| 配置 | `src/server/subdomains/estimate/domain/policies/` を新設 |
| 戻り値 | 結果型オブジェクト（最終値だけでなく中間値も含める） |
| エラー | `BusinessRuleViolationError` を即 throw（`@server/shared/errors/DomainError`） |
| テスト配置 | `policies/__tests__/XxxPolicy.test.ts`（既存 VO テストと同じパターン） |

## 既存資産との連携

- `Money.applyRate(numerator, scale)` — 銭未満切捨（割り算を含む計算の自動端数処理）
- `Money.truncateToMajorUnit()` — 円未満切捨（§8.1 の「端数切捨」を表現）
- `Money.times(integer)` — 整数倍（数量×単価、誤差ゼロ）
- `Money.add` / `subtract` / `isNegative` / `isZero` — 既存
- `Money.zero(Currency.JPY)` — reduce 初期値用
- `DiscountRate.numerator` / `DiscountRate.SCALE` — applyRate に渡す整数表現
- `TaxRate.numerator` / `TaxRate.SCALE` — 同上
- `TaxRoundingType.applyTo(money)` — 円単位の選択式丸め（§8.3）
- `Quantity.value` — `times` に渡す整数値
- `BusinessRuleViolationError` — `src/server/shared/errors/DomainError.ts`

## コミット粒度

CLAUDE.md の「Commit at each meaningful change」に従い、1 ポリシー = 1 コミットを基本とする:

1. feat: 明細レベル金額計算ポリシー (LineItemAmountPolicy) を追加する (#279)
2. feat: 見積レベル金額計算ポリシー (EstimateAmountPolicy) を追加する (#279)
3. feat: 粗利計算ポリシー (GrossProfitPolicy) を追加する (#279)

各コミットメッセージ本体には以下の設計判断理由を含める:
- なぜ Entity ではなく Policy として独立させたか（業務語彙「計算ポリシー」/着手順序/再利用性）
- なぜ static class か（依存ゼロ・状態なし計算規約として表現）
- なぜ結果型に中間値を含めるか（スキーマの 3 カラムへの保存要件）

## 検証

```bash
# テスト（pre-commit でも自動実行される）
pnpm test src/server/subdomains/estimate/domain/policies/

# 既存テストへの影響確認（VO 系のテストが落ちないこと）
pnpm test src/server/subdomains/estimate/

# Lint（estimate サブドメインのみ）
pnpm exec eslint src/server/subdomains/estimate/

# 型チェック
pnpm exec tsc --noEmit
```

期待結果: 既存 53 estimate VO テストはそのまま通過し、本計画で新規追加するテストが約 15–20 件足される（合計 70 前後）。全体テスト数は 675 → 約 690+ に増える想定。

## 完了後の追加作業

- PR #281 の body から「後続 PR に分割」表現を削除し、本 PR で Issue #279 の項目 2 を完了する旨に書き換える
- `Closes #279` は維持（Refs に変更しない）
- 計画と実装が変わった点は `docs/claude-plans/issue-279/deviations.md` に記録（命名/配置の検討プロセスは記録対象）
