# ADR-0022: ドメインの金額表現に Money パターン（整数最小単位 + Currency）を採用する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-05-23 |
| 最終更新日   | 2026-05-23 |

## コンテキスト

ドメイン層に金額が登場する場面が増えていく（見積・受注・原価・請求・仕入など）。金額計算には以下の3つの制約がある:

1. **浮動小数誤差を許容できない**: `0.1 + 0.2 !== 0.3` のような誤差は会計系で致命的。掛率・税率の乗算で誤差が累積する。
2. **CLAUDE.md の DDD レイヤリングルールにより、ドメイン層は外部ライブラリ（Prisma / Next.js / decimal.js 等）を import 不可**: 浮動小数誤差を解決する定番ライブラリ `decimal.js` / `big.js` が使えない。
3. **DB スキーマは `Decimal(12,2)`**（円精度ではなく銭精度）: 単価などに銭（小数2桁）が入りうる前提。

Issue #279「金額計算の値オブジェクト + 計算ポリシー」着手時にこの判断が必要になった。今ここで決めないと、estimate サブドメインの実装後に order / invoice / cost 等で同じ判断を繰り返すことになり、サブドメイン間で表現が割れるリスクがあった。

## 検討した選択肢

### A. `number` を直接保持する（不採用）

```typescript
class EstimateItem {
  unitPrice: number; // 100.5 円
}
```

最も素朴な実装。だが `100.5 * 0.95 === 95.475`（OK）でも、続く `95.475 * 1.1 === 105.0225000000001`（誤差発生）のように、複数演算で誤差が累積する。会計系で許容できない。

### B. `decimal.js` を import する（不採用）

```typescript
import Decimal from "decimal.js";
class Money {
  amount: Decimal;
}
```

業界の定番。誤差ゼロ・API も豊富。

しかし CLAUDE.md の DDD ルール **「Domain layer MUST NOT depend on infrastructure, application, or presentation layers / MUST NOT import Prisma, Next.js, or any external libraries」** に抵触する。ドメイン層の純粋性（環境非依存・テスト容易性）と引き換えになる。

### C. 整数最小単位 + Currency（採用）

```typescript
class Currency {
  static readonly JPY = new Currency("JPY", 2); // scale=2（銭精度）
}

class Money {
  private constructor(
    private readonly _minorUnits: number, // 整数の銭
    private readonly _currency: Currency
  ) {}
}
```

金額を **整数の最小単位** で内部保持し、`Currency` 値オブジェクトと対で表現する（Martin Fowler の Money パターン）。加減算・整数倍は整数演算で誤差ゼロ。掛率・税率の比率適用は `numerator`（10^scale 倍した整数）による整数除算で表現する。

## 決定

ドメイン層の金額は `Money` クラスで内部表現を **整数の最小単位（JPY なら銭）** に統一する。通貨情報は `Currency` 値オブジェクトと対で保持する。掛率・税率も `numerator`（整数分子）+ `SCALE` の形で表現し、整数演算で適用する。

## 根拠

### 浮動小数誤差ゼロを純粋 TypeScript で実現できる

加減算・整数倍は整数演算で誤差ゼロ。比率適用（掛率・税率）も `Math.trunc((minorUnits * numerator) / 10^scale)` の整数除算で、結果は常に整数（銭精度）。

### DDD ルールを破らない

外部ライブラリ依存ゼロで、`Money` / `Currency` / `DiscountRate` / `TaxRate` すべて標準 TypeScript の数値演算だけで完結する。テストは純粋メモリ内、Prisma も Next.js も不要。

### Currency の `minorUnitScale` で通貨ごとの精度を管理

JPY は scale=2（銭精度、ISO 4217 では 0 桁だが DB の `Decimal(12,2)` に合わせる）。将来 USD（scale=2）や JOD（scale=3）を追加するときも、`Currency` 定数を増やすだけで Money の演算ロジックは不変。

### 「銭未満」と「円未満」の 2 段階丸めが自然に表現できる

掛率・税率の比率適用 (`applyRate`) は **銭未満で切捨**（整数除算で自動）、§8.1 の「端数切捨」は **円未満で切捨** (`truncateToMajorUnit`) と、丸め単位が業務概念ごとに分かれている。Money の丸めメソッド（`truncateToMajorUnit` / `ceilToMajorUnit` / `roundToMajorUnit`）に集約することで、業務ルール（§8.1 切捨／§8.3 選択式）が「どの丸めを呼ぶか」の選択として表現できる。

詳細は `learning/money-integer-arithmetic.md` 参照。

### 不採用理由

- **選択肢A（number 直）**: 浮動小数誤差の累積が会計系では致命的。検出も困難（テストが偶然通ってしまう）
- **選択肢B（decimal.js）**: CLAUDE.md の DDD レイヤリングルールに抵触。ルールを曲げてまで採用する利得は薄い（整数演算で同じ結果が得られる）

## 影響

- **新規サブドメインで金額を扱うときは `@subdomains/estimate/domain/values/{Money,Currency}` を import して使う**。estimate 以外のサブドメインに同種の VO を作るのではなく共有する（将来必要になったら `shared/domain/values/` へ昇格させる）。
- **Prisma スキーマ（`Decimal(12,2)`）⇔ Money の変換は infrastructure 層に集約する**。Repository 実装で `prismaRow.unitPrice.toNumber()` → `Money.fromMajorUnits(...)` の変換を行う。
- **掛率・税率の VO は `numerator` と `SCALE` を必ず公開する**。`Money.applyRate(rate.numerator, Rate.SCALE)` の形で適用する API になる。
- **端数処理の関心事は Money の丸めメソッドに集中する**。Policy / Service / Entity は「どの丸めを呼ぶか」を選択するだけで、丸めロジック自体は持たない。
- **粗利率のような「比率」は Money ではなく `number` で返す**。Money は通貨を持つ概念、比率は次元のない値（dimensionless）として型レベルで分離する。
- **新たな通貨追加時は `Currency` 定数を1つ足すだけ**。Money の演算ロジック・テストは変更不要。
- 関連: `learning/money-integer-arithmetic.md`, `src/server/subdomains/estimate/domain/values/{Money,Currency,DiscountRate,TaxRate}.ts`
