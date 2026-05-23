# ADR-0023: ドメイン計算規約は domain/policies/ の Policy クラスとして配置する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-05-23 |
| 最終更新日   | 2026-05-23 |

## コンテキスト

ADR-0011 で **DomainService の設計パターン**を「事実確認型（boolean返却）」「ルール検証型（直接throw）」の2つに分類し、責務の性質で使い分ける方針を定めた。

その後、Issue #279「金額計算の値オブジェクト + 計算ポリシー（§8）」着手時に、見積ドメインの §8.1（明細・見積レベル金額計算）と §8.4（粗利計算）を実装する必要が生じた。これらは:

- **リポジトリ依存ゼロ・同期・純粋計算**である（DB を引かない、外部 API を呼ばない）
- 業務文書（`docs/business/estimate/ユースケース一覧(見積).md`）が「**計算ポリシー**」と呼んでいる
- 複数の計算規約（明細レベル・見積レベル・粗利）が並列に存在し、相互に独立している
- 将来の規約変更（消費税率・端数処理・粗利率精度など）に強い構造が望ましい

これは既存6サブドメイン（customer / employee / product / department / delivery-location / role）の DomainService（すべてリポジトリ DI ありの越境チェック用途）と責務カテゴリが異なる。ADR-0011 の「事実確認型／ルール検証型」の二分法だけでは収まらない、第3のカテゴリが必要になった。

## 検討した選択肢

### A. Entity (EstimateItem / EstimateVariation) のメソッドに直接実装する（不採用）

```typescript
class EstimateItem {
  calculateAmounts(): LineItemAmountResult {
    // §8.1(1)-(3) のロジックをここに
  }
}
```

DDD の正統。Entity が振る舞いを持ち、Anemic Domain Model にならない。

しかし以下の難点がある:

- **計算規約は EstimateItem の私的事情ではなく見積ドメイン全体の規約**: §8.1 の計算順序・§8.3 の端数処理規約は EstimateVariation の小計・税額計算でも同じパターンを使い、将来 Order でも流用する。Entity 内に閉じ込めると再利用しづらい。
- **見積レベル計算（複数明細の集約）は EstimateVariation の自然な責務を超える**: 「明細群 + 全体値引 + 税率 + 端数処理区分」を受けて計算するのは集約越境の側面を持つ。
- **着手順序の制約**: 業務文書のバックエンド着手順序は「① 値オブジェクト → ② 計算ポリシー → ③ Entity」。Policy 先行実装でテスト可能にする方針と合わない。
- **粗利は EstimateVariation × 2 の比較**で、どちらの Entity にも自然には属さない。Policy / Service への分離が必須。

### B. Policy として独立した static class を `domain/policies/` に配置する（採用）

```typescript
// src/server/subdomains/estimate/domain/policies/LineItemAmountPolicy.ts
export class LineItemAmountPolicy {
  private constructor() {}

  static calculate(
    unitPrice: Money,
    quantity: Quantity,
    discountRate: DiscountRate,
    itemDiscount: Money
  ): LineItemAmountResult {
    // §8.1(1)-(3) のロジック
  }
}
```

リポジトリ依存ゼロの純粋計算規約として独立させ、`domain/services/`（DomainService）と責務カテゴリを分ける。`private constructor` でインスタンス化禁止を型レベルで表明する。

### C. 委譲ハイブリッド（Entity が Policy に委譲）

```typescript
class EstimateItem {
  calculateAmounts(): LineItemAmountResult {
    return LineItemAmountPolicy.calculate(this.unitPrice, this.quantity, this.discountRate, this.itemDiscount);
  }
}
```

B を採用したうえで、Entity 着手時に薄いラッパーメソッドを足す形。本 ADR のスコープでは Entity 未着手のため B 単独で先行実装し、Entity 着手時に自然に C へ発展させる想定。

## 決定

ドメインの計算規約（依存ゼロ・同期・純粋計算）は `domain/policies/` 配下に `XxxPolicy` クラス（`private constructor` + `static calculate(...)`）として配置する。リポジトリ依存ありの越境チェック（DomainService）と責務カテゴリを分け、ディレクトリも `domain/services/` と `domain/policies/` で分離する。

Entity 着手時は Policy への委譲ラッパー（選択肢C）として発展させる。

## 根拠

### 業務文書語彙との一致

業務文書（`docs/business/estimate/ユースケース一覧(見積).md`）が「計算ポリシー」と呼ぶ概念にコード語彙を合わせる。`設計書 ↔ コード` の対応が読み手に伝わりやすくなり、ドメインエキスパートとの会話でも同じ言葉が使える。

### ADR-0011 と直交する責務分離

| カテゴリ | 配置 | 依存 | 同期/非同期 | 主な責務 | 例 |
|---|---|---|---|---|---|
| DomainService (事実確認型) | `domain/services/` | リポジトリ DI | 非同期 | 越境した重複チェック | `CustomerCodeDuplicationCheckDomainService` |
| DomainService (ルール検証型) | `domain/services/` | リポジトリ DI | 非同期 | 複合ビジネスルール検証 | `SuperiorRoleValidationDomainService` |
| **Policy** | **`domain/policies/`** | **なし** | **同期** | **計算規約・純粋ロジック** | **`LineItemAmountPolicy`** |

ADR-0011 は DomainService の内部分類を定めるもので、本 ADR はその外側に新カテゴリを追加するもの。両者は補完関係にあり、ADR-0011 は引き続き有効。

### Entity 未着手時の先行実装・テスト容易性

着手順序「① 値オブジェクト → ② 計算ポリシー → ③ Entity」に沿って、Entity 未実装の段階で計算規約だけを純粋メモリ内で先行実装＋テストできる。テストは Entity 構築コードに依存しない（VO の組み合わせを直接渡せる）。

### 複数 Policy の名前空間揃え

`LineItemAmountPolicy.calculate(...)` / `EstimateAmountPolicy.calculate(...)` / `GrossProfitPolicy.calculate(...)` のように、**名前空間（規約名）+ 動詞（`calculate`）** で揃う。モジュール関数 `calculateLineItemAmount(...)` でも書けるが、複数の計算規約が並んだとき名前空間としてのまとまりが効く。

### `static class + private constructor` で「状態なしの規約」を型表明

Policy は計算規約そのものであり、状態を持たない。`private constructor()` でインスタンス化を禁止することで、「これは関数の集まりであって、new するものではない」ことを型システムレベルで表現できる。

### 委譲ハイブリッド（C）への自然な発展

Entity 着手時に `item.calculateAmounts()` 等のメソッドを追加し、内部で Policy を呼ぶラッパーにすればよい。Entity は対外インターフェースを保ちつつ、規約自体は独立した名前で再利用できる。Anemic Domain Model 批判（Fowler）にも抵触しない。

### 不採用理由

- **選択肢A（Entity 直）**: 業務文書の「計算ポリシー」語彙と乖離する。見積レベル・粗利が Entity に自然に属さず、結局カテゴリ分離が必要になる。着手順序上 Entity 未着手段階での先行実装ができない。

## 影響

- **`src/server/subdomains/estimate/domain/policies/` ディレクトリを新設**。今後の見積関連計算規約はここに追加する。
- **既存の `domain/services/` は DomainService 専用に予約**（ADR-0011 の指針はそのまま継続）。リポジトリ DI なしのクラスを `services/` に置かない。
- **将来他サブドメインで計算規約が必要になった場合（送料計算、納期計算、与信判定、価格決定など）も `domain/policies/` を新設**して同じパターンで配置する。
- **Policy の入力**: 引数が3つ以下なら位置引数、4つ以上または並列な複数値なら **入力オブジェクト型**（例: `EstimateAmountInput`）。
- **Policy の戻り値**: 中間値を保存する必要がある計算（スキーマに中間カラムがあるケース）は **結果オブジェクト型**を返す。
- **Policy 内の不変条件違反**は `BusinessRuleViolationError` を即 throw する（ADR-0011 の「ルール検証型」と同じ戦略）。Result 型は採用しない。
- **Entity 着手時はラッパーメソッド経由で Policy を呼ぶ**（委譲ハイブリッド）。Entity は「自分の状態を提供し、計算は Policy に委ねる」形に発展させる。
- **ADR-0011 は本 ADR と補完関係**: DomainService の内部分類と、Policy という別カテゴリの追加は独立した話。ADR-0011 のステータスは「採用」のまま、本 ADR への参照リンクを脚注として追記する。
- 関連: `src/server/subdomains/estimate/domain/policies/{LineItemAmountPolicy,EstimateAmountPolicy,GrossProfitPolicy}.ts`, `docs/business/estimate/ユースケース一覧(見積).md`, ADR-0011, ADR-0022
