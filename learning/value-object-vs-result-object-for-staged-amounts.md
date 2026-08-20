# 段階金額を独立VOにするか、Policy+結果オブジェクトで返すか

作成日: 2026-05-23

## 概要

`LineItemAmountPolicy.calculate(...)` は `baseAmount` / `discountedAmount` / `finalAmount` の 3 つの金額（設計書 §8.1 の (1)-(3)）を計算して返す。

設計案として 2 つある:

- **A. 段階ごとに独立した値オブジェクトとして定義する**
  `class BaseAmount` / `class DiscountedAmount` / `class FinalAmount` を作り、それぞれの振る舞い・不変条件を持たせ、Policy で組み合わせる
- **B. Policy 内部で Money のまま組み立て、結果オブジェクト（プロパティ名 = 段階名）で返す（現状の採用案）**
  3 段階の区別は型ではなくプロパティ名で表現

本ノートは、この選択のトレードオフと「現状 B を選んだ理由・将来 A 寄りに振るシグナル」を整理する。値オブジェクト設計の "型のインフレ vs 概念の分節" の判断基準として、estimate サブドメイン以外（order / invoice / cost）にも適用できる。

## 詳細

### トレードオフ一覧

| 観点 | A. 段階ごとに VO | B. 現状（Policy + 結果オブジェクト） |
|---|---|---|
| 型による取り違え防止 | ◎ 関数引数の取り違えを型でブロック | △ どれも `Money`。プロパティ名頼り |
| 不変条件の局在化 | ◎ 「`FinalAmount` は非負」を constructor で守れる。Policy の `isNegative()` チェックが消える | ○ Policy 内で守る。型は表現しない |
| 業務文書 (§8.1) との対応の見通し | △ 3 ファイル＋Policy を読む必要 | ◎ 1 ファイルで (1)-(3) の順序が読める |
| 値オブジェクトのインフレ耐性 | × 「割引前小計」「税抜小計」など増えるたび型爆発 | ◎ Money 1 つで吸収。プロパティ名で表現 |
| 集約再構成（Repository → Entity） | × DB から `finalAmount` だけ復元したくても、`BaseAmount → DiscountedAmount → FinalAmount` の生成系譜を辿る必要 | ◎ DB 保存値をそのまま Money として復元できる |
| テスト容易性 | ○ 各段階を単体テスト可（結合は別途） | ◎ Policy 1 関数の入出力で完結 |
| fluent API | ◎ `base.applyDiscount(rate).subtractItemDiscount(d)` が書ける | △ Policy 内に固定 |
| ボイラープレート | × 3 クラス分（equals / factory / getter） | ◎ ゼロ |
| 同じ "100 円" 同士の加算 | × 段階が違うと型違いで弾かれる。再変換コスト発生 | ◎ そのまま `add` 可能 |
| 業務語彙の表現力 | ◎ 型名がそのまま語彙 | ○ プロパティ名で表現（弱め） |

### 値オブジェクト昇格の判定基準（Evans / Vernon）

VO に切り出す利得が出るのは、次の **どれかが強い** とき:

1. **固有の不変条件**がある（例: 「FinalAmount は非負」「TaxAmount は端数処理済み」）
2. **固有の振る舞い**がある（他の Money では呼べないメソッド）
3. **取り違えると業務的に致命的**（通貨をまたぐ、税抜と税込の混在など）

今回の段階金額を評価すると:

- **①は弱い**: `FinalAmount` の「非負」のみ。他 2 つは Money の不変条件と同じ
- **②は弱い**: `BaseAmount.applyDiscount(rate)` を生やせるが、`Money.applyRate(...)` の薄いラッパーになる
- **③は弱い**: 同じ通貨・同じ精度なので、取り違えても DB 保存値としては「同じ意味の Money」

→ **値オブジェクトに昇格させる利得が薄い段階**。これが Policy + 結果オブジェクトに落ち着く理由。

### 現状 B を選ぶ正当化の核

> 同じ通貨・同じ精度の Money に対する **"計算過程の位置"** を、型ではなく結果オブジェクトのプロパティ名で表現する

これは「型 ≠ 新しい概念」の境界判断。同じ意味の値に違う型を付けると、加算・比較・保存・復元のたびに変換が走り、**抽象化のためのコードが本来のドメインコードを上回る**（抽象化の負債）。

### 「Money を太らせる」戦略との関係

現状の設計は **金額の関心事を Money に集約する**戦略を採っている:

- 加減算・整数倍 → `Money.add` / `Money.subtract` / `Money.times`
- 比率適用 → `Money.applyRate`
- 端数処理 → `Money.truncateToMajorUnit` / `roundToMajorUnit`
- 不変条件チェック → `Money.isNegative` / `Money.isZero`

このため、段階ごとに型を割らなくても、Policy 側のコードは「Money に話しかけるだけ」で書けて薄っぺらにならない。**Money の太らせ方が十分なら、段階 VO は不要**になりがち。

### Primitive Obsession の反対側の罠

DDD の Anemic Domain Model 議論を逆方向に振りすぎると、**薄いラッパー型が爆発して可読性が下がる**。これは Primitive Obsession の反対側の罠で、明示的な名前はあるものの:

- 加算のたびに `BaseAmount.toMoney() + DiscountedAmount.toMoney()` のような変換
- 「集計型」「比較型」「集約型」など二次・三次の型が芋づる式に必要になる
- Repository のマッピングコードがコンビナトリアルに増える

値オブジェクト設計の上達は「**型を作る勇気**」より「**型を作らない勇気**」のほうが難しい。

### TypeScript 特有の落とし穴: structural typing

```typescript
class BaseAmount { constructor(public value: number) {} }
class FinalAmount { constructor(public value: number) {} }

function totalize(a: FinalAmount) { /* ... */ }
const b: BaseAmount = new BaseAmount(100);
totalize(b); // 形が同じなのでコンパイル通る！
```

TypeScript は構造的型システムなので、同じ形のクラスは互換扱いされる。型で取り違えを防ぐには:

- `private` フィールドを持たせる（最も自然）
- branded type で `__brand: "BaseAmount"` を埋め込む

つまり「型を分ければ取り違え防止できる」というのは TypeScript では **追加の工夫が必要**。Java/C# の名前的型システムを前提にした DDD の議論をそのまま持ち込めない。

### 業務文書側の語彙構造との一致

業務文書（`docs/business/estimate/ユースケース一覧(見積).md` の §8.1）は「**計算順序**」中心の語彙（(1)→(2)→(3)）であって、各段階を独立概念として扱っていない。業務側が "BaseAmount" を独立概念として扱っていないなら、コード側も独立型にする必要は薄い。

**業務語彙の構造（順序 vs 概念分節）にコード語彙を合わせる**のが、ドメインエキスパートとの会話を成立させるコツ。

### 将来 A 寄りに振るシグナル

次が出てきたら、その時点で部分的に VO 昇格を検討する:

1. **`FinalAmount` の "非負" 不変条件を、複数の Policy で再利用したくなった**
   （例: 見積レベルの `afterOverallDiscount` も同じルール）
   → `NonNegativeAmount` のような **共有 VO** に昇格
2. **段階金額に集計や統計などの振る舞いを足したくなった**
   （例: 複数明細の `finalAmount` を集計して粗利を求める）
   → 専用の `FinalAmount[]` の集合操作型に
3. **取り違え事故が現実に起きた**
   テストやレビューで複数回検出された段階で

「想像上の取り違え」を理由に型を増やすのは禁物。**実際に困った段階で部分昇格する**のが健全。

## 参考

- `src/server/subdomains/estimate/domain/policies/LineItemAmountPolicy.ts`
- `src/server/subdomains/estimate/domain/values/Money.ts`
- `docs/business/estimate/ユースケース一覧(見積).md` §8.1
- `docs/adr/0022-money-pattern-for-domain-amounts.md` （Money パターン採用の根拠）
- `docs/adr/0023-domain-policies-directory-for-calculation-rules.md` （Policy 配置の根拠）
- `learning/money-integer-arithmetic.md` （2 段階丸めの整理）
- `learning/ddd-value-object-inheritance.md` （値オブジェクト設計の関連メモ）
- Martin Fowler, "Anemic Domain Model" / "Primitive Obsession"
- Eric Evans, *Domain-Driven Design*（Value Object の章）
- Vaughn Vernon, *Implementing Domain-Driven Design*（VO 昇格の判定基準）
