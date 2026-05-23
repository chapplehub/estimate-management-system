# ADR-0024: 年度 (FiscalYear) を独立 VO として shared/domain/values/ に配置する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-05-23 |
| 最終更新日   | 2026-05-23 |

## コンテキスト

Issue #282「採番 `EstimateNumber` 値オブジェクト（§2 の形式・年度算出）」着手時に、見積番号の年度部（4 月始まり、2 桁表記）を扱うコンポーネントが必要になった。

年度の扱いは見積採番（§2）に閉じる話のように見えるが、実際には複数領域に登場する:

- **見積採番**: 接頭辞 + 年度 2 桁 + 連番 5 桁（§2）
- **消費税率マスタ**: 適用年度ごとの税率変更（§8.7、`tax_rates.fiscal_year` 等の検討箇所がある）
- **締切管理**: 月次・年次の業務締め（§12.1）
- **集計・分析**: 年度別の売上・粗利集計
- **受注・請求**（将来）: 同様に年度単位の管理が想定される

これらすべてに「4 月始まり・年度境界判定」というドメインルールが共通している。各領域で `getFiscalYear(date)` のような関数を再実装すると、境界判定（特に 3/31 ↔ 4/1 の JST 境界）が分散し、ロジックの一貫性とテスト容易性が低下する。

## 検討した選択肢

### A. EstimateNumber 内に閉じた private な計算ユーティリティとして実装する（不採用）

```typescript
class EstimateNumber {
  static parse(text: string): EstimateNumber {
    const yearShort = parseInt(text.substring(1, 3), 10);
    // 年度の概念は EstimateNumber の内部実装詳細
  }
}
```

本 Issue のスコープを最小にできる。EstimateNumber がパース時に内部で 2 桁年度を扱うだけなら、独立した VO は不要。

しかし、税率マスタや締切管理で同じ「JST 4 月始まり」のロジックが必要になった時点で再実装する羽目になる。境界判定の一貫性を保証する仕組みが弱い。

### B. estimate サブドメイン内に `FiscalYear` VO を配置する（不採用）

```
src/server/subdomains/estimate/domain/values/FiscalYear.ts
```

estimate サブドメインで生まれた概念なので素直な配置。しかし、税率マスタ（estimate の外側）や受注・請求が利用するときに、サブドメインを跨いで estimate の VO を import することになる。

DDD のサブドメイン境界の観点から、横断的概念をサブドメイン固有領域に置くと「どのサブドメインが持ち主か」が曖昧化する。

### C. shared/domain/values/ に独立 VO として配置する（採用）

```
src/server/shared/domain/values/FiscalYear.ts
```

横断的な値オブジェクト（既存の `CompanyCode` `EntityId` 等と同列）として `shared` に置く。サブドメイン間で衝突なく再利用でき、税率マスタ・締切管理・集計のいずれからも import できる。

### D. 値オブジェクトではなく純粋関数ユーティリティとして実装する（不採用）

```typescript
// src/server/shared/utils/fiscalYear.ts
export function fiscalYearOf(date: Date): number { ... }
export function fiscalYearToShort(year: number): string { ... }
```

軽量で実装が単純。

しかし以下を失う:
- **型による不変条件の表明**: `number` のままだと「これは年度です」という意図が型に出ない。`new FiscalYear(2025)` か `new FiscalYear(20)` か紛らわしい（後者は範囲外で reject される設計が VO なら可能）。
- **`equals` 等の振る舞いの一貫性**: ValueObject 基底クラスの規約に乗らない。
- **既存パターンとの整合**: 他の横断的概念（`CompanyCode` 等）はすべて VO として実装されている。

## 決定

`FiscalYear` を `src/server/shared/domain/values/FiscalYear.ts` に独立 VO として配置する。内部表現は西暦 4 桁数値（`number`）。`ValueObject<number, "FiscalYear">` を継承し、`from(date: Date)` ファクトリと `toShortString()` を提供する。

## 根拠

### 横断的概念に対する shared/ 配置の既存パターン踏襲

`shared/domain/values/` には既に複数サブドメインで使う VO が並んでいる: `CompanyCode` `CompanyId` `CompanyName` `EntityId` `MailAddress` `PhoneNumber` `Address` `PostalCode` `Prefecture` `FaxNumber`。

これらは「特定サブドメインの所有物ではないが、業務全体で再利用される」基本概念。`FiscalYear` も同じカテゴリに属する。配置先の判断に新規パターンを持ち込まず、既存規範に沿わせる。

### 境界判定ロジックの集約

4 月始まり年度の境界（JST 3/31 23:59:59 → 2024 年度 / JST 4/1 00:00:00 → 2025 年度）は、各領域で独立に実装するとミスが起きやすい。`FiscalYear.from(date)` 1 箇所に集約し、テストもそこに集約することで境界バグの再発を防ぐ。

なお、JST 固定の TZ 取り扱いについては [ADR-0025](0025-jst-fixed-pure-function-in-domain-layer.md) を参照。

### 内部表現に 4 桁数値を採用（2 桁数値や文字列は不採用）

- **2 桁数値（25）**: 100 年衝突時に世紀情報を失う（25 が 2025 か 1925 か）。VarChar(8) の見積番号スキーマも内部的には世紀の区別を要求しないが、VO としては情報を保全すべき。
- **文字列（"25"）**: 算術演算（前年度比較、年度差計算）ができない。年度差計算は将来「過去 5 年分の集計」「前年同期比」等で必須。
- **4 桁数値（2025）**: 算術演算可能、世紀情報を保全、`toShortString()` で 2 桁化は一方向に派生可能。

### YAGNI に対する反論

「今は EstimateNumber でしか使わないので estimate サブドメイン内に置けばよい」という反論が成立しうる。しかし、税率マスタ（§8.7、`tax_rates` テーブル設計済み）は既に年度単位の運用が決定しており、近い将来 import 元になることが既知。後で shared に移す手戻りより、最初から shared に置く方が安い。

## 影響

- **`src/server/shared/domain/values/FiscalYear.ts` を新設**。今後、年度概念を扱うコードはこの VO を import する。
- **税率マスタ実装時に再利用される想定**。`tax_rates.fiscal_year` の型を `FiscalYear` で扱うことで、年度単位の整合性チェックが集約される。
- **将来 Order / Invoice サブドメインを実装する際もここから import**。年度概念の重複実装を禁止する。
- **EstimateNumber は `parse` 内で `new FiscalYear(2000 + YY)` として復元**。年度部の解釈責務は VO に委ねる。
- **`from(date)` の TZ 取扱い**は [ADR-0025](0025-jst-fixed-pure-function-in-domain-layer.md) に従う（JST 固定の純関数）。
- 関連: `src/server/shared/domain/values/FiscalYear.ts`, `src/server/subdomains/estimate/domain/values/EstimateNumber.ts`, `docs/business/estimate/システム設計書(見積).md` §2 §8.7 §12.1, ADR-0025, ADR-0026
