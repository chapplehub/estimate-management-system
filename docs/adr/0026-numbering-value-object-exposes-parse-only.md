# ADR-0026: 採番系の値オブジェクトは `parse` のみを公開し、払い出しはリポジトリ層に分離する

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-05-23 |
| 最終更新日   | 2026-05-23 |

## コンテキスト

Issue #282 で見積番号 `EstimateNumber` 値オブジェクト（VO）を実装するにあたり、「番号文字列を分解する `parse`」と「次番号を払い出す `issue`」のどちらを VO に持たせるか、または両方持たせるかの判断が必要になった。

見積番号の仕様（システム設計書 §2）:
- 形式: `[接頭辞 1][年度 2][連番 5]` = 8 文字（例: `N2500001`）
- **連番は `fiscalYear + estimateType` 単位で年度ごとリセット**、欠番許容
- 採番タイミングは見積保存時（C1 `CreateEstimate`）

ユースケース棚卸し（`docs/business/estimate/ユースケース一覧(見積).md`）の「横断ポリシー」セクションは以下を明記している:

> 採番 sequence 払い出し | fiscalYear + estimateType 単位の連番（欠番許容）

つまり、**連番の払い出しはドメインの横断ポリシー**として識別されており、`EstimateNumber` VO の責務として規定されていない。

「次の連番」を決めるには:
- 現在の `fiscalYear + estimateType` で最も大きい既存連番を取得する
- それに +1 した値を返す
- 同時並行採番に対する一意性を担保する（DB のユニーク制約 + リトライ、または `UPDATE ... RETURNING` を使ったカウンタテーブル等）

これらは **永続化（リポジトリ）の関心事**であり、VO 内で完結できない。

将来、受注番号 `OrderNumber`、請求番号 `InvoiceNumber` 等も同型の採番ルール（接頭辞 + 年度 + 連番）を持つことが想定される。同じ判断を再現するための規範を残す必要がある。

## 検討した選択肢

### A. VO に `parse(text)` のみを公開、払い出しはリポジトリ層に分離（採用）

```typescript
export class EstimateNumber extends ValueObject<string, "EstimateNumber"> {
  private constructor(value: string) { super(value); }

  static parse(text: string): EstimateNumber {
    return new EstimateNumber(text);
  }
  // issue / fromParts は提供しない
}

// 払い出しはリポジトリ層の責務
interface EstimateNumberIssuer {
  issue(type: EstimateType, fiscalYear: FiscalYear): Promise<EstimateNumber>;
}
```

VO は **「保存済みの採番値を検証・分解する」純粋な責務**に閉じる。テストは入出力のみで完結し、永続化の関心事を持ち込まない。

### B. VO に `parse(text)` + `fromParts(type, year, seq)` の両方を公開（不採用）

```typescript
static fromParts(type: EstimateType, year: FiscalYear, sequence: number): EstimateNumber {
  return new EstimateNumber(`${type.prefix}${year.toShortString()}${String(sequence).padStart(5, "0")}`);
}
```

「払い出された連番（数値）からVOを組み立てる」中間ファクトリ。リポジトリ層が `INSERT ... RETURNING sequence` で得た数値を VO に変換するときに使う。

しかし以下の懸念がある:
- **連番の出所が不透明化**: `fromParts(type, year, 1)` を呼ぶ箇所が「正しく払い出された連番か」「テストで適当に渡した連番か」を見分けにくい
- **`issue()` との混在で責務境界が曖昧**: 「VO の責務 = 構築だけ」「払い出しはリポジトリ」と境界を引いたつもりが、`fromParts` を VO 経由で呼ぶ箇所が「ほぼ払い出し」のような実装になりやすい
- **YAGNI**: 当面リポジトリは「8 文字の文字列を `RETURNING` で受けて `parse` する」設計で十分

将来本当に必要になった時点で導入する判断もできる。最初から両方公開する積極理由がない。

### C. VO に `parse(text)` + `issue(type, year, sequenceProvider)` を公開（不採用）

```typescript
static async issue(
  type: EstimateType,
  year: FiscalYear,
  sequenceProvider: () => Promise<number>
): Promise<EstimateNumber> {
  const seq = await sequenceProvider();
  return EstimateNumber.fromParts(type, year, seq);
}
```

払い出し責務を VO に持たせつつ、永続化依存を関数注入で外出しする。

しかし:
- **ドメイン層が `Promise` を持ち込む**: 同期関数だった VO ファクトリが async になる。基底クラス `ValueObject` の規約と整合しない
- **責務逆転**: 「払い出しはリポジトリの責務」と明言しているのに、VO に呼び口を持たせると「形式的には VO 経由」「実質はリポジトリ操作」というねじれが生まれる
- **テストが複雑化**: モック `sequenceProvider` を毎回用意する必要がある

### D. VO ではなくドメインサービス `EstimateNumberFactory` を別に作る（部分的に採用）

`parse` を VO のメソッドに残しつつ、`issue` をドメインサービス `EstimateNumberIssuer`（interface） + インフラ実装 `PrismaEstimateNumberIssuer` として別に持つ。

これは **A の方針と矛盾しない**。本 ADR は VO の責務を限定する判断であり、リポジトリ層の実装方式は別途決める。後続 Issue（採番リポジトリ実装）で D の interface 設計を行う想定。

## 決定

採番系の VO（`EstimateNumber`、将来の `OrderNumber` `InvoiceNumber` 等）は **`parse(text: string)` のみを公開**する。連番の払い出し（次番号生成）は **リポジトリ層 / ドメインサービスの責務**として VO の外側で実装する。

## 根拠

### VO の責務を「不変条件の表明」に集約

`ValueObject<T, U>` 基底クラスの設計（`src/server/shared/ValueObject.ts`）は「不変条件を持つ値の検証と分解」を VO の主責務として規定している（ADR-0022 参照）。`parse` は「保存済み値の検証と分解」というこの責務に完全に一致する。

`issue` / `fromParts` を加えると、VO が「払い出された連番を組み立てる中間状態」を取り扱うことになり、責務が分散する。

### 永続化との結合を VO に持ち込まない

連番の払い出しには以下が必要:

- 既存最大連番の取得（DB クエリ）
- 同時並行採番に対する一意性担保（DB ユニーク制約・トランザクション・リトライ）
- 採番カウンタの永続化（あるいは見積テーブル自体への INSERT 後の `RETURNING`）

これらは **明確にリポジトリ層の関心事**。VO に呼び口を作るとレイヤリングが曖昧化する。

### テスト容易性

`parse` のみの VO は、テストが「入力文字列 → 期待される VO/エラー」という純粋な入出力で完結する。`issue` を VO に持たせると、テストでモック `sequenceProvider` や DB のスタブが必要になり、ユニットテストの粒度が大きくなる。

### 業務文書（ユースケース棚卸し）の語彙との一致

ユースケース棚卸しが「採番 sequence 払い出し」を **横断ポリシー** として独立カテゴリで扱っている事実を、コードのレイヤ分離に反映する。「文書とコードの語彙を一致させる」運用方針（ADR-0023 と同じ哲学）。

### 将来の採番系 VO への規範性

`OrderNumber`「`InvoiceNumber`」も同型の課題に直面する。本 ADR を「採番系 VO 全般の規範」として定めることで、毎回同じ議論を繰り返さない。

### 不採用理由まとめ

- **B（parse + fromParts）**: 連番の出所不透明化、責務境界の曖昧化。YAGNI
- **C（parse + 非同期 issue）**: VO が Promise を持ち込み、責務逆転
- **D（別ドメインサービス）**: 本 ADR と矛盾せず、後続 Issue で interface を設計する（本 ADR は VO 側の責務限定にスコープを絞る）

## 影響

- **`EstimateNumber` 等の採番系 VO は `parse(text)` のみを公開**。`fromParts` / `issue` 等のパーツファクトリ・払い出しメソッドを持たない
- **採番（払い出し）は別 interface（例: `EstimateNumberIssuer`）として後続 Issue で実装**。インフラ実装は `PrismaEstimateNumberIssuer`（仮）として `infrastructure/prisma/` に配置する想定
- **将来の `OrderNumber` `InvoiceNumber` 等も本 ADR を踏襲**
- **テストはユニットテスト（`parse` の入出力）に閉じる**。採番ロジックのテストは「リポジトリ＋実 DB」の統合テストで行う（ADR-0012 のテスト DB 分離方針に従う）
- **見積保存（C1 `CreateEstimate`）のフロー**は「アプリ層が `EstimateNumberIssuer.issue(...)` で `EstimateNumber` を取得 → 集約に渡して INSERT」になる
- **「連番の同時並行採番に対する一意性担保」の実装方式**（リトライ vs カウンタテーブル vs RETURNING）は本 ADR のスコープ外。インフラ実装時に別 ADR を起票するか、コミットボディに記録する
- 関連: `src/server/subdomains/estimate/domain/values/EstimateNumber.ts`, `docs/business/estimate/システム設計書(見積).md` §2, `docs/business/estimate/ユースケース一覧(見積).md`（横断ポリシー）, ADR-0022, ADR-0024
