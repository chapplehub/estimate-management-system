# ADR-0034: メモ任意項目を null ではなく空値 Null Object で表現する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-03 |
| 最終更新日 | 2026-06-03 |

## コンテキスト

Issue #286 で `EstimateItem` / `EstimateVariation` の `customerMemo` / `internalMemo` を値オブジェクト `Memo` 化した際、任意項目であることから当初は `Memo | null` を採用した（本 Issue 計画「論点2」）。

その結果、`EstimateMapper` に「DB の `string | null`」と「ドメインの `Memo | null`」という2つの null 表現を変換する分岐が漏れ込んだ:

```ts
// 読み（toDomain）
customerMemo: v.customerMemo ? new Memo(v.customerMemo) : null,
// 書き（scalarData）
customerMemo: v.customerMemo?.value ?? null,
```

この分岐は `Memo | null` を使う限り境界で必ず発生し、さらに `Memo | null` がエンティティ全体（フィールド / ゲッター / `change*` / `create` / `reconstruct`）に伝播して利用側に null 判断を漏らし続ける。プロジェクトの NULL 徹底排除方針（kawasima デシジョンツリー準拠）とも噛み合わない。

## 検討した選択肢

### 0. `Memo | null`（不採用 / 当初案の撤回）

ドメイン・DB 双方に null が残り、Mapper に null 分岐が漏れる。上記の問題そのもの。

### A. 空値 Null Object（サブクラス無し）＋ 静的ファクトリ `Memo.create`（採用）

「メモ未入力」を null ではなく空 Memo（`value === ""`）で表現し、`null → 空` の正規化を `Memo.create` の1点に集約する。

```ts
export class Memo extends StringValueObject<"Memo"> {
  protected static readonly LABEL = "メモ";
  protected static readonly MAX_LENGTH = 2000;

  private constructor(value: string) {
    super(value.trim());
  }

  /** 任意入力の唯一の入口。null / undefined / 空白 はすべて空 Memo に正規化する。 */
  static create(value: string | null | undefined): Memo {
    return new Memo(value ?? "");
  }

  static empty(): Memo {
    return Memo.create(null);
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }
}
```

エンティティの memo は常に非null の `Memo`、DB 列は `String @default("") NOT NULL`。Mapper は `Memo.create(row.customerMemo)` / `memo.value` で分岐無く変換できる。

### B. nullable コンストラクタ（不採用）

`new Memo(value: string | null)` とし ctor 内で null を吸収。`new` 流儀で最も一貫するが、`StringValueObject` ファミリの「string から作る」一様な形から外れる。なお LSP 違反ではない（ctor は継承されず多態呼び出しもされない）。あくまで「ファミリの形の純度」の問題。

### C. 厳格 ctor + 呼び出し側 `?? ""`（不採用）

ctor は純粋に保ち、各呼び出し側で `?? ""` する。null 判断が呼び出し側に漏れ、当初の不満点が再発する。

### D. 多態サブクラス `NullMemo`（不採用）

`class NullMemo extends Memo` で `forDisplay()` 等を override する正統な多態 Null Object。多態サブクラスが空値版に勝てるのは「不在」と「空値」で分岐させたい派生メソッドがあるときだけ。現状の `Memo` は `.value` を返すだけで派生の振る舞いが無く、`NullMemo` と `new Memo("")` は振る舞いが完全一致するため、型を増やす対価が無い。

## 決定

任意項目の memo を `Memo | null` ではなく **常に非null な `Memo`（空が未入力）** とし、`null → 空` の吸収を **`Memo.create` の1点** に集約する。DB 列も `NOT NULL default ''` に移行して永続化層からも null を排除する。

## 根拠

- **NULL 排除方針との整合**: ドメインからも DB からも null を消せる。
- **意味論的に正直**: 自由文 memo では「空メモ」と「メモなし」に業務的な差が無く、両者が等価なときに限り Null Object は嘘にならない（対比: NULL に「未発注」等の意味を持たせる列では Null Object は不正）。
- **複雑性の消滅**: Mapper の分岐が消え、フィールド型を非null `Memo` にした瞬間、型システムが下流の非null を保証する。null 吸収は `create` の `?? ""` 1点に集約される。
- **ファクトリ（A）を `new`（B/C）より優先する理由**: コードベースは既に `new`（`ItemName` / `Quantity` / `TaxRate`）と ファクトリ（`Money.fromMajorUnits` / `EstimateNumber.parse` / `SubmissionType.from`）を「生成時に変換が要るか」で使い分けている。`Memo.create` は「null→空 正規化」という実変換を伴うため、この既存の軸に整合する。
- **多態（D）不採用**: 派生の振る舞いが無く、空値版と完全に等価のため（参照: `learning/value-object-vs-result-object-for-staged-amounts.md`「型を作らない勇気」）。

## 影響

- `create` の memo 引数は非null `Memo`（省略時 `Memo.empty()`）とし、呼び出し側が `Memo.create(rawInput)` で VO 化する（`ItemName` / `Unit` と対称）。
- `StringValueObject` ファミリの中で `Memo` だけ生成入口が `create`（ファクトリ）になり、`new` 直書きの VO と生成形が割れる。これは「変換を伴う生成はファクトリ」という既存方針で正当化される。
- 「空メモ」と「メモなし」を区別したい業務要件が将来生じた場合、この決定（両者等価）は破綻する。そのときは nullable へ戻すのではなく、区別を表す明示的な状態を導入して再検討する。
- 将来 `Memo` に「不在のとき空文字処理と異なる見せ方をする派生メソッド」（例: 帳票で接頭辞付与、空なら行削除）が生えたら、その時点で多態サブクラス（D）へ部分昇格する。
