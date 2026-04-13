# 計画からの逸脱記録

## 逸脱 1: excludeIds に動的追加分も含める
- **計画**: `excludeIds` は `[productId, ...initialRelations の relatedProductId]` で構成（初期データのみ）
- **実際**: `excludeIds` を `[productId, ...relations.map(r => r.id)]` で構成し、動的に追加された商品も除外対象に含めた。Relation 型に `id` フィールドを追加。
- **理由**: モーダルを再度開いた際に、既に追加済み（未保存）の商品が候補に表示されるのは UX 上不自然なため。`initialRelations` のみだと、追加→モーダル再開→同じ商品を重複選択、というシナリオが発生しうる。
