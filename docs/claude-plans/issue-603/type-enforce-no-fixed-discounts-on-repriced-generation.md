# Issue #603: 単価再解決を伴う生成で固定値引を持ち込まない不変則を型で強制する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

「単価再解決を伴う生成（複製先・改訂先）では固定値引（明細値引 `itemDiscount` / 全体値引 `overallDiscount`）を持ち込まない」という不変則（ADR-20260714-pv8・#598）を、**コメント頼みから型強制へ移行**する。

現状この不変則は、記述子の optional プロパティを「書かない」ことと隣接コメントでしか表現されておらず、将来だれかが一行足しても型チェックが通ってしまい #598 が静かに再発しうる。加えて、同じ「単価再解決を伴う引き継ぎ生成」が **複製（`EstimateFactory.duplicate` 経由・記述子を通る）と改訂（`Estimate.reviseForCustomer`・集約内で子を直接構築）で構造の違う2箇所に別実装**で存在しており、姉妹バグ #602（setGroups 取りこぼし）もこの構造的分岐から生まれた。

本計画は次の2軸で対処する:

1. **型で禁止する**: 単価再解決経路専用の「repriced 記述子型」を新設し、固定値引フィールドを `Omit` で型から消す。うっかり `itemDiscount` / `overallDiscount` を書くとコンパイルエラーになる。
2. **構築を一本化する**: 子エンティティ構築（`buildItem` / `buildSetGroups` / `buildVariationChildren`）を共有ビルダーモジュールへ抽出し、複製・改訂の両経路が同じビルダーを通るようにする。これにより #602 型の取りこぼし全般が構造的に起きなくなる。バリエーション組み立ての最終段のみ、系譜の差異に応じて通常用 `buildVariation`（`revisedFrom` を受け取れない）と改訂専用 `buildRevisedVariation`（`revisedFrom` 必須）に割る。

本 Issue は挙動不変のリファクタであり、既存の挙動テスト（複製・改訂の固定値引クリア）を回帰ネットとして維持する。新規に加わる「型で禁止できていること」は `@ts-expect-error` 型ガードテストで固定する。

## 設計判断

### 不変則の表現方法
- ① 再解決専用の repriced 記述子型を分け、固定値引フィールドを `Omit` で型から消す
- ② 固定値引を必須 `Money | null` にして明示クリアを強制する
- ③ 値オブジェクト（`Money`）側に「再解決済み単価に固定値引は付かない」を持たせる
- **採用: ①**。理由: Issue の核心「再解決経路で禁止したい項目を型が禁止できない」を直撃し、うっかり複写が excess property でコンパイルエラーになる。②は再解決経路で `itemDiscount: source.itemDiscount` を依然書けてしまい禁止にならず、全記述子・全ビルダー・全テストビルダーへ `null` 明示を強要して変更範囲が過大。③は共有カーネルの汎用 VO（ADR-0022）に見積固有の不変則を背負わせる責務過剰。

### 改訂経路も型で縛るか
- A. 改訂経路も repriced 記述子を経由させ、両経路をコンパイル強制
- B. 改訂は直接構築のまま残し、不変則テストのみで担保
- **採用: A**。理由: #598 の火元は改訂経路。ここを型の外に残すと「型で守れていない側で再発」になり本末転倒。`reviseForCustomer` は既存集約インスタンスを変異させる操作なので集約メソッドのまま保つ（ドメインサービス＋ファクトリへ移すと組み立て済み子が集約外へ漏れ境界規約が悪化するため移さない）。

### 改訂経路の実現方式
- A-i. 改訂は集約内で自己完結。中間に repriced 記述子型を挟むが、リーフ構築のローカルマッパは自前で持つ
- U1. `buildItem` / `buildSetGroups` / `buildVariationChildren` / `buildVariation` を `EstimateFactory` から共有モジュール `estimateChildBuilders.ts` へ抽出し、複製・改訂の両方が使う
- U2. 改訂が `EstimateFactory` を直接呼ぶ
- **採用: U1**。理由: Issue の根の病理は「同じ再解決生成が2箇所に別実装で存在する」構造的分岐（#602 の原因）。U1 は構築を単一 locus に集約し #602 型の取りこぼし全般を構造的に潰す。既存の改訂側重複配線も純減。循環 import は生じない（`estimateChildBuilders → 子エンティティ` の一方向、`EstimateFactory`・`Estimate` が相対 import）。A-i は固定値引の症状だけを塞ぎ2経路の別実装を残す。U2 は `Estimate ⇄ EstimateFactory` の循環と Factory の役割濁りを残す。3メソッドは元からステートレスな static で全入力を引数受けしており純抽出可能。

### バリエーション組み立ての分割（`revisedFrom` の渡し方）
- 単一 `buildVariation(descriptor, { tax, revisedFrom? })` で optional にする
- 通常用 `buildVariation`（`revisedFrom` なし）と改訂専用 `buildRevisedVariation`（`revisedFrom` 必須）に分割
- **採用: 分割**。理由: optional な `revisedFrom` を共有ビルダーに持たせると、複製・新規作成が `revisedFrom` を渡せてしまい「optional＝間違えられる余地」を別フィールドで再生産する（複製の系譜 `EstimateVariationCopy` と混線）。真に共通なのは子構築（`buildItem` / `buildSetGroups` / `buildVariationChildren`）で、系譜を含むバリエーション組み立ての最終段は本質的差異として割るのが正しい。系譜は共有記述子に載せない（複製の `sourceVariationId` は後段でペア化、改訂の `revisedFrom` は `buildRevisedVariation` の必須引数・ADR-0030 横断コンテキストは引数で渡す）。

### 共有ビルダーモジュールの配置
- `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`（`EstimateFactory` と同ディレクトリ）
- 理由（任意でなく制約）: 子エンティティは境界規約によりバレル非公開で、`domain/entities/` 内からの相対 import のみ許可（eslint 例外）。`EstimateFactory` が同位置にいるのと同じ理由。バレルには出さない内部ユーティリティとする。

### setGroups 取りこぼしのスコープ
- (a) U1 の構築一本化で守れる範囲に留め、`setGroups?` の optional 撤廃など記述子 optional 全般の見直しは #603 スコープ外（別イシュー）
- (b) この機会に `setGroups?` 必須化など optional 全般に踏み込む
- **採用: (a)**。理由: #603 の主眼は固定値引の不変則。optional 全般は別軸で、スコープを絞る（大きすぎるスコープは分割する方針）。

### 不変則テストの範囲
- 既存の挙動テスト（複製・改訂の固定値引クリア結果）を両経路で維持（U1 抽出の回帰ネット）
- `@ts-expect-error` 型ガードを新設し、`Repriced*` 記述子が `itemDiscount` / `overallDiscount` を名乗れないこと・通常 `buildVariation` が `revisedFrom` を受け取れないことを固定する。型を緩める変更が入ると pre-push の `tsc --noEmit` が赤になる。repo に前例あり（`EstimateVariation.test` 等）。

### ADR の扱い
- X. pv8 へ追記
- Y. 型強制機構を新規 ADR として起票し、pv8 からは相互参照リンクのみ
- **採用: Y**（ユーザー判断で起票決定）。理由: pv8 は「なぜクリアするか」の業務判断の記録で、機構（将来また変わりうる）とは粒度・寿命・想定読者が違う。責務で分ける（ADR-0011 と整合）。

## ステップ

### Step 1: 子構築ロジックを共有ビルダーモジュールへ抽出（挙動不変）
- [x] **完了**
- 対象ファイル:
  - 新規: `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`
  - 変更: `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`
- テスト戦略: テスト不要（挙動不変の純抽出リファクタ。既存 `EstimateFactory.test` / `EstimateDuplicationService.test` / `Estimate.test` が回帰を担保する。新規挙動なし）
- 作業内容:
  - `EstimateFactory` の private `buildItem` / `buildSetGroups` / `buildVariation` を `estimateChildBuilders.ts` へモジュールレベル純関数として移設する（`tax` は引数受けのまま、`this`・状態は持たない）。
  - `buildVariation` の内側から「items + setGroups を組む共通部分」を `buildVariationChildren(descriptor)` として切り出す（Step 3 の `buildRevisedVariation` と共有する土台）。
  - `EstimateFactory` はこれらへ委譲する薄い facade にする。公開 API（`create` / `duplicate` / `buildVariationContent`）とバレルの公開型は不変。
  - `estimateChildBuilders.ts` は子エンティティを相対 import のみで参照し、`Estimate` は import しない（循環なし）。バレルには出さない。
- コミットメッセージ: `refactor: 見積の子エンティティ構築を estimateChildBuilders へ抽出し EstimateFactory を委譲 facade 化`

### Step 2: repriced 記述子型を新設し複製経路を repriced 化
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`（`Repriced*` 型定義、`CopiedVariationDescriptor` の再定義）
  - `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`（`copyItem` の戻り型・setGroups マップの型を repriced へ）
  - `src/server/subdomains/estimate/domain/entities/index.ts`（必要なら再エクスポート調整）
- テスト戦略: テスト不要（型のみの変更で挙動不変。複製は元々固定値引を書いていない。結果は既存 `EstimateDuplicationService.test` が担保し、型の効力は Step 4 の型ガードで固定する）
- 作業内容:
  - `RepricedItemDescriptor = Omit<EstimateItemDescriptor, "itemDiscount">` を追加。
  - `RepricedSetGroupDescriptor = Omit<EstimateSetGroupDescriptor, "components"> & { components: RepricedItemDescriptor[] }` を追加。
  - `RepricedVariationDescriptor = Omit<EstimateVariationDescriptor, "overallDiscount" | "items" | "setGroups"> & { items: RepricedItemDescriptor[]; setGroups?: RepricedSetGroupDescriptor[] }` を追加。
  - `CopiedVariationDescriptor = RepricedVariationDescriptor & { sourceVariationId: EstimateVariationId }` へ差し替え。
  - `toCopiedDescriptor` の `copyItem` 戻り型を `RepricedItemDescriptor`、setGroups マップのオブジェクトを `RepricedSetGroupDescriptor` に更新（`itemDiscount` を書くと excess property でエラーになる状態にする）。
  - `Omit` した optional フィールドは元の型へ構造的に代入可能なため、共有ビルダーの引数型は変更不要。
- コミットメッセージ: `refactor: 単価再解決経路専用の repriced 記述子型を新設し複製経路を型で固定値引不可に`

### Step 3: 改訂専用 buildRevisedVariation を追加し改訂経路を repriced 化
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`（`buildRevisedVariation` 追加、`buildVariation` を `revisedFrom` なしに確定）
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`（`reviseForCustomer` を repriced 記述子組み立て＋`buildRevisedVariation` 経由へ）
- テスト戦略: テスト不要（挙動不変のリファクタ。改訂先の固定値引クリア・`RevisedEstimateItemDetail`（deliveryPrice=finalAmount）・セット群メモ複写・`submissionType=CUSTOMER`・`revisedFrom` は既存 `Estimate.test`（改訂）が担保。構築経路の付け替えのみで結果は不変）
- 作業内容:
  - `buildRevisedVariation(descriptor: RepricedVariationDescriptor, ctx: { tax; revisedFrom })` を追加。内部で `buildVariationChildren` を再利用し、`EstimateVariation.create` を `revisedFrom` あり・`submissionType=CUSTOMER` 固定・`overallDiscount` なしで呼ぶ。
  - `buildVariation` のシグネチャに `revisedFrom` を持たせない（通常経路が名乗れない状態を確定）。
  - `reviseForCustomer` を、改訂元から `RepricedVariationDescriptor`（各明細に `revisedDeliveryPrice = item.finalAmount` を載せる）を組み立て、`buildRevisedVariation({ tax: this.taxContext(), revisedFrom: source.id })` を呼ぶ形に変更。repriced 型は `import type` で参照（循環なし）。既存の改訂元ガード（納品先宛・ACTIVE）・単価解決欠落拒否・`addVariation` は維持。
  - 改訂経路が自前実装していたセット群 id 配線が共有 `buildSetGroups` に一本化されることを確認。
- コミットメッセージ: `refactor: 得意先改訂を repriced 記述子＋buildRevisedVariation 経由にし固定値引・revisedFrom を型で強制`

### Step 4: @ts-expect-error 型ガードテストを新設
- [ ] **完了**
- 対象ファイル:
  - 新規: `src/server/subdomains/estimate/domain/entities/__tests__/repricedDescriptor.type.test.ts`（配置・命名は repo の既存 `__tests__` 前例に合わせる）
- テスト戦略: 実装後テスト（`@ts-expect-error` 型ガードは対象の `Repriced*` 型・`buildVariation` シグネチャが存在してから書ける。`tsc --noEmit`（pre-push）で担保。型が緩むと未使用 `@ts-expect-error` で赤になる）
- 作業内容:
  - `RepricedItemDescriptor` に `itemDiscount` を足すと型エラーになることを `@ts-expect-error` で固定。
  - `RepricedVariationDescriptor` に `overallDiscount` を足すと型エラーになることを固定。
  - 通常用 `buildVariation` に `revisedFrom` を渡すと型エラーになることを固定。
  - 各ガードは有効なベース記述子を用意し、禁止フィールドの追加だけが差分になるよう書く（誤検知防止）。
- コミットメッセージ: `test: repriced 記述子と通常 buildVariation の型不変則を @ts-expect-error で固定`

### Step 5: 型強制機構の新規 ADR 起票と pv8 相互参照
- [ ] **完了**
- 対象ファイル:
  - 新規: `docs/adr/{YYYYMMDD}-{code}-type-enforce-no-fixed-discounts-on-repriced-generation.md`
  - 変更: `docs/adr/20260714-pv8-revised-variation-drops-fixed-discounts-on-unit-price-resolution.md`（新 ADR への相互参照リンク追記）
  - 変更: `docs/adr/INDEX.md`（新 ADR を追記）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新 ADR に、単価再解決を伴う生成の不変則を「repriced 記述子（固定値引を `Omit`）＋子構築の共有ビルダー一本化＋通常/改訂のバリエーション組み立て分割」で型強制する決定と、検討した選択肢（①②③ / A-i・U1・U2 / optional revisedFrom vs 分割）、根拠、影響を記録する。業務判断（pv8）と機構（本 ADR）を分離した理由も明記。
  - pv8 に「本不変則は #603 で型強制へ移行（本 ADR 参照）」の相互参照を追記。
  - `INDEX.md` を更新。
- コミットメッセージ: `docs: 単価再解決生成の固定値引不変則を型強制する機構の ADR を追加`
