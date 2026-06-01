# ADR-0030: 集約内で横断的に必要なコンテキストは子に保持させず引数で渡す

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-06-01 |
| 最終更新日   | 2026-06-01 |

## コンテキスト

Issue #284 で実装した Estimate 集約では、子 EstimateVariation が集計（小計・税額・合計）を計算するために**税情報**（税率 + 丸めポリシー）を必要とする。しかし税情報は集約ルート Estimate に 1 つだけ存在し、全 Variation で共通である。

ここで「Variation が税情報をどう参照するか」の設計が必要になった:

- Variation 自身がコピーを保持すべきか？
- 親 Estimate への back-reference を持つべきか？
- 計算のたびに親から引数で受け取るべきか？

この判断は税情報に限らず、今後の集約で頻繁に発生する横断的コンテキスト（為替レート、適用税制、配送計算用の倉庫位置、価格決定のための顧客ランクなど）にも適用される共通パターンである。Estimate でパターンを確定して以降の集約で再利用したい。

## 検討した選択肢

### A. 子エンティティが自分のコピーを保持する（不採用）

```typescript
class EstimateVariation {
  private _taxRate: TaxRate;          // Estimate と同じ値を保持
  private _taxRoundingType: TaxRoundingType;
  // ...
}
```

Variation が自己完結的に計算できる。引数の引き回しが不要。

**問題**:
- **二重管理**: Estimate と Variation が同じ税率を保持することになり、整合性維持の責務が発生する。Estimate の税率変更時に全 Variation へ伝播する仕組みが必要で、伝播漏れがあると不整合が発生する
- **永続化スキーマと不一致**: DB には `Estimate.tax_rate` が 1 つあるだけ。Variation テーブルに `tax_rate` カラムは無い（あるべきでもない）。ドメインと DB の構造が乖離する
- **税率変更時のリスク**: ユーザーが税率を変更したとき、Variation 側のコピーが古いまま残るリスクが構造的に存在する

### B. 子が親への back-reference を持つ（不採用）

```typescript
class EstimateVariation {
  constructor(private readonly _parent: Estimate, ...) {}

  recalculate(): void {
    const tax = this._parent.taxRate;
    // ...
  }
}
```

子から親を直接参照することで「親に存在する値」にいつでもアクセスできる。

**問題**:
- **集約内循環参照**: Estimate ⇄ Variation の循環参照が発生し、ガベージコレクション・シリアライズ・テスト構築が複雑になる
- **`reconstruct()` の難化**: 永続化値から復元するとき、Variation を作るには先に Estimate が必要だが、Estimate を作るには Variation のリストが必要、という鶏卵問題が発生する
- **子の独立性が失われる**: Variation 単体のテストが書きづらい（必ず親の Estimate を構築する必要がある）
- **集約ルートのカプセル化を侵食**: 子が親の内部状態に依存することで、親のリファクタが子に波及する

### C. 計算のたびに引数で受ける（採用）

```typescript
export type TaxContext = {
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
};

class EstimateVariation {
  // Variation 自身は税情報を保持しない

  addItem(item: EstimateItem, tax: TaxContext): void {
    this._items.push(item);
    this.recalculate(tax);
  }

  changeItemQuantity(itemId: EstimateItemId, qty: Quantity, tax: TaxContext): void {
    this.findItemOrThrow(itemId).changeQuantity(qty);
    this.recalculate(tax);
  }

  recalculateForTaxChange(tax: TaxContext): void {
    this.recalculate(tax);
  }

  private recalculate(tax: TaxContext): void { /* ... */ }
}

class Estimate {
  private taxContext(): TaxContext {
    return { taxRate: this._taxRate, taxRoundingType: this._taxRoundingType };
  }

  changeItemQuantity(varId, itemId, qty): void {
    this.findVariationOrThrow(varId).changeItemQuantity(itemId, qty, this.taxContext());
    this.touch();
  }
}
```

子は税情報を保持しない。Estimate ルートが `taxContext()` を private に作って、子への呼び出しのたびに渡す。

## 決定

集約内で横断的に必要なコンテキスト（集約ルートに 1 つだけ存在し、複数の子で必要な値）は、以下のパターンで扱う:

1. **子エンティティは当該コンテキストを保持しない**
2. **集約ルートが `xxxContext()` 形式の private メソッドで Context オブジェクトを構築する**
3. **集約ルートが子の mutator を呼ぶたびに Context オブジェクトを引数として渡す**
4. **コンテキストが変わったときの伝播は `recalculateForXxxChange(ctx)` のような子側の mutator で受ける**
5. **集約外のコード（アプリ層）は集約ルート経由で呼ぶため、Context 型を意識しない**

## 根拠

### 単一情報源の原則 (Single Source of Truth)

税率は集約ルートに 1 つだけ存在する。子が複製を持つと「**どちらが正しいか？**」という疑問が常に発生する。引数で渡すことで「**親が常に正**」を構造的に表現できる。

### ADR-0028 の自動再計算と相性が良い

ADR-0028 で「全 mutator で自動再計算」を定めた。再計算には税情報が必要だが、子が税情報を持たないなら**引数で受けるしかない**。これにより mutator のシグネチャに `tax: TaxContext` が現れ、「**この操作は税情報に依存する**」ことが型上明示される。

### 集約境界規約 (ADR-0027) との整合

ADR-0027 で「集約外コードは子に直接アクセスできない」と定めた。子の mutator が `TaxContext` を引数で要求しても、集約外コードは集約ルートのメソッドを呼ぶだけで、ルートが裏で `taxContext()` を構築して子に渡す。**アプリ層は `TaxContext` の存在を知らない**。インターフェースが綺麗に保たれる。

### `reconstruct()` がシンプル

Variation を永続化値から復元するとき、税情報を入力に含める必要がない（保存済み集計値をそのまま注入するため、復元時に計算しない）。`reconstruct()` の引数が肥大化しない。

```typescript
EstimateVariation.reconstruct({
  id, variationNumber, status, customerMemo, internalMemo,
  overallDiscount, items,
  subtotal, discountSubtotal, finalSubtotal, taxAmount, finalTotal,
  createdAt, updatedAt,
  // ← tax は不要（保存済み集計値を信頼するため）
});
```

### Context オブジェクトの再利用

`TaxContext` という型を定義することで、Variation の複数の mutator が同じ引数型を共有する。引数を一つ追加するときも `TaxContext` の中身を増やせば全 mutator に波及する。将来「税率 + 丸めポリシー + 端数処理単位」のようにコンテキストが拡張されても、関数シグネチャは変わらない。

### 子エンティティの独立テスト容易性

Variation 単体のテストでは `TaxContext` をテストデータとして直接渡せばよい。親 Estimate を構築する必要がない:

```typescript
const variation = EstimateVariation.create({
  variationNumber: 1,
  tax: { taxRate: TaxRate.of("0.10"), taxRoundingType: TaxRoundingType.FLOOR },
  items: [...],
});
```

選択肢 B（back-reference）だと親 Estimate ごと構築する必要があり、テストが煩雑になる。

### 不採用理由まとめ

- **A（子がコピーを保持）**: 二重管理になり、伝播漏れリスクと永続化スキーマの乖離が発生
- **B（back-reference）**: 集約内循環参照と `reconstruct()` の鶏卵問題が発生し、子の独立性が損なわれる

## 影響

### 適用条件

本パターンを適用する条件:

1. **集約ルートに 1 つだけ存在する値**であること
2. **子エンティティの内部ロジック（計算・検証）が必要とする値**であること
3. **値の変更がリアルタイムに子に反映される必要がある**こと

これらを満たす将来の例:
- **為替レート**: Order 集約で複数通貨が並ぶ場合
- **適用税制**: 軽減税率対応で複数税率が並ぶとき、Variation ごとに「どの税制を使うか」を Context で渡す
- **顧客ランク**: 価格決定で顧客ランクによって割引率が変わる場合、Order ルートが顧客ランクを保持し、明細に Context として渡す

### Context オブジェクトの命名規約

- 型名: `XxxContext`（例: `TaxContext`、`PricingContext`、`ShippingContext`）
- 集約ルートの構築メソッド: `xxxContext()` private（例: `taxContext()`）
- 子側の伝播 mutator: `recalculateForXxxChange(ctx)`（例: `recalculateForTaxChange`）

### 引数位置

Context オブジェクトは mutator の**最後の引数**として渡す。理由:
- 業務的に意味のある引数（操作対象 id、新しい値）が先頭に来る方が読みやすい
- Context は実装詳細的な引数であり、業務動詞の意図を見たいときに邪魔にならない

```typescript
// 良い
changeItemQuantity(itemId: EstimateItemId, newQty: Quantity, tax: TaxContext): void

// 悪い
changeItemQuantity(tax: TaxContext, itemId: EstimateItemId, newQty: Quantity): void
```

### Context オブジェクトを子に複数渡すケース

将来複数の Context が必要になった場合（例: 税 + 為替）、それぞれ別オブジェクトで渡すか、合成型を作るかは状況で判断する。基本は別オブジェクトで渡し、3 つ以上になったら合成型を検討する:

```typescript
// 2 つまでは別オブジェクトで
foo(itemId, qty, tax: TaxContext, fx: FxContext): void

// 3 つ以上なら合成
foo(itemId, qty, ctx: { tax: TaxContext; fx: FxContext; pricing: PricingContext }): void
```

### 関連

- `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts:25-28` — `TaxContext` 型定義
- `src/server/subdomains/estimate/domain/entities/Estimate.ts:373-383` — `taxContext()` / `propagateTaxToAllVariations()`
- `docs/claude-plans/issue-284/deviations.md` §7 — 元となった具体判断
- ADR-0027 — 集約境界の構造的強制（本パターンが Context 型をアプリ層から隠蔽できる前提）
- ADR-0028 — 自動再計算（mutator が Context を要求する理由）
