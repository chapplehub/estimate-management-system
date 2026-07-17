<!-- ファイル名: YYYYMMDD-sss-{slug}.md（sss は base36 3桁ランダム。例: 20260624-a3f-common-selling-price.md）。詳細は ADR-0000 を参照 -->

# ADR-20260717-w4d: 引き継ぎ生成の記述子は痩せた共有核を加算拡張して組み立て、減算共通化（Omit / Required<Omit<>>）を用いない

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-17 |
| 最終更新日 | 2026-07-17 |

## コンテキスト

ADR-20260716-35a（#603）は「単価再解決を伴う生成（複製先・改訂先）では固定値引を持ち込まない」という業務判断（ADR-20260714-pv8・#598）を型で強制するため、`RepricedItemDescriptor = Omit<EstimateItemDescriptor, "itemDiscount">` という**減算共通化**を採った。豊かな全部入りの記述子を起点に、経路ごとに要らないものを `Omit` で削っていく方式である。

この方式は不変則そのものは守れたが、機構として 3 つの歪みを生んだ。

第一に、**禁止フィールドが一度型の中に現れてから消える**。`itemDiscount` は `EstimateItemDescriptor` に存在し、`Omit` を書き忘れた経路・新設された経路では静かに復活する。禁止は「消し続ける」努力で維持され、既定値は「許可」のままになる。

第二に、**経路が増えるたび `Omit` が増殖する**。`RepricedSetGroupDescriptor` は `Omit<..., "components"> & { components: RepricedItemDescriptor[] }`、`RepricedVariationDescriptor` は 3 フィールドの `Omit`、`EstimateDuplicateInput` は `Omit<EstimateFactoryInput, "variations">` と、削っては足し直す記述が層ごとに積み上がった。読み手は「何が入っているか」を、元の型から引き算を暗算して復元しなければならない。

第三に、#617 が**この歪みを誤診した**。#617 は「共通部分が `Omit` で表現されていて壊れやすい」ところまでは見たが、処方箋として `Required<Omit<>>` による共通核の抽出——つまり**減算をもう一段重ねる**方向を提案し、しかも「全経路が持つべきフィールド」を核に固めようとした。核に `variationNumber` や `submissionType` を入れると、それらを持たない経路（C3/C4 の内容記述子、提出区分をビルダーが固定する改訂先）にとって「核なのに使えない」嘘になる。#626 は #617 の前提自体が誤りと断じ、PR #625 を unmerged で棄却した。

さらに #617 の議論には「不変則の宣言」と「網羅性の検知」の混同があった。「固定値引を持ち込まない」（不変則）と「フィールドを新設したとき引き継ぎ経路への反映を忘れない」（網羅性）は別の問題で、`Required` は後者の tripwire として持ち出されたが前者の解決策の顔をしていた。

## 検討した選択肢

### 記述子の共通化機構

- **① 痩せた共有核＋加算拡張（採用）**: 全経路で意味を持つフィールドだけを核（`ItemDescriptorBase` / `VariationDescriptorBase<I>` / `EstimateFactoryInputBase`）に置き、経路固有のフィールドは交差型で足す。禁止フィールドは核に存在しないため、書こうとすると excess property でコンパイルエラーになる。既定値が「不在」になり、許可は明示的な加算という目に見える行為でしか起きない。
- **② 減算共通化の継続（`Omit` ベース・不採用）**: 上記の歪み 3 点をそのまま抱える。禁止の維持が「消し忘れないこと」に依存する。
- **③ `Required<Omit<>>` による共通核（#617 / PR #625・不採用）**: 減算を一段重ねるだけで根の向きが変わらない。加えて経路ごとに有無が割れるフィールドを核へ引き上げるため、#617 が指摘した「型が嘘をつく」問題を核の側で再生産する。

### 明細型の径数化

- **`SetGroupDescriptor<I>` / `VariationDescriptorBase<I>` を明細型で径数化（採用。PR #625 のアイデアのうち唯一再導入した点）**: セット群の構成明細は通常明細と同型の価格付き末端行（ADR-0047）なので、経路ごとの明細制約は `I` の差し替えだけで群の内側まで伝播する。`Omit<..., "components"> & { components: ... }` の手当てが消える。
- **層ごとに具体型を書き下ろす（不採用）**: 明細型と群の構成明細型の対応を人手で同期し続ける必要があり、#602（セット群取りこぼし）と同種の乖離余地を残す。

### 改訂先記述子の `submissionType`

- **記述子から排除し、ビルダー（`buildRevisedVariation`）が CUSTOMER を固定する（採用）**: 現行の `reviseForCustomer` は記述子に `SubmissionType.CUSTOMER` を書いていたが、`buildRevisedVariation` が値を読まず自前で固定しており完全な死にフィールドだった。「改訂先は常に得意先宛」は 1 箇所で表現する。
- **記述子に残す（不採用）**: 読まれない値を書き続けることになり、「書いたのに効かない」は #598 型の取りこぼしの温床そのもの。

### `RevisedItemDescriptor.revisedDeliveryPrice` の必須化

- **必須・非 null に強化（採用）**: `reviseForCustomer` は全明細に改訂元の `finalAmount` を必ずスナップショットする（§8.4）ため、必須が honest。スナップショット漏れが本物の不変則違反としてコンパイルエラーになる。汎用の `EstimateItemDescriptor` 側は `Money | null` の optional を維持する（seed が改訂済み見積を直接生成する実需がある）。
- **optional `Money | null` のまま（不採用）**: 改訂経路にとって嘘であり、漏れを型が検知できない。

### 網羅性 tripwire の設置

- **置かない（採用）**: 「フィールド新設時に引き継ぎ経路への反映を忘れる」は低頻度で、レビュー観点でカバーする（#626 の明示決定）。
- **`Required` やキー manifest を置く（不採用）**: 不変則の宣言（型が語るべきこと）と網羅性の検知（プロセスが担うこと）を混同する。#617 が踏んだ轍。

## 決定

引き継ぎ生成（複製先・改訂先）の記述子を、**痩せた共有核を加算拡張して組み立てる**方式へ交換する（① / 径数化 / submissionType 排除 / 納品価格必須化 / tripwire 不設置 を採用）。

1. **機構の交換**: `ItemDescriptorBase` / `VariationDescriptorBase<I>` / `EstimateFactoryInputBase` を核に据え、`EstimateItemDescriptor` / `VariationContentDescriptor` / `EstimateVariationDescriptor` / `EstimateFactoryInput` / `EstimateDuplicateInput` を交差型の加算で定義する。見積ドメインから `Omit` を一掃する。核は全経路で意味を持つフィールドのみ（バリエーション層は `items` / `setGroups?` / メモ 2 種の 4 つ）で、`variationNumber` / `submissionType` は経路ごとに有無が割れるため核に入れず各拡張が加算する。
2. **Copied / Revised の分離**: 「Repriced」語彙を型から完全撤去し（後方互換エイリアスも残さない）、CONTEXT.md の正式語彙に合わせて `CopiedItemDescriptor` / `CopiedVariationDescriptor`（複製先）と `RevisedItemDescriptor` / `RevisedVariationDescriptor`（改訂先）に分ける。`CopiedItemDescriptor` は核そのもの。`RevisedItemDescriptor` は核＋必須・非 null の `revisedDeliveryPrice`。改訂先記述子は `submissionType` を持たない。
3. **網羅性 tripwire を意図的に置かない**: 型は不変則（何を書いてはいけないか・何を必ず書くか）だけを語り、網羅性（フィールド新設時の反映漏れ）はレビューで見る。この決定に伴い、ADR-35a の `@ts-expect-error` 型ガードテスト（`repricedDescriptor.type.test.ts`）は削除する。

## 根拠

- **禁止の既定値を「不在」にする。** 減算では禁止フィールドが型に現れてから消されるため、維持は「消し忘れないこと」に依存する。加算では核に無いものを書くには明示的に足すしかなく、それはレビューで見える行為になる。#598 の火元（引き継ぎ経路への固定値引記述）は、いずれの方式でも構築サイトでコンパイルエラーになるが、加算方式では**新しい経路を作った人が何もしなくても**禁止が効く。ただし**この優位は「拡張側へのフィールド新設」と「経路の追加」に対するもの**で、一様ではない。減算は禁止を名前で名指しする（`Omit<T, "itemDiscount">`）ため、フィールドの定義位置が変わっても禁止は効き続け、破るには `Omit` 節そのものを消すという目立つ行為が要る。加算は禁止を配置で表す（核に置かない）ため、`itemDiscount` を拡張側から核へ移すと複製先・改訂先の両方が同時に受け入れるようになる。この移動は「値引はどの明細にも共通する概念だから核へ」という自然なリファクタの顔で現れうる。本 ADR はこの方向の弱さを承知のうえで、より高頻度な「フィールド新設」側の強さを採る（核に足すか拡張に足すかの判断がレビュー観点になることは影響節に記す）。
- **型は引き算の暗算を要求しない。** 加算で書かれた型は、定義を読めば「何が入っているか」がそのまま分かる。`Omit<EstimateVariationDescriptor, "overallDiscount" | "items" | "setGroups"> & { ... }` の復元作業が消える。
- **核が嘘をつかない範囲まで痩せる。** #617 の指摘（型が嘘をつく）は正しかったが、処方箋（`Required` で核を固める）は嘘を核へ移すものだった。有無が割れるフィールドを核から追い出すことで、核は全経路にとって真になる。
- **不変則の宣言と網羅性の検知を分ける。** 型ガードテストが守っていた残りは「型定義自体の widening」だけであり、それは #626 が「低頻度・レビュー観点でカバー」と明示決定した射程内にある。メタガードだけ残すのは方針との一貫性を欠く。ビルダーガード（`buildVariation` が `revisedFrom` を取らない）も関数シグネチャとして読めば見える。
- **共有ビルダーの引数型は構造的代入性で保たれる。** `CopiedItemDescriptor` は `EstimateItemDescriptor` の部分集合、`RevisedItemDescriptor` の必須 `Money` は optional `Money | null` に代入可能。ADR-35a の決定 2・3（子構築の共有ビルダー一本化・`buildVariation` / `buildRevisedVariation` の分割）はそのまま存続する。

## 影響

- 本 ADR は ADR-20260716-35a の**決定 1（repriced 記述子の `Omit` 機構）と型ガードテスト条項を置換**する。35a の決定 2・3 は存続し、本 ADR もそれに依存する。35a は廃止・差替にせず、改訂履歴で射程を示す（1 ファイルに複数決定を束ねた ADR の部分置換）。
- ADR-20260714-pv8（業務判断: なぜ固定値引をクリアするか）は不変。本 ADR は機構（どう型で守るか）のみを扱う。
- barrel（`domain/entities/index.ts`）の公開型は等価交換する。`Repriced*` 3 型を外し、consumer（`EstimateDuplicationService`）が使う `CopiedItemDescriptor` / `SetGroupDescriptor` を加える。核 3 型と `Revised*` は barrel 非公開（`entities/` 内の相対 import のみ）で、集約外へ核を露出しない。
- 挙動は完全不変（純型リファクタ）。単体テストは無改修で GREEN、担保は pre-push の `tsc --noEmit` とフルスイート。
- 「Repriced」語彙は型から消えるが、概念（単価再解決経路の共通制約）は ADR-20260714-pv8 と CONTEXT.md の改訂先定義に生きている。その制約は今後「核に固定値引が無い」という構造そのものが表現する。
- 記述子にフィールドを新設する際、引き継ぎ経路（複製先・改訂先）へ反映すべきかの判断は型が促さない。核に足すか拡張に足すかの選択がレビュー観点になる（tripwire 不設置の代償として引き受けたトレードオフ）。
