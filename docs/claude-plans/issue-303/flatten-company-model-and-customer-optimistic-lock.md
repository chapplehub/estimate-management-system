# Issue #303: 取引先モデルを平坦化し customer へ楽観ロックを適用する（ADR-0043 / ADR-0039） — 実装計画

## 概要

ADR-0039（楽観ロック横断展開）の customer 段階展開に着手した際、customer/delivery_location が
`companies` 基底テーブルを継承する **CTI（Class-Table Inheritance）** で永続化されており、楽観ロックの
`version` が集約ルート（サブタイプ `customers`）にある一方、可変状態（name/住所/isActive）の大半が基底
`companies` にあるという歪みが表面化した。調査の結果、この CTI は多態参照・型横断クエリ・型横断一意の
いずれも使っておらず計測可能な利益を生んでいないと判明したため（[ADR-0043](../../adr/0043-flatten-company-subtype-inheritance-into-aggregate-tables.md)）、
**先に取引先モデルを平坦化**してから customer に楽観ロックを適用する。

本計画は1本のイシュー/PRで2フェーズを行う:

1. **フェーズ1: 取引先モデル平坦化（振る舞い不変）** — `companies` を廃し、共通列を `customers` /
   `delivery_locations` に取り込む（集約 = 1 テーブル）。
2. **フェーズ2: customer 楽観ロック（振る舞い追加）** — 平坦化後の customer に ADR-0039 を適用する。
   company 消滅により department/role と同形の単一文 `updateMany` パターンになる。

delivery_location の楽観ロック化は本イシュー対象外（後続イシュー）。平坦スキーマには適応させるが
`save` は当面維持する。

## 設計判断

### 集約モデル: CTI 維持 vs 平坦化 vs Company 独立集約
- A. CTI 維持し customer に 2 テーブルトランザクションで楽観ロック
- B. サブタイプ平坦化（`companies` 廃止、共通列をサブタイプへ取込）
- C. `Company` を独立集約に昇格
- **採用: B**。CTI が計測可能な利益を生んでおらず、楽観ロック変換が 0 件＝埋没コスト最小の今が分岐の最良点。
  C は同時更新されるべき name 等が集約境界を跨ぎ最悪。詳細は ADR-0043。

### `code` の一意性
- A. 型内のみ一意（テーブル単位 `@unique`）
- B. 型横断グローバル一意（現行 `companies.code` 挙動を維持）
- **採用: A**。ドメインの重複チェック（各 Repository `findByCode` 経由・型内のみ）の前提と一致。
  接頭辞 C/D の別名前空間規約とも整合。型横断重複は許容する。

### マイグレーション戦略
- A. 1ファイルに expand→backfill→contract を手書き
- B. schema 書換→`migrate dev` 生成後に backfill UPDATE を手挿入
- C. reset 前提で backfill 省略
- **採用: A**。`estimate_memo_not_null` の backfill 前例（手書き UPDATE → ALTER）と同作法。
  VarChar/CHECK 制約（ADR-0019/0021）を移送列に踏襲。

### issue 構成
- A. 平坦化と customer 楽観ロックを 1 本に
- B. 平坦化と 303 を 2 本に分割
- **採用: A**。ただし PR 内のコミットはフェーズ1（構造移行）/フェーズ2（挙動追加）で明確に割り、
  レビューで「移行のバグか／ロックのバグか」を切り分け可能にする。

### isActive / version の往復
- A. 専用 Activate/Deactivate コマンド（ADR-0018）維持、version を更新フォーム＋状態フォーム両方へ往復
- B. department に倣い isActive を更新フォームへ統合し専用コマンド廃止
- **採用: A**。B は ADR-0018 逸脱かつ大きなリファクタで 303 スコープ超過。

### version の通り道（プレゼン層）
- 既存パターン踏襲（ADR-0039 / department 参照実装）のため判断不要。
- **id は code から再取得・version はフォーム値**（`submission.value.version`）を使う。再取得行の
  version は使わない（編集ウィンドウのトークンを守るため）。`version: z.coerce.number().int()`（#314 統一）。

### customer リポジトリのシグネチャ
- 既存パターン踏襲（ADR-0039）のため判断不要。`save` を `insert(customer)` /
  `update(customer, expectedVersion)` に分割。平坦化後は単一テーブルのため update はトランザクション不要の
  単一文 `updateMany`。

## ステップ

### フェーズ1: 取引先モデル平坦化（振る舞い不変）

### Step 1: 平坦化マイグレーション手書き
- 対象ファイル: `prisma/migrations/{timestamp}_flatten_company_into_subtypes/migration.sql`
- 作業内容:
  - Expand: `customers` / `delivery_locations` に共通列追加（code/name/postal_code/prefecture/address/phone_number/fax_number/contact_person/is_active）。VarChar(N)・CHECK を踏襲
  - Backfill: `UPDATE ... FROM companies WHERE company_id = companies.id` で値移送
  - Contract: `company_id` FK・列 drop、`companies` テーブル drop、`CompanyType` enum drop、`code` に型内 `@unique` 追加
- コミットメッセージ: `feat: 取引先モデルを平坦化するマイグレーションを追加する（companies廃止・ADR-0043）`

### Step 2: schema.prisma 平坦化
- 対象ファイル: `prisma/schema.prisma`
- 作業内容:
  - `Customer` / `DeliveryLocation` モデルに共通列を定義、`companyId`/`company` リレーション削除
  - `Company` モデル・`CompanyType` enum 削除
  - `pnpm db:generate` で Prisma Client 再生成
- コミットメッセージ: `feat: schema を平坦化し Company モデルと CompanyType を削除する`

### Step 3: customer ドメイン/インフラの平坦化
- 対象ファイル: `Customer.ts`, `CustomerMapper.ts`, `PrismaCustomerRepository.ts`, `PrismaCustomerQueryService.ts`, `CustomerId` 利用箇所
- 作業内容:
  - `Customer` エンティティから `_companyId` 除去（constructor/create/reconstruct）
  - `CustomerMapper` を単一テーブル変換へ（company ネスト書き込み廃止）
  - `findByCode`・QueryService から company join / type 絞りを除去
  - `CompanyId` VO 利用を除去
- コミットメッセージ: `refactor: customer を単一テーブル集約へ平坦化する`

### Step 4: delivery-location ドメイン/インフラの平坦化
- 対象ファイル: `DeliveryLocation.ts`, `DeliveryLocationMapper.ts`, `PrismaDeliveryLocationRepository.ts`, `PrismaDeliveryLocationQueryService.ts`
- 作業内容:
  - 同様に平坦化。`save` は維持（楽観ロックは後続イシュー）
  - `CompanyId` VO 利用を除去
- コミットメッセージ: `refactor: delivery-location を単一テーブル集約へ平坦化する`

### Step 5: CompanyId VO / CompanyType の削除と seed 更新
- 対象ファイル: `src/server/shared/domain/values/CompanyId.ts`, `prisma/seed.ts`, `prisma/seed-e2e.ts`
- 作業内容:
  - 未参照になった `CompanyId` VO を削除
  - seed の company ネスト生成 → 平坦生成へ書換
- コミットメッセージ: `refactor: CompanyId VO を削除し seed を平坦スキーマへ更新する`

### Step 6: フェーズ1のテスト更新
- 対象ファイル: customer/delivery-location の entity/mapper/command/query テスト、`customers-*.e2e.ts`
- 作業内容:
  - 新形状（companyId 無し・単一テーブル）に合わせてテストを更新
  - `pnpm test` / `pnpm e2e` グリーン確認（挙動不変）
- コミットメッセージ: `test: 平坦化に伴い customer/delivery-location のテストを更新する`

### フェーズ2: customer 楽観ロック（振る舞い追加）

### Step 7: リポジトリの insert/update 分割
- 対象ファイル: `CustomerRepository.ts`, `PrismaCustomerRepository.ts`
- 作業内容:
  - インターフェースの `save` を `insert(customer)` / `update(customer, expectedVersion)` に分割
  - 実装: insert は単一 create、update は `updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })`、count = 0 で `ConflictError`（ADR-0039 細目5 文言）
- コミットメッセージ: `feat: customer リポジトリに楽観ロック（insert/update分割）を導入する（ADR-0039）`

### Step 8: コマンドの expectedVersion 素通し
- 対象ファイル: `UpdateCustomerCommand.ts`, `ActivateCustomerCommand.ts`, `DeactivateCustomerCommand.ts`
- 作業内容:
  - 各 Input に `expectedVersion` を追加し、`update(customer, expectedVersion)` を呼ぶ（`save` 廃止）
- コミットメッセージ: `feat: customer 更新系コマンドに expectedVersion を素通しする`

### Step 9: クエリ DTO に version を追加
- 対象ファイル: `CustomerDTO.ts`, `SearchCustomersQuery` / `GetCustomerByCodeQuery` / `GetCustomerByIdQuery` と各 QueryService
- 作業内容:
  - `CustomerDTO` に `version` 追加、両クエリで select
- コミットメッセージ: `feat: customer クエリ DTO に version を追加する`

### Step 10: プレゼン層の version 往復
- 対象ファイル: `[code]/schema.ts`, `CustomerUpdateForm.tsx`, `CustomerStatusForms.tsx`, `[code]/actions.ts`, 詳細 `page.tsx`
- 作業内容:
  - `updateCustomerSchema.extend({ version: z.coerce.number().int() })`
  - `CustomerUpdateForm` に hidden version、`CustomerStatusForms` に version prop ＋ 有効化/無効化フォーム両方に hidden version
  - `updateCustomer`/`activateCustomer`/`deactivateCustomer` アクションで `expectedVersion` を素通し（id は再取得・version はフォーム値）
  - `handleCommandError` が `ConflictError.message` を表示に変換することを確認
- コミットメッセージ: `feat: customer 編集・状態変更フォームに version 往復を追加する`

### Step 11: フェーズ2のテスト
- 対象ファイル: `PrismaCustomerRepository` 統合テスト、各コマンド単体テスト
- 作業内容:
  - リポジトリ統合: stale トークン逐次再現（insert → update(v1) 成功 → update(v1) が ConflictError、先行変更が残存）
  - コマンド単体: expectedVersion の素通し検証
- コミットメッセージ: `test: customer 楽観ロックの lost update 防止テストを追加する`

### 完了時

- [ ] `docs/claude-plans/issue-303/deviations.md` に再スコープ（CTI 2テーブルロック → 平坦化＋ロック）を記録（CLAUDE.md 準拠）
