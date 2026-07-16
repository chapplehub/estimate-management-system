# Issue #617: 記述子 optional プロパティの「省略＝クリア/未指定」を型で区別できず引き継ぎ生成で silent data loss を招く構造を塞ぐ — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

引き継ぎ生成（複製先・改訂先）の記述子から optional を根絶し、「省略＝黙って取りこぼす」構造を型で塞ぐ。

- **維持すべきフィールドは `Required<Omit<...>>` の機械導出で必須化**する。将来 `EstimateItemDescriptor` に optional が増えても自動的に引き継ぎ側で必須になり、populate 箇所がコンパイルエラーになる（＝判断を書き手に強制する）。
- **クリアすべきフィールドは `Omit` で型から消す**（ADR-20260716-35a の機構を吸収）。
- **経路で意味が変わる `revisedDeliveryPrice` は複製用／改訂用に記述子を割る**。
- **`setGroups` は発生源（`EstimateVariationDescriptor`）から必須化**し、`??` による正規化をフォーム入力→記述子のアプリ層マッパへ押し出す。
- **「optional キーがゼロ本」を構造ガードで固定**する。`Required<>` は変換であって不変則ではないため、`&` で後から optional を足す経路を検査で塞ぐ。

**挙動は不変**。既存の #602 回帰テスト群（`EstimateDuplicationService.test.ts` / `Estimate.test.ts`）がそれを担保する。

設計判断の全量と根拠は **ADR-20260716-w4k**（`docs/adr/20260716-w4k-eradicate-optional-from-handoff-descriptors.md`、コミット済み）に記録済み。

### スコープ外（別 issue）

- **#620**: 「改訂先である」事実が `EstimateVariation.revisedFrom` と `EstimateItem.revisedDetail` の有無で二重に符号化され整合が守られていない構造の解消。`EstimateItem`（18 ファイル）と `EstimateVariation`（29 読点）の同時分割になり本 issue とは別物の大手術のため。
- `EstimateItemDescriptor.revisedDeliveryPrice?: Money | null` の `undefined ≡ null` 冗長の解消。引き継ぎ側は `Omit` して自前定義するため無関係で、本 issue の目的に寄与しない。

## 設計判断

すべて対話で決着済み。詳細な選択肢と不採用理由は ADR-20260716-w4k を参照。

### 型表現の方針
- A. 引き継ぎ経路で必須化 / B. `T | Clear` トークンで未指定とクリアを区別 / C. `Omit` で経路ごとに型から消す
- **決定: A（維持フィールド）＋ C（クリアフィールド）。B は不採用**
- 理由: 引き継ぎ生成ではクリア／維持の選択がフィールドごとに型レベルで固定され実行時に分岐しない（固定値引は無条件クリア・率/メモ/セット群は無条件維持）ため、値レベルのトークンが必要な状況が存在しない。加えて `Omit` は「名前すら書けない」ぶんトークンより強い。

### 必須化の実現方法
- A. 維持フィールドを手で列挙して必須化 / B. `Required<Omit<...>>` で機械導出
- **決定: B**
- 理由: A は将来 `EstimateItemDescriptor` に optional が増えると引き継ぎ側へ optional のまま流れ込み、コンパイルが通るので誰も気づかない（#603 が個別対処だったのと同じ轍）。B は新フィールドを自動で必須化する。

### 経路で意味が変わる `revisedDeliveryPrice`
- A. 共有 `RepricedItemDescriptor` に optional で残す / B. 複製用（`Omit`）と改訂用（`Money` 必須）に割る
- **決定: B**
- 理由: A は改訂の書き忘れで改訂明細詳細が黙って生成されず §8.4 の比較基準が消える（#602 と同型の未発火 silent data loss）。逆に複製がうっかり書ける穴も開く。ADR-35a が `revisedFrom` に採った「本質的差異は最終段で割る」論法の適用漏れを埋める。

### `setGroups` の optional をどこで断つか
- A. 引き継ぎ側だけ必須化 / B. `EstimateVariationDescriptor` からも必須化しアプリ境界で正規化
- **決定: B**
- 理由: optional の発生源はフォーム境界であってドメインではない。A では `?? []` がドメインに残り将来の経路がまた踏む。**規則: optional は「正規化する単一の所有者」が居るときだけ許す**——`discountRate?` / メモは entity の `create` が 1 回だけ既定化するので据え置き、所有者不在の `setGroups?` のみ断つ。

### 2 系統の型の書き方
- A. 複製系・改訂系を別々に定義 / B. 明細型で径数化（generics）
- **決定: B**
- 理由: A は `Required<Omit<...>>`（＝クリア判断の全量）が 2 箇所に重複し、将来クリア対象が増えたとき片方だけ直る余地が生まれる（#602 と同型の再生産）。

### 回帰防止
- A. フィールド個別の `@ts-expect-error` ガードのみ / B. 個別ガード ＋ 構造ガード（`OptionalKeys<T> extends never`）
- **決定: B**
- 理由: `Required<>` は変換であって不変則ではなく、`&` で後から optional を足す経路（本設計自身が `RevisedItemDescriptor` で使う操作）を塞げない。A では #617 自身が「今日の optional だけ塞いだ個別対処」になる。

## ステップ

### Step 1: `setGroups` をドメインで必須化し正規化をアプリ境界へ押し出す
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`（`EstimateVariationDescriptor.setGroups` / `RepricedVariationDescriptor.setGroups`）
  - `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`（`VariationChildrenDescriptor.setGroups` / `?? []` 削除）
  - `src/server/subdomains/estimate/application/commands/CreateEstimateCommand.ts:224`（境界で正規化）
  - `src/server/subdomains/estimate/application/shared/variationContentInput.ts:84`（境界で正規化）
  - `src/server/subdomains/estimate/application/shared/assertSetComponentsValid.ts`（`SetComponentValidationTarget.setGroups` / `?? []` 削除）
  - `src/server/subdomains/estimate/domain/entities/__tests__/repricedDescriptor.type.test.ts`（型ガード追加）
  - seed 27 箇所・テスト 12 箇所（`setGroups: []` 追記。実測済みの内訳は下記）
- テスト戦略: **TDD**（型ガードを先に書き `tsc --noEmit` の RED を確認してから型を締める。`@ts-expect-error` は「省略が許されている」間は未使用となり tsc が赤くなる＝意味のある RED）
- 作業内容:
  - 型ガード「`RepricedVariationDescriptor` は `setGroups` の省略を拒否する」を先に追加し RED を確認する
    ```ts
    const guard = (base: Omit<RepricedVariationDescriptor, "setGroups">): RepricedVariationDescriptor =>
      // @ts-expect-error setGroups は省略できない（#602 の火元・#617）
      ({ ...base });
    ```
  - `EstimateVariationDescriptor.setGroups` / `RepricedVariationDescriptor.setGroups` / `VariationChildrenDescriptor.setGroups` を必須化する
  - `buildVariationChildren` の `descriptor.setGroups ?? []` を `descriptor.setGroups` にする
  - マッパ 2 箇所を `(input.setGroups ?? []).map(...)` へ変更する（フォーム入力→記述子の境界で正規化）
  - `assertSetComponentsValid` の `SetComponentValidationTarget.setGroups` を必須化し `?? []` を削除する（呼び出し元は `estimate.variations` / `buildVariationContent` の戻り値＝エンティティを渡しており常に配列を持つ）
  - **`resolveLinePrices` の `LinePriceTree.setGroups?` は据え置く**（記述子化より前のフォーム入力を扱う上流であり、そこでの optional は境界の事実を正しく表している）
  - 壊れる 39 箇所に `setGroups: []` を追記する（実測: seed 27 = `seed-estimates.ts` 16 / `seed-dev-data/estimates.ts` 8 / `seed-dev-data/applications.ts` 2 / `seed-estimate-applications.ts` 1、テスト 12 = `EstimateFactory.test.ts` 6 / `EstimateDuplicationService.test.ts` 3 / `DuplicateEstimateCommand.test.ts` 2 / `assertSetComponentsValid.test.ts` 1）
  - `tsc --noEmit` と `pnpm test` が緑であることを確認する
- コミットメッセージ: `refactor: setGroups をドメインで必須化し undefined 正規化をアプリ境界へ押し出す (#617)`

### Step 2: 引き継ぎ記述子を Required 機械導出・経路分割・generics で再定義する
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`（記述子ファミリ再定義）
  - `src/server/subdomains/estimate/domain/entities/index.ts`（バレルの公開型）
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`（改訂経路 `reviseForCustomer`）
  - `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`（複製経路 `copyItem` / `toCopiedDescriptor`）
  - `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`（`buildRevisedVariation` の引数型）
  - `src/server/subdomains/estimate/domain/entities/__tests__/repricedDescriptor.type.test.ts`（個別ガード＋構造ガード）
- テスト戦略: **TDD**（型ガードを先に書き RED を確認してから型を再定義する。構造ガードは再定義前は `RepricedItemDescriptor` に optional が残るため `never` にならず RED になる＝意味のある RED）
- 作業内容:
  - 型ガードを先に追加し RED を確認する
    - `CopiedItemDescriptor` は `revisedDeliveryPrice` を拒否する（複製先に改訂明細詳細は生えない）
    - `RevisedItemDescriptor` は `revisedDeliveryPrice` の省略を拒否する（§8.4 の比較基準を落とさない）
    - 構造ガード: 引き継ぎ記述子に optional キーが 1 本も存在しない
      ```ts
      type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];
      type _NoOptional = [OptionalKeys<CopiedItemDescriptor>, OptionalKeys<RevisedItemDescriptor>] extends [never, never] ? true : never;
      const _guard: _NoOptional = true;
      ```
  - 記述子ファミリを再定義する（`Omit` の 2 つの用途——削除＝クリア／置換＝入れ子の明細型差し替え——をコメントで書き分ける）
    ```ts
    type RepricedItemDescriptor = Required<Omit<EstimateItemDescriptor, "itemDiscount" | "revisedDeliveryPrice">>;
    type CopiedItemDescriptor   = RepricedItemDescriptor;
    type RevisedItemDescriptor  = RepricedItemDescriptor & { revisedDeliveryPrice: Money };

    type RepricedSetGroupDescriptor<I extends RepricedItemDescriptor> =
      Required<Omit<EstimateSetGroupDescriptor, "components">> & { components: I[] };

    type RepricedVariationDescriptor<I extends RepricedItemDescriptor> =
      Required<Omit<EstimateVariationDescriptor, "overallDiscount" | "items" | "setGroups">>
      & { items: I[]; setGroups: RepricedSetGroupDescriptor<I>[] };

    type CopiedVariationDescriptor  = RepricedVariationDescriptor<CopiedItemDescriptor> & { sourceVariationId: EstimateVariationId };
    type RevisedVariationDescriptor = RepricedVariationDescriptor<RevisedItemDescriptor>;
    ```
  - populate 2 経路を新型へ移す（`Estimate.reviseForCustomer` の `toRepricedItem` → `RevisedItemDescriptor`、`EstimateDuplicationService.copyItem` → `CopiedItemDescriptor`）
  - `buildRevisedVariation` の引数型を `RevisedVariationDescriptor` にする
  - バレルの公開型を更新する（`CopiedItemDescriptor` / `RevisedItemDescriptor` / `RevisedVariationDescriptor` を追加）
  - 既存の `itemDiscount` / `overallDiscount` ガードが引き続き機能することを確認する
  - `tsc --noEmit` と `pnpm test` が緑であることを確認する
- コミットメッセージ: `refactor: 引き継ぎ記述子を Required 導出と経路分割で再定義し optional を根絶する (#617)`

### Step 3: 死んだ `attachRevisedDetail` / `detachRevisedDetail` を削除する
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateItem.ts`（193-200 行のメソッド削除・`_revisedDetail` を `readonly` 化）
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateItem.test.ts`（162-172 行の専用テスト削除）
- テスト戦略: **テスト不要**（本番からの呼び出しが存在しない死んだコードとその専用テストの削除であり、振る舞いの変更が無い。呼び出し元不在は pre-push の `tsc --noEmit` が担保する）
- 作業内容:
  - `attachRevisedDetail` / `detachRevisedDetail` を削除する（調査済み: 本番コードからの呼び出し元は存在せず、テストのみが呼んでいる）
  - `private _revisedDetail` を `private readonly _revisedDetail` にする（`create` / `reconstruct` 時確定・以後不変を型で固定する）
  - 対応するテスト 2 件を削除する
  - `pnpm test` が緑であることを確認する
- コミットメッセージ: `refactor: 死んだ attach/detachRevisedDetail を削除し改訂明細詳細を生成時確定にする (#617)`
