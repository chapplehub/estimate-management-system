# Issue #598 実装計画からの逸脱

計画: `clear-fixed-discounts-on-revise-for-customer.md`

## ① 値引クリアの書き方（`Money.zero()` 明示 → プロパティ省略）

- **計画**: Step 1 green で `itemDiscount: item.itemDiscount` → `Money.zero()`、`overallDiscount: source.overallDiscount` → `Money.zero()` に置き換える
- **実際**: 該当プロパティを `EstimateItem.create` / `EstimateVariation.create` の入力から**削除**し、「クリアする」旨のコメントを添えた
- **理由**: 両ファクトリが `input.itemDiscount ?? Money.zero()` / `input.overallDiscount ?? Money.zero()` を既定に持つため挙動は完全に同一。かつ対称化の相手である `EstimateDuplicationService`（複製）が「渡さない＝クリア」の書き方であり、そちらに揃えたほうが「同じ原則で動いている」ことがコード上で読み取れる

## ② テストの改訂元明細に `discountRate` を追加

- **計画**: Step 1 red で既存アサーションを「明細値引・全体値引はゼロ、掛率は複写」に書き換える
- **実際**: 上記に加え、テストヘルパ `buildDeliveryEstimate` の改訂元明細 A に `discountRate: new DiscountRate(0.9)` を設定した
- **理由**: 従来の改訂元明細は掛率を設定していなかったため「掛率は複写する」を実際には観測できなかった。率（継承する）と絶対額（クリアする）の対比が本 Issue の核心であり、同一テスト内で両方を検証できるようにした

## ③ `DialogDescription` も修正対象に追加

- **計画**: Step 2 の対象は「常設の告知文（136 行付近）」と「コンポーネント冒頭コメント」
- **実際**: これらに加え、モーダル見出し直下の `DialogDescription`（「掛率・値引・メモは改訂元から引き継ぎ…」）も修正した
- **理由**: 計画作成時に見落とされていたが、ここも旧セマンティクス（値引を引き継ぐ）を明言しており、放置すると同一画面内で矛盾した説明が併存するため
