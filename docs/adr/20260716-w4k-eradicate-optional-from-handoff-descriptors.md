# ADR-20260716-w4k: 引き継ぎ生成の記述子から optional を根絶する（維持は Required で強制・クリアは Omit・経路は分割）

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-16 |
| 最終更新日 | 2026-07-16 |

## コンテキスト

ADR-20260716-35a（#603 / #616）は「単価再解決を伴う生成（複製先・改訂先）では固定値引を持ち込まない」という不変則を、repriced 記述子の `Omit` で型強制した。だがそれは固定値引という**個別フィールドへの対処**であり、記述子の optional 全般が持つ「省略＝取りこぼしを黙認する」構造はそのまま残った（35a 自身が「repriced 記述子の optional 全般（例: `setGroups?` 必須化）は別軸の判断」として本 ADR を予告している）。

記述子の `prop?: T` は「**省略＝クリアの意図**」と「**省略＝未指定（＝元の値を維持すべき）**」を型で区別できない。引き継ぎ生成では後者しか起こりえないにもかかわらず、populate を忘れても `undefined` が有効値として通り、型システムが取りこぼしを検出できない。

実害は既に 2 度出ている。`setGroups?` の未引き継ぎが #602（複製）と #607（改訂）で噴出した。火元は共有ビルダーの

```ts
buildSetGroups(descriptor.setGroups ?? [])   // estimateChildBuilders.ts
```

で、「埋め忘れ」を「黙って空群」へ変換する実行点だった。同型の落とし穴は optional の数だけ残っており、次の引き継ぎ経路でまた静かに落ちうる。

本 ADR は 35a の機構を**固定値引だけから optional 全般へ一般化する**決定を記録する。業務判断（なぜクリアするか・何を維持するか）は ADR-20260714-pv8 / ADR-20260714-k2m の管轄であり、本 ADR は機構（どう型で守るか）を扱う。

## 検討した選択肢

### 型表現の方針

- **① 引き継ぎ経路では必須化（採用・「維持」フィールドの機構）**: 複製元・改訂元の getter は常に確定値を返す（`EstimateItem.discountRate(): DiscountRate` 等）ため、必須化しても供給元に困らない。
- **② 「未指定」と「クリア」を別トークンで区別する型表現（`T | Clear`）（不採用）**: 引き継ぎ生成ではクリア／維持の選択が**フィールドごとに型レベルで固定**されており、実行時に分岐しない——固定値引は無条件にクリア（pv8）、率・メモ・セット群は無条件に維持。値レベルのトークンが要るのは同一フィールドが呼び出しごとにクリアか維持か変わる場合だけで、そのようなフィールドは引き継ぎ経路に存在しない。加えて `Omit` は「フィールド名すら書けない」ため、`itemDiscount: Clear` と書けてしまうトークンより**強い**。表現力を落として儀式を増やすことになる。
- **③ `Omit` で経路ごとに型から消す（採用・「クリア」フィールドの機構。35a から継続）**: ①と併用し、全 optional を「必須化された維持」か「Omit されたクリア」のどちらかへ解消する。

### 必須化の実現方法

- **手で維持フィールドを列挙して必須化（不採用）**: 将来 `EstimateItemDescriptor` に optional が 1 本増えると、reprice 側へ optional のまま流れ込み穴が再び開く。しかもコンパイルは通るので誰も気づかない。「今日の穴は塞ぐが明日の穴には無力」であり、#603 が個別対処だったのと同じ轍を踏む。
- **`Required<Omit<...>>` で機械導出（採用）**: 「optional を列挙して潰す」のではなく「optional という状態そのものを型構築子で禁止する」。将来 optional が増えても `Required<>` が自動的に reprice 側で必須にし、populate 箇所が即コンパイルエラーになって「維持かクリアか」の判断を書き手に強制する。放置＝黙って落とす、が構造的に不可能になる。副次的に `Omit` の引数が「クリアすると決めたフィールドの全量」として 1 行で読めるようになり、35a の `Omit` はそのまま本方針に吸収される（別機構の共存にならない）。

### 経路で意味が変わるフィールド（`revisedDeliveryPrice`）

`RepricedItemDescriptor` は複製・改訂で共有されていたが、`revisedDeliveryPrice` の実態は経路で正反対だった——複製は一切 populate せず（複製先に改訂明細詳細は存在しない）、改訂は必ず populate する（§8.4 の明細単位粗利の比較基準）。

- **共有記述子に optional で残す（不採用）**: 改訂が書き忘れると `buildItem` の `!= null` 分岐で改訂明細詳細が黙って生成されず、§8.4 の比較基準が消える——**#602 と同型の未発火 silent data loss**。逆に複製がうっかり書けてしまい、複製先にあり得ない改訂明細詳細が生える穴も開く。
- **複製用／改訂用に割る（採用）**: `CopiedItemDescriptor`（`Omit` で名前すら書けない）と `RevisedItemDescriptor`（`revisedDeliveryPrice: Money` 必須）に分ける。これは 35a が `revisedFrom` について採った論法——「optional な `revisedFrom` を共有ビルダーに持たせると、複製・新規作成が渡せてしまい『optional＝間違えられる余地』を別フィールドで再生産する。真に共通なのは子構築で、系譜を含む最終段は本質的差異として割る」——の**適用漏れを埋めるもの**。副次的に `undefined | null | Money` の 3 状態（前 2 者が同義）が `Money` へ潰れる。

### `setGroups` の optional をどこで断つか

- **reprice 側だけ必須化（不採用）**: 発生源（`EstimateVariationDescriptor.setGroups?`）が残るため、`?? []` が `estimateChildBuilders` / `assertSetComponentsValid` / `resolveLinePrices` の 3 読点に残存し、将来の経路がまた踏む。
- **`EstimateVariationDescriptor` でも必須化し `??` をアプリ層マッパへ押し出す（採用）**: optional の発生源はドメインではなく**フォーム境界**（`setGroups?: EstimateSetGroupInput[]`）であり、それが `input.setGroups?.map(...)` でドメイン記述子へ素通しされていた。境界で `(input.setGroups ?? []).map(...)` と正規化すれば、ドメインは「ゼロ件＝`[]`」の単一表現になる。空配列はコレクションにとっての null object であり、`undefined` を併存させる理由がない。

なお `discountRate?` / `customerMemo?` / `internalMemo?` / `overallDiscount?` を `EstimateItemDescriptor` 等で optional のまま据え置くのは、次の規則による。

> **optional は「正規化する単一の所有者」が居るときだけ許す。居ないなら必須化して境界で正規化する。**

これらは `EstimateItem.create` の `?? new DiscountRate(1.0)`、`EstimateSetGroup.create` の `?? Memo.empty()`、`EstimateVariation.create` の `?? Money.zero()` が **1 回だけ**既定化し、以後 getter は常に値を返す（＝所有者が居る）。対して `setGroups` は素の記述子上にあり正規化する所有者が居らず、読み手ごとに `??` が再適用されていた。所有者不在の optional は読み手の数だけ既定値解釈が増殖し、いずれ 1 つがズレる——それが #602 である。

### 2 系統の型の書き方

- **複製系・改訂系を別々に定義（不採用）**: `Required<Omit<...>>`（＝クリア判断の全量）が 2 箇所に重複し、将来クリア対象が増えたとき**片方だけ直る余地**が生まれる。これは #602（「片方の経路だけが持っていた配線」）と同型の再生産。
- **明細型で径数化（採用）**: `RepricedVariationDescriptor<I extends RepricedItemDescriptor>` とし、複製系・改訂系はその実体化として得る。クリア判断が 1 箇所に集まる。35a の「同じ再解決生成の別実装を単一 locus へ集約する」と一貫。

### 回帰防止

- **フィールド個別の `@ts-expect-error` ガードのみ（不採用）**: 今日のフィールド名しか知らないため、将来 `RevisedItemDescriptor = RepricedItemDescriptor & { foo?: X }` のように `Required<>` の**外側**で optional を足す変更を検知できない。それでは #617 自身が「今日の optional だけ塞いだ個別対処」になり、本 ADR が否定した轍を踏む。
- **個別ガード ＋ 構造ガード（採用）**: `OptionalKeys<T> extends never` で「引き継ぎ記述子に optional キーは 1 本も存在しない」を**最終合成型に対して**固定する。フィールド名を知らずに規則そのものを検査するため、未知のフィールドにも効く。

## 決定

引き継ぎ生成（複製先・改訂先）の記述子から optional を根絶する。すなわち **①「維持」フィールドは `Required<Omit<...>>` の機械導出で必須化し、②「クリア」フィールドは `Omit` で型から消し（35a を吸収）、③ 経路で意味が変わるフィールドは複製用／改訂用に型を割り、④ 2 系統は明細型で径数化して単一定義から得て、⑤「optional キーがゼロ本」を構造ガードで固定する**。`setGroups` は発生源（`EstimateVariationDescriptor`）でも必須化し、`??` による正規化はフォーム境界のアプリ層マッパ 1 箇所へ押し出す。

## 根拠

- **optional は「正規化する単一の所有者」が居るときだけ許す。** 所有者が居る optional（`discountRate?` 等、entity の `create` が既定化）は安全で、居ない optional（`setGroups?`）は読み手の数だけ既定値解釈が増殖して必ずズレる。この規則が「どの optional を潰し、どれを残すか」の判断基準であり、フィールドの数だけ場当たりに決めない。
- **`Required<>` は変換であって不変則ではない。** `Required<Omit<...>>` が保証するのは「その式が評価された瞬間に optional が無い」ことだけで、`&` で後から optional を足す経路は塞がらない（`&` は本設計自身が `RevisedItemDescriptor` で使っている操作であり、型システムから見て正当な追加と区別できない）。構造ガードは**一度きりの変換を恒久的な検査済み不変則へ格上げする**役割を負う。
- **型は書き忘れを閉じるが、誤った値は閉じない。** `Required<>` は「このフィールドについて判断せよ」と強制できるが、判断が正しいかは見ない——改訂経路が `setGroups: []` と明示的に書けば型は通り、セット群は黙って消える。ゆえに防御は二層とし、**型ガード＝書き忘れと禁止フィールド／振る舞いテスト＝運ばれた値の正しさ**で分担する。後者は既存の #602 回帰テスト群（`EstimateDuplicationService.test.ts` / `Estimate.test.ts`）が担い、本件は挙動不変ゆえ追加を要さない。
- **業務判断と機構を責務で分ける（ADR-0011 / 35a と整合）。** pv8・k2m は「なぜクリアするか・何を維持するか」の業務判断であり、本 ADR は機構。粒度・寿命・想定読者が異なる。

## 影響

- **ADR-20260716-35a は有効なまま。** 35a の 3 決定（型で禁止する／子構築の共有ビルダー一本化／通常・改訂のバリエーション組み立て分割）はいずれも存続し、本 ADR はその機構を optional 全般へ一般化する。ただし 35a が定義した `RepricedItemDescriptor = Omit<EstimateItemDescriptor, "itemDiscount">` の定義のみ本 ADR が更新する（`Required` で包み、`revisedDeliveryPrice` を `Omit` し、複製用／改訂用に割る）。
- **`EstimateItemDescriptor` は据え置く。** 新規作成経路の optional は「所有者が既定化する」規則を満たしており正当。とくに `revisedDeliveryPrice?: Money | null` の `undefined ≡ null` 冗長は wart だが、引き継ぎ側は `Omit` して自前で定義し直すため無関係であり、締めるとテスト約 100 箇所に `null` を書き足すだけの編集が発生して費用が便益を上回る。
- **`setGroups` はドメインで必須になる。** `EstimateVariationDescriptor` / `VariationChildrenDescriptor` が必須化され、`estimateChildBuilders` / `assertSetComponentsValid` / `resolveLinePrices` の `??` は不要になる。アプリ層マッパ（`CreateEstimateCommand` / `variationContentInput`）が境界で正規化する。
- **`EstimateItem.attachRevisedDetail` / `detachRevisedDetail` を削除する。** 本番コードからの呼び出しが存在せず（テストのみ）、非改訂明細へ事後に改訂詳細を付けられる唯一の経路だった。削除により `_revisedDetail` は `create` 時確定・以後不変になり、記述子の経路分割（生成時の防御）と併せて入口・事後の双方が塞がる。
- **エンティティ分割には踏み込まない。** 「改訂先である」事実が `EstimateVariation.revisedFrom` と `EstimateItem.revisedDetail` の有無で二重に符号化され整合が守られていない構造は #620 に切り出した。`EstimateItem` を割っても二重符号化は解けず（`revisedFrom` があるバリの items は必ず改訂明細型、という不変則を型の外で守る羽目になる）、`EstimateItem`（18 ファイル）と `EstimateVariation`（29 読点）の同時分割は本 ADR とは別物の大手術になるため。
- **ビルダーの引数型は変更不要。** `Required<Omit<T, K>>` は（K が T で optional である限り）`T` へ、`RevisedItemDescriptor` は `EstimateItemDescriptor` へ構造的に代入可能なため、共有ビルダーは両系統をそのまま受ける。
- **型不変則の効力は `tsc --noEmit`（pre-push）が担保する。** 型を緩める変更が入ると `@ts-expect-error` が未使用になるか構造ガードが落ちて赤になる。
