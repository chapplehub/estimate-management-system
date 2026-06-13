# Issue #309: 楽観ロックを Delete 系コマンドへ適用する（5サブドメイン） — 実装計画

## 概要

ADR-0039 細目3に基づき、Delete 系コマンドへ楽観ロックを適用する。stale な画面を見て下した削除判断も競合の一種として扱い、`deleteMany({ where: { id, version } })` の count 検査で検出し、count = 0 なら `ConflictError`（細目5文言）を throw する。

対象は削除前チェックが**読み取り専用**の5サブドメイン:

- `DeleteCustomerCommand`
- `DeleteDeliveryLocationCommand`
- `DeleteDepartmentCommand`（findChildren チェック付き）
- `DeleteRoleCommand`（findSubordinates + isInUse チェック付き）
- `DeleteProductCommand`（ProductDeletionCheck チェック付き）

`DeleteEmployeeCommand` は対象外（#337 へ分離）。Employee は削除前に認証ユーザーを物理削除する補償不能な外部副作用を持ち、version チェックの配置順序設計が必要なため、集約境界の再設計 #317 と連動させて別途扱う。

各サブドメイン共通の最小7点変更（全て同型）:

| レイヤ | 変更 |
|---|---|
| repo interface | `delete(id, expectedVersion: number)` へシグネチャ変更 |
| prisma repo | `deleteMany({ where: { id, version } })` + count=0 → `ConflictError`（細目5文言） |
| command Input | `expectedVersion` 追加（findById ガードは維持） |
| 詳細ページ | `version={entity.version}` を DeleteForm へ渡す |
| DeleteForm | `version: number` prop + hidden input |
| action | `Number(formData.get("version"))` を読みコマンドへ素通し（Zod 新設せず） |
| test | stale 削除統合テスト追加 + 既存削除テストへ expectedVersion 付与 |

`handleCommandError` は ConflictError をメッセージそのまま表面化し、削除フォームはエラーを既に表示するため、競合表示はゼロ改修で動作する。クエリ側 DTO は全5サブドメインで version 保持済み（追加作業ゼロ）。

## 設計判断

### 削除コマンド先頭の findById（NotFound ガード）の扱い
- A. 維持する（既に削除済み → NotFound、stale 更新 → ConflictError に振り分け）
- B. 外して count=0 に一本化（既削除も Conflict 扱い）
- **推奨: A（採用）**。理由: UpdateXxxCommand の手本・ADR-0039 細目5・既存テストと整合。導入後の findById は「count=0 のうち既削除を NotFound に振り分ける選別器」として機能。department/role/product の業務ルールチェックにも findById が必須。

### UI の version 受け取り方式
- A. Zod スキーマを新設し parseWithZod で検証（issue のチェックボックス通り）
- B. 状態変更アクション（activate/deactivate）と同じく `Number(formData.get("version"))` で直接読む
- **推奨: B（採用）**。理由: 削除フォームは id+version の2項目のみで、多フィールドの更新フォームより状態変更フォームに近い。同じ詳細ページの actions.ts 内でパターン統一でき、2項目フォームに Zod ファイルを増やさない。※ issue「Zod に version 追加」からの逸脱 → deviations.md に記録。

### Employee の扱い
- 本イシューから分離し #337 で対応（#317 集約境界再設計と連動）。理由: 削除前の removeUser（補償不能な外部副作用）ゆえ「version 付き delete を先行 → 成功時のみ removeUser」の A2 順序設計が必要で、他5サブドメインの一本道と構造が異なる。独立 ADR は作らず #304 の対症療法（コメント+順序固定テスト）に倣う。※ issue 対象6コマンドからの逸脱 → deviations.md に記録。

### 業務チェックの非 atomic 性（orthogonal）
- department/role/product の findChildren/isInUse 等は読み取り専用で「業務チェック → version 付き delete」の順に並べる。version が守るのは集約ルート自身の属性変化であり、関連行の出現/消滅（子追加・使用開始）は対象外（既存リスク、ADR-0039 細目7 と同じ思想で本イシュー対象外）。判断不要。

### ADR 起票
- 本イシューでは不要（ADR-0039 細目3 の純粋な適用で新トレードオフ無し）。

## ステップ

### Step 1: customer（手本確立）
- 対象ファイル:
  - `src/server/subdomains/customer/domain/repositories/CustomerRepository.ts`
  - `src/server/subdomains/customer/infrastructure/prisma/PrismaCustomerRepository.ts`
  - `src/server/subdomains/customer/application/commands/DeleteCustomerCommand.ts`
  - `src/app/(features)/customers/[code]/CustomerDeleteForm.tsx`
  - `src/app/(features)/customers/[code]/page.tsx`
  - `src/app/(features)/customers/[code]/actions.ts`
  - `src/server/subdomains/customer/application/commands/__tests__/DeleteCustomerCommand.test.ts`
- 作業内容:
  - interface `delete(id, expectedVersion)` 化、prisma を `deleteMany` + count=0 → ConflictError（細目5文言）化
  - Input に expectedVersion 追加（findById 維持）、UI に version 持ち回り（Zod なし）
  - 既存テストへ expectedVersion 付与 + stale 削除統合テスト（update で version 前進後、旧 version delete が ConflictError・行残存）追加
- コミットメッセージ: `feat: 得意先削除コマンドへ楽観ロックを適用する（ADR-0039 細目3）`

### Step 2: delivery-location
- 対象ファイル: delivery-location の repo interface / prisma repo / DeleteCommand / DeliveryLocationDeleteForm / 詳細 page / actions / DeleteCommand.test（customer と同型）
- 作業内容: Step 1 と同じ7点変更
- コミットメッセージ: `feat: 納品先削除コマンドへ楽観ロックを適用する（ADR-0039 細目3）`

### Step 3: department
- 対象ファイル: department の repo interface / prisma repo / DeleteCommand / DepartmentDeleteForm / 詳細 page / actions / DeleteCommand.test
- 作業内容: 7点変更。既存の findChildren 業務チェックの後ろに version 付き delete を置く
- コミットメッセージ: `feat: 部署削除コマンドへ楽観ロックを適用する（ADR-0039 細目3）`

### Step 4: role
- 対象ファイル: role の repo interface / prisma repo / DeleteCommand / RoleDeleteForm / 詳細 page / actions / DeleteCommand.test
- 作業内容: 7点変更。既存の findSubordinates + isInUse 業務チェックの後ろに version 付き delete を置く
- コミットメッセージ: `feat: 役割削除コマンドへ楽観ロックを適用する（ADR-0039 細目3）`

### Step 5: product
- 対象ファイル: product の repo interface / prisma repo / DeleteCommand / ProductDeleteForm / 詳細 page / actions / DeleteCommand.test
- 作業内容: 7点変更。既存の ProductDeletionCheck 業務チェックの後ろに version 付き delete を置く
- コミットメッセージ: `feat: 商品削除コマンドへ楽観ロックを適用する（ADR-0039 細目3）`

### Step 6: deviations.md 記録
- 対象ファイル: `docs/claude-plans/issue-309/deviations.md`
- 作業内容: 2件の逸脱を記録 — ① UI で Zod を新設せず直接読み（issue「Zod に version 追加」からの逸脱）／② Employee を #309 から除外し #337 へ分離（issue 対象6コマンドからの逸脱）
- コミットメッセージ: `docs: issue-309 の計画逸脱を記録する`
