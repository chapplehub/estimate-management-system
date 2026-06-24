# JavaScript のプリミティブ／オブジェクトと不変性

作成日: 2026-06-24

## 概要

「なぜ `Date` は可変で `number` は不変なのか」「`Number` オブジェクトは存在するのか」を整理した。
Issue #404 で「不変VOの内部表現を `Date` ではなく epoch ミリ秒の `number` にする」判断の根拠になる、
JS の値の分類・値セマンティクス・オートボクシングの知識。

## 詳細

### 値は2分類：プリミティブ（不変）とオブジェクト（可変たりうる）

- **プリミティブ**: `number` / `string` / `boolean` / `null` / `undefined` / `symbol` / `bigint`。**不変**。
  値そのものを書き換えるメソッドが言語に存在しない。
- **オブジェクト**: `Date` / 配列 / `Map` / プレーンオブジェクト等。中身を書き換える mutator を持ちうる**可変**。

`Date` が可変なのは `setHours()` / `setTime()` など「自分自身の内部状態を書き換えるメソッド」を持つから。
`number` には `42.setSomething()` のような自己書き換えメソッドがそもそも無い。
→ 可変性は「ラッパーか否か」ではなく「自己書き換えメソッドを持つか」で決まる。

### 再代入（reassign）≠ 変異（mutate）

```typescript
let n = 42;
n = 43;   // 「変異」ではなく「再代入」。束縛を別の値に張り替えただけ。42 という値自体は不変
```

`const n = 42` にすれば再代入も封じられる。これは binding immutability の話で、値の不変性とは別レイヤ。

### 決定的な違い：値渡し（value semantics）vs 参照渡し（reference semantics）

```typescript
// number: 値がコピーされる → 共有が原理的に発生しない
let a = 100; let b = a; b = 200;
console.log(a); // 100（a は無傷）

// Date: 同じオブジェクトへの参照が渡る → 片方の変異が両方に見える
const x = new Date(); const y = x; y.setHours(0);
console.log(x.getHours()); // 0（x も変わる）
```

Issue #404 の漏れ経路（入口/出口での Date 参照共有）はこの reference semantics が原因。
内部を `number`(epoch millis) にすると `from(date)` で `date.getTime()` した瞬間に可変オブジェクトとの縁が切れ、
以後 VO が握るのはコピー不可能な「値」だけになり、共有が成立しない＝防御コピー不要で構造的に安全。

### `Number` オブジェクトは存在するが使わない

```typescript
const a = 42;              // プリミティブ          typeof a === "number"
const b = new Number(42);  // ラッパーオブジェクト   typeof b === "object"

b.foo = "bar";   // プロパティ追加は可能だが…
+b;              // 42。中の「数値」を書き換えるメソッドは無い → 本質的に不変
```

`new Number()` を使わない理由：

```typescript
new Number(42) === new Number(42); // false（参照比較）
new Number(0) ? "truthy" : "falsy"; // "truthy"（オブジェクトは常に truthy。0 なのに！）
```

実務では不要：プリミティブにメソッドを呼ぶと JS が一時的に `Number` で包んで実行し即捨てる
（**オートボクシング**）。だから `(42).toFixed(0)` がプリミティブのまま動く。
同じ構図が `String` / `Boolean` にもある（`new String("x")` は使わない）。

### Date だけが特殊

`number` / `string` / `boolean` には不変なプリミティブ版があるが、**日時にはプリミティブ版が無い**。
`Date` しか標準に無く、それが可変。だから JS で日時を不変に扱うには
(1) 自前でラップする（不変VO）か (2) epoch millis という `number` に落とす しかない。

## 参考

- 関連: `learning/raw-date-in-domain-and-immutable-wrapper-vo.md`（Issue #404 の本筋）
- MDN: Number() constructor は `new` なしで使うのが推奨。プリミティブラッパーの `new` 利用は非推奨
- Issue #404 / #454
