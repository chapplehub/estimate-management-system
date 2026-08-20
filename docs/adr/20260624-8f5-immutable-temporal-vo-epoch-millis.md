<!-- ファイル名: YYYYMMDD-sss-{slug}.md（sss は base36 3桁ランダム。例: 20260624-a3f-common-selling-price.md）。詳細は ADR-0000 を参照 -->

# ADR-20260624-8f5: 不変な時刻概念は epoch ミリ秒保持の不変VOでラップし raw Date を境界で締め出す

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-24 |
| 最終更新日 | 2026-06-24 |

## コンテキスト

Issue #404。estimate サブドメインの不変イベントVO（`StepApproval` / `StepRejection` /
`ApplicationWithdrawal`、いずれも発生日時 `occurredAt: Date` を保持）が、`create` の引数 `Date` を
そのまま内部保持し、`occurredAt` getter で内部参照をそのまま返している。

JavaScript の `Date` は `setHours()` / `setTime()` 等の mutator を持つ**可変オブジェクト**で、
代入・引数渡しは**参照渡し**になる。そのため2つの漏れ経路が開く:

- **経路1（入口共有）**: `create(actor, t)` が受け取った `t` の参照をそのまま抱えるため、呼び出し側が
  手元の `t` を後から `t.setHours(0)` で変異させると VO 内部も変わる。
- **経路2（出口共有）**: getter が内部参照を素通しで返すため、受け取った側の変異が VO 内部に及ぶ。

どちらでも「不変であるはずのイベント発生日時」と `equals`（`getTime()` 比較）の結果が**生成後に変わりうる**。
「行の存在＝承認済を写し取る不変イベント」（ADR-0058）という設計意図が型で守られていない。
`private readonly` は**束縛の張り替え**しか止めず、共有された同一オブジェクトへの変異は止められない
（ADR-0027 の「`Readonly<T>` はメソッド呼び出しを止めない」と同型の穴）。

この問題は新規イベントVOに限らず、既存 `Estimate` 集約（`estimateDate` / `deadline` 等）も raw `Date` を
保持しており、「`Date` を防御コピーするか」が estimate サブドメイン内で不統一だった。新規分だけ先行して直すと
集約間で慣習が割れるため、サブドメイン横断の方針として本 ADR で確定する。

## 検討した選択肢

### A. 防御コピー（境界ごとに `new Date(d.getTime())`）（不採用）

入口・出口の各境界で `Date` をコピーして共有を断つ。

```typescript
static create(actor: EmployeeId, occurredAt: Date) {
  return new StepApproval(actor, new Date(occurredAt.getTime())); // 入口コピー
}
get occurredAt(): Date { return new Date(this._occurredAt.getTime()); } // 出口コピー
```

動作はするが、境界が増えるたびに `new Date()` を**覚えて書き続ける**規律依存で、1箇所忘れれば穴が開く。
ADR-0027 が子エンティティについて選択肢B（防御コピーで毎回作って返す）を「集約内の生産性を犠牲にする」として
退けたのと同じ忌避が当てはまる。

### B. 不変VOで raw Date を締め出す（採用）

`Date` をドメイン概念のVOに変換し、**内部表現を epoch ミリ秒の `number`** とする。`number` は言語レベルで
不変なプリミティブで、代入・引数渡しが**値渡し（コピー）**になるため、共有という状態が原理的に発生しない。
`from(date)` で `date.getTime()` を取り出した瞬間に可変オブジェクトとの縁が切れる。

```typescript
class OccurredAt {
  private constructor(private readonly _epochMillis: number) {}
  static from(date: Date): OccurredAt { return new OccurredAt(date.getTime()); }
  static now(): OccurredAt { return new OccurredAt(new Date().getTime()); }
  equals(other: OccurredAt): boolean { return this._epochMillis === other._epochMillis; }
  toDate(): Date { return new Date(this._epochMillis); } // 毎回新インスタンスを鋳造
}
```

raw `Date` getter は設けない。出口で `Date` が要る表示/DTO 用途には `toDate()` がコピーを返す（経路2を封鎖）。
内部に可変オブジェクトを持たないため防御コピーの規律自体が不要になり、不変性を「言語の値セマンティクス」に
肩代わりさせられる。

### C. 何もしない（入力側で変異させない不変条件に依拠）（不採用）

レビュー指摘#6 が「altitude の判断」「組織マスタ側の制約で担保されるなら不要」と示した立場。
起票動機（不変であるはずの値が事後に変わる）を**構造的には**潰さず、慣習依存で穴が残る。

## 決定

estimate サブドメインの不変な時刻概念は、**epoch ミリ秒（`number`）を内部表現とする不変VOでラップ**し、
ドメインAPI から raw `Date` を締め出す（選択肢B）。raw `Date` ↔ VO の変換は infra 境界（Mapper の `from`）と
ドメインの現在時刻取得（`now`）の2点に限定し、VO は raw `Date` getter を持たず `toDate()` でコピーを返す。

## 根拠

- **構造で守る > 規律で守る**: `number` 化により可変オブジェクトが VO 内に存在しなくなり、防御コピーの
  撒き忘れという失敗モードが消える。ADR-0027 が防御コピーを退けた哲学と整合する。
- **VO 文化との一貫性**: 本リポジトリは `FiscalYear`（ADR-0024）・`Money`（ADR-0022）・`Numbering`（ADR-0026,
  parse-only 露出）と「基本型をドメイン概念でVO化し不変性を型で守る」前例を積んでいる。`Date` は標準に不変な
  プリミティブ版が無い特殊な型であり、自前VOでラップする本決定はその延長線上にある。
- **instant の意味論**: epoch millis は TZ 非依存の絶対時刻。発生日時（occurredAt）は instant であり、暦計算
  （JST 境界判定＝ADR-0025）は presentation の関心として VO 外に置く。

## 影響

- **適用範囲（段階移行）**: 本 ADR は発生日時 `occurredAt`（3イベントVO）に先行適用する。命名は estimate の
  ユビキタス言語に合わせ `OccurredAt`（estimate ドメイン内配置）とし、実需が出れば shared への昇格を妨げない。
- **業務日付は別 issue**: `Estimate.estimateDate` / `deadline`（date-only の業務日付）は instant ではなく
  別概念のため #454（優先度 low）へ分離。本 ADR の方針（不変VOで raw Date を締め出す）を踏襲する。
- **監査列は対象外**: `createdAt` / `updatedAt`（永続化由来のタイムスタンプ）はドメインが能動的に意味付けする
  概念ではないため VO 化しない。
- **非対称の許容**: 移行途上、`occurredAt` はVO・`estimateDate` は raw `Date` という非対称が一時的に生じる。
  本 ADR がその理由（occurredAt 先行）を記録する。
- **イベントVO API の破壊的変更**: `create` は `OccurredAt` を受け取り、getter は `OccurredAt` を返す。
  ドメイン内の現在時刻取得は `OccurredAt.now()` に寄せる。出口に本番消費者が無い（読み取りモデルは
  ADR-0058 により Prisma 行から導出）ため、追従はテストに限られる。
- **関連**: ADR-0027（防御コピー忌避）/ ADR-0024・0022・0026（VO 化前例）/ ADR-0058（occurredAt = イベント行
  の createdAt）/ ADR-0025（日時境界判定は JST 純関数）。
