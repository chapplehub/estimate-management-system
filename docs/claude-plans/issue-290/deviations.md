# Issue #290 実装の計画からの逸脱記録

## 1. variationNumber 入れ替え対応の 2 フェーズ採番を撤去

### 元の計画
更新時、`@@unique([estimateId, variationNumber])` への即時衝突（番号入れ替え時）を避けるため、
`$transaction` 内で `tx.estimateVariation.updateMany({ data: { variationNumber: { increment: 1000 } } })`
により既存バリエーションを一旦 1–99 帯の外（1000+）へ退避してから最終番号で upsert する
「2 フェーズ採番」を実装する（計画 Step 3）。

### 実際の実装
2 フェーズ採番（updateMany による退避）を撤去し、update パスを **id キーの直接 upsert** にした。
update の流れは「ルート更新 → 消えた variation を deleteMany(notIn) → 各 variation を id キーで
upsert（配下 item も差分 upsert）→ 修理系サブタイプ同期」のみ。

### 逸脱の理由
実装後のテストで以下 2 点が判明した（計画立案時・設計検証時ともに見落としていた）。

1. **DB の CHECK 制約**: `estimate_variations` に
   `CHECK ("variation_number" >= 1 AND "variation_number" <= 99)`
   （`prisma/migrations/20260520013104_add_estimate_variation_items/migration.sql`）があり、
   `+1000` への退避は CHECK 制約違反になる。しかも退避 updateMany は全更新で走るため、
   番号入れ替えに限らず**あらゆる更新が失敗**していた。

2. **集約ルートに番号変更 API が無い**: `Estimate` の公開 API には `changeVariationNumber`
   に相当するメソッドが無く（`addVariation` / `removeVariation` はあるが既存 variation の番号は
   変えられない）、**番号の入れ替えは現状のドメイン API では到達不能**。survivor の
   variationNumber は upsert で不変のため、`@@unique` への即時衝突は実運用で発生しない。

到達不能なパスのために CHECK 制約と両立しない複雑な退避ロジックを持つのは過剰であり、
現実に起こる全更新（item 追加/削除/数量変更、variation 追加/削除、メモ・割引・税率変更、
修理系 detail の attach/detach）は id キー直接 upsert で正しく処理できる。
万一将来 collision が起きても Prisma の `P2002` で顕在化し、サイレントな不整合にはならない。

### 将来 variationNumber 変更 API を追加する場合の選択肢（別 Issue 相当）
- option 2: [1,99] 内の空き番号を一時スロットに使う汎用サイクル再採番
- option 3: `(estimateId, variationNumber)` UNIQUE を `DEFERRABLE INITIALLY IMMEDIATE` 化し、
  トランザクション内で `SET CONSTRAINTS DEFERRED`（スキーマ変更を伴う）

### 影響を受けたテスト
当初予定していた「variationNumber 入れ替え（2 フェーズ採番）」テストは到達不能のため、
「バリエーションの追加・削除が反映され、残存バリエーションの id は保持される」テストに置換した。
