# ADR-20260716-35a: 単価再解決を伴う生成の固定値引不変則を型で強制する（repriced 記述子＋子構築の共有ビルダー一本化）

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-16 |
| 最終更新日 | 2026-07-16 |

## コンテキスト

「単価再解決を伴う生成（複製先・改訂先）では固定値引（明細値引 `itemDiscount`・全体値引 `overallDiscount`）を持ち込まない」という業務判断は ADR-20260714-pv8（#598）で確立した。だがその不変則は、記述子の optional プロパティを「書かない」ことと隣接コメントでしか表現されていなかった。将来だれかが再解決経路に一行 `itemDiscount: source.itemDiscount` を足しても型チェックが通ってしまい、#598 が静かに再発しうる。

さらに、同じ「単価再解決を伴う引き継ぎ生成」が構造の違う 2 箇所に別実装で存在していた——複製は `EstimateDuplicationService` が記述子を作り `EstimateFactory.duplicate` が子を構築する経路、改訂は `Estimate.reviseForCustomer` が集約内で子（`EstimateItem` / `EstimateSetGroup` / 改訂明細詳細）を直接構築する経路。姉妹バグ #602（セット群取りこぼし）は、この構造的分岐で片方の経路だけがセット群の id 配線を持っていたことから生まれた。

本 ADR は「不変則を型で守れていない」「同じ生成が 2 実装に分岐している」の 2 点を機構として解消する決定を記録する。業務判断（なぜクリアするか）は pv8 の管轄であり、本 ADR は機構（どう型で守るか）を扱う。

## 検討した選択肢

### 不変則の表現方法

- **① repriced 記述子型で `Omit`（採用）**: 単価再解決経路専用の記述子型を分け、固定値引フィールドを `Omit` で型から消す。うっかり複写すると excess property でコンパイルエラーになる。Issue の核心「再解決経路で禁止したい項目を型が禁止できない」を直撃する。
- **② 固定値引を必須 `Money | null` にして明示クリアを強制（不採用）**: 再解決経路で `itemDiscount: source.itemDiscount` を依然書けてしまい禁止にならない。全記述子・全ビルダー・全テストビルダーへ `null` 明示を強要し変更範囲が過大。
- **③ 値オブジェクト `Money` に不変則を持たせる（不採用）**: 共有カーネルの汎用 VO（ADR-0022）に見積固有の不変則を背負わせる責務過剰。

### 改訂経路も型で縛るか

- **A. 改訂経路も repriced 記述子を経由させ両経路をコンパイル強制（採用）**: #598 の火元は改訂経路。ここを型の外に残すと「型で守れていない側で再発」になり本末転倒。`reviseForCustomer` は既存集約インスタンスを変異させる操作なので集約メソッドのまま保つ（ドメインサービス＋ファクトリへ移すと組み立て済み子が集約外へ漏れ境界規約が悪化する）。
- **B. 改訂は直接構築のまま残し不変則テストのみで担保（不採用）**: 火元を型の外に残す。

### 改訂経路の実現方式

- **U1. 子構築（`buildItem` / `buildSetGroups` / `buildVariationChildren` / `buildVariation`）を `estimateChildBuilders.ts` へ抽出し複製・改訂の両方が使う（採用）**: 根の病理「同じ再解決生成が 2 箇所に別実装で存在する」構造的分岐（#602 の原因）を単一 locus へ集約し、取りこぼし全般を構造的に潰す。3 メソッドは元からステートレスな static で全入力を引数受けしており純抽出可能。循環 import は生じない（`estimateChildBuilders → 子エンティティ` の一方向、記述子型は `import type` で参照）。
- **A-i. 改訂は集約内で自己完結しリーフ構築のローカルマッパを自前で持つ（不採用）**: 固定値引の症状だけを塞ぎ 2 経路の別実装を残す。
- **U2. 改訂が `EstimateFactory` を直接呼ぶ（不採用）**: `Estimate ⇄ EstimateFactory` の循環と Factory の役割濁りを残す。

### バリエーション組み立ての分割（`revisedFrom` の渡し方）

- **通常用 `buildVariation`（`revisedFrom` なし）と改訂専用 `buildRevisedVariation`（`revisedFrom` 必須）に分割（採用）**: optional な `revisedFrom` を共有ビルダーに持たせると、複製・新規作成が `revisedFrom` を渡せてしまい「optional＝間違えられる余地」を別フィールドで再生産する。真に共通なのは子構築で、系譜を含む最終段は本質的差異として割る。
- **単一 `buildVariation(descriptor, { tax, revisedFrom? })` で optional にする（不採用）**: 上記の再生産を招く。

## 決定

単価再解決を伴う生成の固定値引不変則を、次の 3 点の機構で型強制する（① / A / U1 / 分割 を採用）。

1. **repriced 記述子型**: `RepricedItemDescriptor = Omit<EstimateItemDescriptor, "itemDiscount">` を基点に `RepricedSetGroupDescriptor` / `RepricedVariationDescriptor`（`overallDiscount` を `Omit`）を新設し、複製の `CopiedVariationDescriptor` の土台に据える。固定値引を書くと excess property でコンパイルエラーになる。
2. **子構築の共有ビルダー一本化**: `buildItem` / `buildSetGroups` / `buildVariationChildren` / `buildVariation` を `estimateChildBuilders.ts` へ抽出し、複製（`EstimateFactory`）・改訂（`Estimate.reviseForCustomer`）の両経路が同じビルダーを通る。
3. **通常／改訂のバリエーション組み立て分割**: 通常用 `buildVariation`（`revisedFrom` を取らない）と改訂専用 `buildRevisedVariation`（`revisedFrom` 必須・`submissionType=CUSTOMER` 固定・`overallDiscount` なし）に割る。

不変則の効力は `@ts-expect-error` 型ガードテストで固定し、型を緩める変更が入ると pre-push の `tsc --noEmit` が赤になる。

## 根拠

- **型が禁止を語る。** コメントは破れるが `Omit` は破れない。再解決経路で固定値引を書く行はコンパイル時に落ちる。
- **単一 locus が取りこぼしを構造的に潰す。** 複製・改訂が同じ `buildVariationChildren` を通ることで、#602 型の「片方の経路だけが持っていた配線」の再生産余地が消える。
- **optional を別フィールドで再生産しない。** `revisedFrom` を共有ビルダーの optional にせず必須引数として改訂専用ビルダーに割ることで、通常経路が系譜を名乗れない状態を型で保つ。
- **業務判断と機構を責務で分ける（ADR-0011 と整合）。** pv8 は「なぜクリアするか」の業務判断の記録で、機構（将来また変わりうる）とは粒度・寿命・想定読者が違う。

## 影響

- `estimateChildBuilders.ts` を新設。子エンティティを相対 import のみで参照し `Estimate` を import しない内部ユーティリティ（バレル非公開）。
- `EstimateFactory` は子構築を共有ビルダーへ委譲する薄い facade になる。公開 API とバレルの公開型は不変。
- `EstimateDuplicationService` の `copyItem` 戻り型・セット群マップが repriced 記述子型になる。
- `Estimate.reviseForCustomer` は repriced 記述子を組み立て `buildRevisedVariation` へ委譲する形になり、自前のセット群 id 配線が共有 `buildSetGroups` に一本化される（#602 の再発防止）。挙動は不変。
- 本 ADR は pv8（業務判断）の機構面を担う。将来「repriced 記述子の optional 全般（例: `setGroups?` 必須化）」に踏み込む場合は本 ADR とは別軸の判断として扱う（#603 スコープ外）。
