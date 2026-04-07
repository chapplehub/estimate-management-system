# 計画からの逸脱記録

## 逸脱 1: Customer + DeliveryLocation サブドメインの同時コミット
- **計画**: Step 4（Customer）と Step 5（DeliveryLocation）を個別にコミット
- **実際**: 2つのサブドメインを1つのコミットにまとめて実施
- **理由**: DeliveryLocation が Customer の `CustomerId` を外部キーとして参照しているため、Customer の ID を `string` → `CustomerId` に変更すると、DeliveryLocation 側の TypeScript コンパイルが失敗する。pre-commit フックで全体の型チェックが走るため、両サブドメインを同時に更新・コミットする必要があった。
