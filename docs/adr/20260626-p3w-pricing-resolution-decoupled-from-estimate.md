<!-- ファイル名: YYYYMMDD-sss-{slug}.md（sss は base36 3桁ランダム接尾辞。詳細は ADR-0000 を参照） -->

# ADR-20260626-p3w: 価格決定オーケストレーションは estimate に依存せず、消費側がドメイン型を pricing のプリミティブ境界へマップする

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-26 |
| 最終更新日 | 2026-06-26 |

## コンテキスト

#428 で価格決定の2段解決オーケストレーション（`ResolveSellingPriceQuery`・pricing サブドメイン）を実装する。これは提出区分（得意先宛 / 納品先宛）に応じて参照する上書き層を1つ選び（得意先宛→得意先別、納品先宛→納品先別）、共通へフォールバックする（ADR-0064 / ADR-20260624-8tg）。

ここで「提出区分をオーケストレーションの入口でどう受けるか」を決める必要がある。提出区分は estimate サブドメインの値オブジェクト `SubmissionType`（`estimate/domain/values/SubmissionType.ts`・ADR-0045）として既にモデル化されている。これを pricing が入力型に使うと **pricing → estimate の逆方向依存**が生じる。

一方、#448 / #459 で実装した時点解決 QueryService 群（`CommonSellingPriceQueryService` 等）は、`customerId: string` / `deliveryLocationId: string` / `productId: string` のように**素のプリミティブ ID** を入力に取り、estimate を一切 import しない独立サブドメインとして閉じている。価格決定オーケストレーションはこの境界規約の延長線上にあり、入口の型をどちらの流儀に倣わせるかが論点になった。

## 検討した選択肢

### A. pricing 独自のタグ付き共用体（プリミティブ ID）に消費側がマップする（採用）

オーケストレーションの入口を pricing が自前で定義するタグ付き共用体とし、消費側（#430 等の estimate）が `SubmissionType` ＋ 該当宛先 ID をこの型へマップして渡す。

```ts
// pricing/application
type SellingPriceResolutionTarget =
  | { addressee: "CUSTOMER";          customerId: string;         productId: string; estimateDate: Date }
  | { addressee: "DELIVERY_LOCATION"; deliveryLocationId: string; productId: string; estimateDate: Date };
```

判別子の文字列リテラルは `SubmissionType` の Prisma 値（`"CUSTOMER"` / `"DELIVERY_LOCATION"`）に揃え、消費側の変換を素直にする（VO そのものは import しない）。

### B. pricing が estimate の `SubmissionType` を再利用する（不採用）

入口の型に `SubmissionType` を使う。型は1つで済むが pricing → estimate の逆方向依存を生む。

### C. `SubmissionType` を shared へ昇格する（不採用）

共有層へ移して両者から参照する。提出区分は見積バリエーションの不変属性（ADR-0045）であり estimate 固有の関心。価格決定のためだけに shared へ持ち上げるのは過剰で、shared に業務語が漏れる。

## 決定

価格決定オーケストレーションの入口は pricing 独自のタグ付き共用体（プリミティブ ID）とし、消費側が自らのドメイン型をこの境界へマップする（A を採用）。

## 根拠

- **依存方向の保全**: pricing は estimate に依存しない基盤サブドメインで、依存は estimate → pricing が正。`SubmissionType` 再利用（B）はこれを反転させ、pricing の独立性を崩す。
- **既存境界規約との一貫**: 時点解決 QueryService 群が既に素のプリミティブ ID を取り estimate 非依存で閉じている。オーケストレーションも同じ境界規約に従うのが自然。
- **クロス参照禁止の型排除（ADR-20260624-8tg と相補）**: タグ付き共用体により「納品先宛なのに `customerId` を渡す」不能状態を型で排除し、`addressee` での分岐が正しい上書き QueryService の選択地点になる。層別 QueryService（8tg）と合わせ、クロス参照を Policy の防御ではなく型で封じる。
- **昇格の回避**: 提出区分は estimate 固有の業務語。価格決定のためだけに shared 昇格（C）するのは関心の越境で、shared を痩せた共有層に保つ方針に反する。

## 影響

- 消費側（#430 見積接続ほか）に「`SubmissionType` ＋ 宛先 ID → pricing 入力型」へのマッピング責務が生じる。これは欠点ではなく、サブドメイン境界での型変換を消費側に明示的に置く設計判断である。
- pricing は estimate の用語（`SubmissionType` 等）を一切持ち込まない。判別子は文字列リテラルで保持する。
- 境界型（`SellingPriceResolutionTarget`）を変更すると全消費側に波及するため、後続の見積接続（#430 / #431 / #432）が依存し始める前に形を確定させておく。
- 他サブドメインが pricing の価格決定を呼ぶ場合も同じ境界規約（自前ドメイン型をプリミティブ境界へマップ）に従う。
