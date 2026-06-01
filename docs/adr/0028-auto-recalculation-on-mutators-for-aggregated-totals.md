# ADR-0028: 集計値を持つ集約は全 mutator で自動再計算を強制する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-01 |
| 最終更新日   | 2026-06-01 |

## コンテキスト

Issue #284 で実装した Estimate 集約は、子 EstimateVariation に 5 種類の集計値（小計・値引小計・税抜合計・税額・税込合計）を保持する。これらは明細（EstimateItem）の値・数量・割引、全体値引、税率、丸めポリシーから算出され、§8 金額の保存形式に従って**永続化時に値そのものを保存する**（後から表示時に再計算しない）。

この設計に伴い、「集計値はいつ・誰が計算するか」を決める必要がある:

- **集約内の状態変更**: 明細の数量変更、単価変更、明細追加・削除、全体値引変更、税率変更 — どの操作も集計に影響する
- **永続化値の信頼性**: §8 の方針により、保存された集計値は「**見積時点の値**」として保存され、後から税率が変わっても見積の集計は変わらない
- **業務上のリスク**: 集計が古い（明細を変えたのに合計が反映されない）状態で承認や請求に進むと、深刻なバグになる

これは Estimate に固有の問題ではなく、**集計値を持つ集約すべて**で繰り返される問題である。今後の Order / Invoice / 仕入見積 でも同じ判断が必要になる。

## 検討した選択肢

### A. 遅延計算（ゲッターで都度計算）（不採用）

```typescript
class EstimateVariation {
  get subtotal(): Money {
    return EstimateAmountPolicy.calculate(this._items, this._overallDiscount, ...).subtotal;
  }
}
```

「集計値はフィールドに保存せず、必要なときに計算する」素朴な解。状態管理の手間がない。

**問題**:
- §8「金額の保存形式」と整合しない: 永続化スキーマに `subtotal` / `taxAmount` / `finalTotal` カラムがあり、保存時点の値を保持する設計（後から税率改定があっても見積の合計が変わらないため）。遅延計算だとリポジトリでマッピング時に「ゲッターを呼んで保存」する手間が発生し、しかも保存と計算のタイミングがずれる
- 集計値を含むシリアライズ（API レスポンス・スナップショット）で毎回計算が走る
- `reconstruct()` で永続化値を入れても、ゲッターで再計算されてしまい「保存済み値を信頼」できない

### B. 明示的な `recalculate()` 呼び出し（不採用）

```typescript
variation.addItem(item);
variation.changeOverallDiscount(newDiscount);
variation.recalculate(); // ← 呼び忘れたら不整合
```

mutator は状態を変えるだけ、再計算は呼び出し側の責務。

**問題**:
- **呼び忘れリスク**: 集約利用者（アプリ層・テスト・将来の開発者）が `recalculate()` を呼び忘れると、集計が古いまま外部に露出する
- 呼び忘れがテストで検出されにくい（特定の状態遷移を踏まないと再現しない）
- ADR-0027 の集約境界を守っても、再計算を呼び忘れたら集約の不変条件が壊れる

### C. 全 mutator で自動再計算（採用）

```typescript
class EstimateVariation {
  addItem(item: EstimateItem, tax: TaxContext): void {
    this._items.push(item);
    this.recalculate(tax); // mutator 内で必ず呼ぶ
  }

  changeOverallDiscount(newDiscount: Money, tax: TaxContext): void {
    this._overallDiscount = newDiscount;
    this.recalculate(tax);
  }

  private recalculate(tax: TaxContext): void {
    const totals = EstimateVariation.computeTotals(this._items, this._overallDiscount, tax);
    this._subtotal = totals.subtotal;
    // ...
  }
}

// reconstruct は別経路: 保存済み値を信頼してそのまま注入
static reconstruct(input: { subtotal: Money; ... }): EstimateVariation {
  return new EstimateVariation(/* 計算せずそのまま */);
}
```

mutator は最後に必ず `recalculate(...)` を呼ぶ。`create()` も計算経由で生成する。`reconstruct()` だけは保存済み値を信頼してそのまま注入する（再計算しない）。

## 決定

集計値を持つ集約は以下のパターンで自動再計算を強制する:

1. **集計値はフィールドとして保存する**（遅延計算しない）
2. **全 mutator は最後に `recalculate(...)` を呼ぶ**（private メソッドとして集中管理）
3. **`create()` は計算経由で生成**（初期集計値も `recalculate` 同等のロジックで算出）
4. **`reconstruct()` は保存済み値を信頼**してそのまま注入する（永続化値の整合性は DB 側の責務）
5. **再計算ロジック自体は Policy クラスに委譲**（ADR-0023）

## 根拠

### ADR-0027 と組み合わせて初めて集約不変条件が守られる

ADR-0027（集約境界の構造的強制）で「子エンティティを外から触れない」を担保し、本 ADR で「**触れる経路（mutator）では必ず再計算が走る**」を担保する。両者が揃って初めて「**集約状態は常に整合する**」という不変条件が構造的に成立する。

### 呼び忘れを構造的に防ぐ

選択肢 B（明示呼び出し）は本質的に「規律ベースの防御」であり、規律はいずれ破れる。Mutator 内で自動的に呼ぶことで、**「呼び忘れ」という事象自体が存在しなくなる**。これは ADR-0027 と同じ思想（型・構造で守る）。

### §8「金額の保存形式」と整合

業務文書 §8 は「金額は見積時点の値を保存する」と規定する（後の税率改定で過去の見積金額が変わってはいけない）。`reconstruct()` で保存済み値を信頼することにより、リポジトリから読み込んだ既存見積は当時の集計値そのままで復元される。

一方、`create()` および mutator は「今この瞬間の集計」を出す必要があるため、必ず再計算する。「**過去は信頼、現在は計算**」の役割分担が明確。

### 集約境界による委譲チェーンで全変更が同じ規律に従う

ADR-0027 の集約境界規約により、子エンティティの変更は必ず集約ルート → Variation → Item のチェーンを通る。`changeItemQuantity()` は Variation の mutator なので、必ず `recalculate(tax)` が走る。`Estimate.changeItemQuantity(...)` は Variation に委譲するため、ルート経由でも同じ規律。

```
アプリ層 → Estimate.changeItemQuantity(varId, itemId, qty)
       → variation.changeItemQuantity(itemId, qty, tax)
       → item.changeQuantity(qty) + recalculate(tax)
```

### Policy 委譲で計算ロジックを集約

再計算ロジック自体は `EstimateAmountPolicy.calculate(...)` 等の Policy クラス（ADR-0023）に委譲する。Variation は「**いつ計算を起動するか**」だけを管理し、「**どう計算するか**」は Policy が持つ。責務分離が明確で、計算規約の変更時に Policy だけ修正すれば全集約に波及する。

### 不採用理由まとめ

- **A（遅延計算）**: §8 と整合せず、`reconstruct()` 経路で永続化値を信頼できなくなる
- **B（明示呼び出し）**: 規律ベースの防御で、呼び忘れリスクが残る

## 影響

### 全「集計値を持つ集約」に適用する

今後の Order / Invoice / 仕入見積 などで小計・税額・合計などを集約に保存する場合、本パターンを適用する。Policy（ADR-0023）と組み合わせる前提。

### Mutator のシグネチャに「計算に必要な情報」を含める必要がある

子エンティティ自身が「親の値」を持たない場合（ADR-0030 の TaxContext パターン）、mutator 引数で受け取る:

```typescript
changeItemQuantity(itemId: EstimateItemId, newQty: Quantity, tax: TaxContext): void
```

集約ルートが各 mutator 呼び出しのたびに `taxContext()` を private に作って渡す。利用者（アプリ層）はルート経由で呼ぶため `TaxContext` を意識しない。

### Tax / 横断変数の変更時の伝播

集約ルートが税率を変更した場合、全 Variation に再計算を伝播する:

```typescript
changeTaxRate(newRate: TaxRate): void {
  this._taxRate = newRate;
  this.propagateTaxToAllVariations();
}

private propagateTaxToAllVariations(): void {
  for (const v of this._variations) {
    v.recalculateForTaxChange(this.taxContext());
  }
}
```

`recalculateForTaxChange` は「明細・割引は変えず、tax だけ変えて再計算」という意図を表す mutator として子に公開する。

### `reconstruct()` の責務範囲

`reconstruct()` は保存済み値をそのまま注入するだけで、整合性チェックを行わない。これは「DB に保存された値は当時の整合した値」という前提に依存する。**DB が壊れている場合のリカバリは別問題**であり、本 ADR のスコープ外。

ただし `create()` 時に算出された集計値は、`reconstruct()` で復元しても同じはず（決定性のある計算）なので、テストで `create → 永続化 → reconstruct` のラウンドトリップが等価であることを確認する。

### テスト戦略

- Mutator 系のテストでは、操作後に集計値が想定通りであることを必ず確認する（自動再計算が走っているか）
- `reconstruct()` のテストでは、入力値がそのまま反映されること（再計算されていないこと）を確認する
- Policy 自体のテストは Policy の `__tests__/` で行い、集約のテストでは「Policy が呼ばれて集計値が更新される」という統合レベルで確認する

### 関連

- `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts:242-286` — `recalculate` / `computeTotals` の実装例
- `src/server/subdomains/estimate/domain/policies/EstimateAmountPolicy.ts` — 計算規約本体
- ADR-0027 — 集約境界の構造的強制（本 ADR と組み合わせて集約不変条件を守る）
- ADR-0023 — 計算規約は Policy クラスとして配置
- ADR-0022 — Money パターン
- ADR-0030 — 横断的コンテキストを引数で渡すパターン（mutator シグネチャに関連）
