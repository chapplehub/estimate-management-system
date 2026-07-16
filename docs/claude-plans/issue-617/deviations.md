# Issue #617 実装計画からの逸脱記録

## 1. `VariationContent.setGroups` も必須化した（Step 1）

### 元の計画内容

Step 1 の対象は記述子型（`EstimateVariationDescriptor` / `RepricedVariationDescriptor` /
`VariationChildrenDescriptor`）と `SetComponentValidationTarget` の 4 つで、
`EstimateVariation.VariationContent` は対象ファイルに挙がっていなかった。

計画は `assertSetComponentsValid` の必須化根拠を「呼び出し元は `estimate.variations` /
`buildVariationContent` の戻り値＝エンティティを渡しており常に配列を持つ」としていた。

### 実際の実装内容

`VariationContent.setGroups?: EstimateSetGroup[]` を必須化し、`replaceContent` の
`input.setGroups ?? []` を削除した。

### 逸脱の理由

計画の根拠（「常に配列を持つ」）は**実行時の事実としては正しいが、型に書かれていなかった**。
`VariationContent.setGroups` が optional のままだと `SetComponentValidationTarget` の必須化が
型として通らず（`EstimateSetGroup[] | undefined` は必須の配列に代入できない）、Step 1 が
成立しなかった。

`VariationContent` の唯一の生産者は `EstimateFactory.buildVariationContent` であり、
これは `buildVariationChildren` の戻り値（常に配列）を詰める。したがって optional は
「起こり得ない undefined」を型に残すだけで、計画が掲げた
**「optional は正規化する単一の所有者が居るときだけ許す」規則**にそのまま反していた。
計画の意図の範囲内と判断し、新たな設計判断の追加ではなく計画の適用漏れの補完として実施した。

---

## 2. `Required<>` が `undefined` も除くため引き継ぎ側は具体値必須になった（Step 2）

### 元の計画内容

「維持すべきフィールドは `Required<Omit<...>>` の機械導出で必須化する」。計画は必須化＝
「キーの省略を禁じる」意図で書かれており、値として `undefined` を渡せるかは明示していなかった。

### 実際の実装内容

型定義は計画どおり `Required<Omit<...>>`。ただし `Required<T>` は `?` を外すと同時に
値域から `undefined` も除くため、`discountRate` / `customerMemo` / `internalMemo` は
`undefined` を渡せず**具体値が必須**になった。

これに伴い `EstimateFactory.test.ts` に引き継ぎ経路専用の `copiedItem()` ヘルパを追加し、
`discountRate: new DiscountRate(1.0)` / `customerMemo: Memo.empty()` 等の具体値を置いた
（計画に無い追加）。

### 逸脱の理由

本番の populate 2 経路（`Estimate.reviseForCustomer` / `EstimateDuplicationService.copyItem`）は
複製元・改訂元**エンティティの getter** から値を引いており、これらの getter は
`DiscountRate` / `Memo` を非 optional で返す（既定化は `EstimateItem.create` が 1 回だけ行う
所有者であるため）。よって本番コードは無変更で通り、計画の意図（維持フィールドの取りこぼし防止）は
そのまま達成される。

テストヘルパのみ `EstimateItemDescriptor`（optional 持ち）と形状が合わなくなったため分離した。
これは型が「引き継ぎ側では既定化済みの具体値しか流れない」という実際の不変則を正しく
表現した結果であり、計画の意図に反しない。

### 補足: 設計の実効性を確認済み

`EstimateItemDescriptor` に optional フィールドを 1 本足す変異を試したところ、
populate 2 経路（`Estimate.ts` / `EstimateDuplicationService.ts`）が両方ともコンパイル
エラーになることを確認した。#617 の目的である「将来 optional が増えたら判断を書き手に強制する」が
機能している。
