# Issue #274 実装計画: 受注(Order)系・バリエーション系譜(複製/改訂) Prisma スキーマ追加

## 概要

#272 でスコープ外とした **受注系** と **バリエーション系譜(複製/改訂)** の Prisma スキーマ5モデルを追加する。
真実の源は `docs/business/estimate/システム設計書(見積).md` の §11.2.1(系譜) と §11.4(受注)。

## 着手時に確定した設計判断（ユーザー確認済み）

| # | 論点 | 決定 | 理由 |
|---|------|------|------|
| 1 | 作成者FK (`createdBy`/`confirmedBy`/`cancelledBy`) の参照先 | **Employee に統一** | #272 の `Estimate.createdBy` と整合。§9 部署権限チェックで `departmentId` を辿る必要があるため業務エンティティ `Employee` を参照する。設計書の `User` 参照は概念表記として置換する。 |
| 2 | 金額/数値の手書き CHECK 制約 | **該当なし** | 受注系5モデルは金額/数量カラムを一切持たない（明細・金額は `variation → items` を辿る設計, §4.2）。CHECK 対象が存在しないため追加しない。Issue タスク項目は「本issueでは該当なし」として `deviations.md` に記録する。 |
| 3 | 業務日時カラム (`orderDate`/`confirmedAt`/`cancelledAt`) | **`createdAt` に集約（削除）** | イベント行の `createdAt` が「受注作成/確定/取消の時刻」そのもの。同一トランザクション挿入では業務日時と冗長になるため集約し *1事実1カラム* を保つ。ただし `deliveryDate`(納期=未来日) は挿入時刻と無関係なため NOT NULL 独立カラムとして保持する。 |

## 実装規約（#272 / ADR 踏襲）

- **ID**: `String @id @db.Uuid`（`@default` なし、ドメイン層で UUIDv7 採番。ADR-0009）
- **日時**: `@db.Timestamptz(3)`（ADR-0010）。`createdAt @default(now())` / `updatedAt @updatedAt` は全モデルに付与（リポジトリ全モデルの共通慣習）
- **文字列**: `@db.VarChar(N)`。メモ系 `orderNote` は `VarChar(2000)`（ADR-0019）
- **NULL 排除**: 確定/取消はイベントテーブル化（行の存在＝状態）。複製/改訂は `kind` 統合せず別交差テーブルに分離
- **二重派生の禁止**（同一バリエーションが複製かつ改訂）はドメイン層で担保（ADR-0019）。スキーマでは制約しない
- **テーブル/カラム名**: snake_case（`@map` / `@@map`）

## 追加モデル（5つ）

### 1. `Order`（受注本体, テーブル `orders`）

```prisma
model Order {
  id          String            @id @db.Uuid // ドメイン層でUUIDv7生成
  // 見積番号を受注番号として使用。1 バリエーション : 1 受注
  variationId String            @unique @map("variation_id") @db.Uuid
  variation   EstimateVariation @relation("VariationOrder", fields: [variationId], references: [id])

  // status カラムは持たない。確定/取消は OrderConfirmation / OrderCancellation の行の存在で導出
  //   confirmation あり → 受注確定済 / cancellation あり → 受注取消済 / どちらもなし → 受注作成済
  // 受注日時は createdAt に集約（業務日時 orderDate は持たない）

  orderNote String? @map("order_note") @db.VarChar(2000) // 任意メモ（真に任意 → NULL 許容）

  // 作成者（Employee 参照。#272 と整合）
  createdBy String   @map("created_by") @db.Uuid
  creator   Employee @relation("OrderCreator", fields: [createdBy], references: [id])

  // 確定/取消イベント（それぞれ高々 1 件）
  confirmation OrderConfirmation?
  cancellation OrderCancellation?

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([variationId])
  @@index([createdBy])
  @@map("orders")
}
```

### 2. `OrderConfirmation`（受注確定イベント, テーブル `order_confirmations`）

```prisma
// 行の存在＝確定済み。確定時のみ 1:1 で存在
model OrderConfirmation {
  id      String @id @db.Uuid // ドメイン層でUUIDv7生成
  orderId String @unique @map("order_id") @db.Uuid
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  deliveryDate DateTime @map("delivery_date") @db.Timestamptz(3) // 納期（確定時必須 → NOT NULL）

  // 確定者（Employee 参照）。確定時刻は createdAt に集約（confirmedAt は持たない）
  confirmedBy String   @map("confirmed_by") @db.Uuid
  confirmer   Employee @relation("OrderConfirmer", fields: [confirmedBy], references: [id])

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([confirmedBy])
  @@map("order_confirmations")
}
```

### 3. `OrderCancellation`（受注取消イベント, テーブル `order_cancellations`）

```prisma
// 行の存在＝取消済み。取消時のみ 1:1 で存在
model OrderCancellation {
  id      String @id @db.Uuid // ドメイン層でUUIDv7生成
  orderId String @unique @map("order_id") @db.Uuid
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // 取消者（Employee 参照）。取消時刻は createdAt に集約（cancelledAt は持たない）
  cancelledBy String   @map("cancelled_by") @db.Uuid
  canceller   Employee @relation("OrderCanceller", fields: [cancelledBy], references: [id])

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([cancelledBy])
  @@map("order_cancellations")
}
```

### 4. `EstimateVariationCopy`（複製による派生, テーブル `estimate_variation_copies`）

```prisma
// 見積複製による派生（§5）。target を @unique とし 1 派生先は高々 1 出自
model EstimateVariationCopy {
  id String @id @db.Uuid // ドメイン層でUUIDv7生成

  copiedVariationId String            @unique @map("copied_variation_id") @db.Uuid
  copiedVariation   EstimateVariation @relation("VariationCopyTarget", fields: [copiedVariationId], references: [id], onDelete: Cascade)

  sourceVariationId String            @map("source_variation_id") @db.Uuid
  sourceVariation   EstimateVariation @relation("VariationCopySource", fields: [sourceVariationId], references: [id])

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([sourceVariationId])
  @@map("estimate_variation_copies")
}
```

### 5. `EstimateVariationRevision`（得意先改訂による派生, テーブル `estimate_variation_revisions`）

```prisma
// 得意先改訂による派生（§7）
model EstimateVariationRevision {
  id String @id @db.Uuid // ドメイン層でUUIDv7生成

  revisedVariationId String            @unique @map("revised_variation_id") @db.Uuid
  revisedVariation   EstimateVariation @relation("VariationRevisionTarget", fields: [revisedVariationId], references: [id], onDelete: Cascade)

  sourceVariationId String            @map("source_variation_id") @db.Uuid
  sourceVariation   EstimateVariation @relation("VariationRevisionSource", fields: [sourceVariationId], references: [id])

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([sourceVariationId])
  @@map("estimate_variation_revisions")
}
```

## 既存モデルへの逆リレーション追加

### `EstimateVariation` に5本の逆リレーションを追加

```prisma
  // 受注（1:1。@unique 側の逆参照なので Optional 単数）
  order Order? @relation("VariationOrder")

  // 複製系譜
  copyTarget EstimateVariationCopy?  @relation("VariationCopyTarget")  // この V が複製で生まれた（高々1）
  copySource EstimateVariationCopy[] @relation("VariationCopySource")  // この V を元に複製された先（複数可）

  // 改訂系譜
  revisionTarget EstimateVariationRevision?  @relation("VariationRevisionTarget")  // この V が改訂で生まれた（高々1）
  revisionSource EstimateVariationRevision[] @relation("VariationRevisionSource")  // この V を元に改訂された先（複数可）
```

### `Employee` に作成者/確定者/取消者の逆リレーションを追加

```prisma
  // 受注関連の逆参照（Employee 参照に統一したため必要）
  createdOrders        Order[]             @relation("OrderCreator")
  confirmedOrders      OrderConfirmation[] @relation("OrderConfirmer")
  cancelledOrders      OrderCancellation[] @relation("OrderCanceller")
```

## マイグレーション SQL の手書き追記

- **CHECK 制約**: 受注系5モデルは数値/金額カラムを持たないため **追加なし**（決定#2）
- Prisma が生成する SQL（CreateTable / CreateIndex / AddForeignKey）をそのまま使用
- FK の `onDelete`:
  - `OrderConfirmation`/`OrderCancellation` → `Order`: **Cascade**（設計書通り。受注削除でイベントも消える）
  - `EstimateVariationCopy.copiedVariation` / `Revision.revisedVariation` → **Cascade**（派生先が消えれば系譜も消える）
  - `*.sourceVariation` / `Order.variation` / 作成者FK → デフォルト（Restrict。出自/受注元は保護）

## 実装ステップ（コミット単位）

1. **スキーマ追加（受注系3モデル）** — `Order` / `OrderConfirmation` / `OrderCancellation` を `schema.prisma` に追記
   - コミット: `feat: 受注系 Prisma モデル追加（Order＋確定/取消イベント）`
   - ボディ: status カラム不採用（行の存在で状態導出）/ 作成者は Employee 参照 / 業務日時は createdAt 集約、の判断理由を記載
2. **スキーマ追加（系譜2モデル）** — `EstimateVariationCopy` / `EstimateVariationRevision` を追記
   - コミット: `feat: バリエーション系譜 Prisma モデル追加（複製/改訂の交差テーブル分離）`
   - ボディ: kind 統合せず別表分離した理由（NULL 排除）を記載
3. **逆リレーション追加** — `EstimateVariation`(5本) と `Employee`(3本) に逆参照を追記
   - コミット: `feat: EstimateVariation/Employee に受注・系譜の逆リレーション追加`
4. **マイグレーション生成・適用** — `pnpm db:migrate`（CHECK 追記は該当なし）、`pnpm db:generate`
   - コミット: `feat: 受注系・系譜のマイグレーション追加`
5. **deviations 記録** — `docs/claude-plans/issue-274/deviations.md` に下記を記録
   - 設計書の `User` 参照 → `Employee` に置換（決定#1）
   - 業務日時カラム `orderDate`/`confirmedAt`/`cancelledAt` を削除し `createdAt` に集約（決定#3）
   - 「金額/数値 CHECK 制約」は対象なしのため未追加（決定#2）
   - 全イベント/交差テーブルに `updatedAt` を付与（設計書概念表記は createdAt のみ。リポジトリ慣習に合わせた）

## 受け入れ条件の確認方法

- [ ] 5モデルが `schema.prisma` に追加され migrate 適用・`prisma generate` 成功
- [ ] CHECK 制約は対象なし（決定#2を deviations に明記）
- [ ] `pnpm build` / `pnpm test` / `pnpm lint` オールグリーン

## DDD レイヤリング上の留意

- 本 issue は **Prisma スキーマ（インフラ層の DB 定義）のみ**。ドメインエンティティ/リポジトリ実装は別 issue
- 二重派生禁止・受注作成条件などの不変条件はドメイン層で担保する設計（本 issue では実装しない）
