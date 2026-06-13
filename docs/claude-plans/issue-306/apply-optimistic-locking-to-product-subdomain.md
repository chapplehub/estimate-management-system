# Issue #306: 楽観ロックを product サブドメインへ適用する（ADR-0039 横断展開） — 実装計画

## 概要

ADR-0039 の横断ポリシーに基づき、product サブドメインの「既存集約を変更するコマンド」6つ（Update / Activate / Deactivate / DeactivateWithReplacement / SetProductComponents / SetProductRelations）へ楽観ロックを適用する。`ProductRepository.save` を `insert` / `update(product, expectedVersion)` に分割し、条件付き `updateMany`（WHERE id AND version + increment）で原子的にチェック。version トークンは ProductDTO → 各フォームの hidden input → Zod スキーマ → コマンド Input `expectedVersion` → リポジトリへ素通しする。先行実装は employee（#318）・delivery-location（#319）・estimate 縦切り（#301）。

product 固有の論点として、入れ替えつき無効化の `replaceInRelationsAndComponents` が「参照元商品の子行をルートを経由せず直接書き換える」ため、グリルセッション（/grill-with-docs）で ADR-0039 に**細目7**を追加した: ルートを経由しない横断一括書き込みは、影響を受けた全ルートの version を同一トランザクション内で無条件増分する。

関連ドキュメント（本計画の確定時に更新済み）:
- `docs/adr/0039-...md` 細目7（#306 / #322 参照付き）
- `CONTEXT.md` 商品セクション（周辺商品・セット商品・構成商品・無効化・入れ替え）
- #322（無効化と入れ替えの非原子性の既存リスク。本イシューのスコープ外として起票済み）

## 設計判断

### 入れ替え時の参照元商品 version の扱い
- A. `replaceInRelationsAndComponents` のトランザクション内で、影響を受けた参照元商品ルートに `version: { increment: 1 }` を無条件で打つ（expectedVersion チェックなしのシステム書き込み）
- B. 現状維持（入れ替えは楽観ロック管理外と割り切る）
- 採用: A。version を進めないと、参照元商品の編集フォームを開いていたユーザーの stale な保存（差分 upsert の deleteMany）が入れ替え結果を静かに巻き戻し、無効化済み商品への参照が復活する。受け入れ条件「後勝ちによる静かな変更喪失が起きない」を文字通り満たすため。ADR-0039 細目7 として記録済み。
- 実装注意: 参照元商品の特定は**置換前に**行う（置換後は子行が入れ替え先を指すため WHERE 条件が変わる）。

### 無効化と入れ替えの非原子性
- A. 現在の実行順序（① update(target, expectedVersion) → ② replaceInRelationsAndComponents）を維持し、非原子性は受容する
- B. 複合リポジトリメソッドで1トランザクション化する
- 採用: A。ConflictError は必ず①（何も変更される前）で発生するため、楽観ロック導入で新しい中間状態は生まれない。②単独失敗はインフラ障害級のみで既存リスク。残余リスクは #322 として起票済み（スコープ外）。

### 状態変更コマンドの更新経路
- A. 全コマンド共通の `update()` 1本で子テーブル（周辺商品・セット構成）も毎回全書き直す
- B. ルートのみ更新する `updateRoot()` を分けて Activate/Deactivate を軽量化する
- 採用: A。現在の `save` も全コマンドで delete+recreate しており完全に現状踏襲。子は商品あたり高々数十行で性能問題なし。「更新経路は1本・型で強制」という ADR-0039 の思想と一致。

### update() のトランザクション内順序
- ADR-0039 指定のため判断不要: 条件付き `updateMany`（WHERE id AND version + increment）を**トランザクション先頭**に置き、count = 0 で `ConflictError`（細目5の固定文言）を throw して全体をロールバック。その後に子の deleteMany → createMany。現在の save は子削除が先頭にあるため順序を入れ替える。

### 用語
- グリルで正準語を確定し CONTEXT.md に登録済み: **周辺商品**（not 関連商品）、**構成商品**（not 構成品）、**無効化**（not 廃止）、**入れ替え**（not 置換）。テスト名・コミットメッセージはこの語彙を使う。コード識別子（`ProductRelation` / `SetProductComponent` / `DeactivateWithReplacement`）は変更しない。

### テスト範囲
- employee 踏襲の2層（リポジトリ統合テストで stale トークン逐次再現 + 6コマンドの expectedVersion 素通し検証）に加え、細目7シナリオの統合テスト1本を追加。E2E は変更なし（hidden input は既存フローで自然に通る。競合シナリオは条件付き UPDATE の原子性が防御の実体なので統合テストで十分 — ADR-0039 のテスト方針と同じ理屈）。

## ステップ

### Step 1: リポジトリの insert / update 分割（ドメイン層 + インフラ層）
- 対象ファイル:
  - `src/server/subdomains/product/domain/repositories/ProductRepository.ts`
  - `src/server/subdomains/product/infrastructure/prisma/PrismaProductRepository.ts`
- 作業内容:
  - インターフェースの `save(product)` を `insert(product)` / `update(product, expectedVersion: number)` に分割（employee の JSDoc スタイル踏襲）
  - Prisma 実装: `insert` は create + 子 createMany。`update` はトランザクション先頭で条件付き `updateMany`（WHERE id AND version、`version: { increment: 1 }`）、count = 0 で細目5文言の `ConflictError`、続けて子の deleteMany → createMany、最後に include 付き再取得
- コミットメッセージ: `feat: ProductRepository を insert/update に分割し楽観ロックを適用する（ADR-0039）`

### Step 2: 入れ替え時の参照元商品 version 増分（ADR-0039 細目7）
- 対象ファイル:
  - `src/server/subdomains/product/infrastructure/prisma/PrismaProductRepository.ts`（`replaceInRelationsAndComponents`）
- 作業内容:
  - トランザクション内で、置換**前**に参照元商品 id を特定し、子行の付け替えと同一トランザクションで該当ルートへ `version: { increment: 1 }` を無条件適用
- コミットメッセージ: `feat: 入れ替え時に参照元商品の version を無条件増分する（ADR-0039 細目7）`
  - ボディに設計判断（細目7 の理由: stale な保存による入れ替え巻き戻りの防止、expectedVersion チェックなしの理由: ユーザー編集ではないシステム書き込みのため）を記載

### Step 3: 6コマンドの Input に expectedVersion を追加
- 対象ファイル:
  - `src/server/subdomains/product/application/commands/UpdateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/ActivateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/DeactivateProductCommand.ts`
  - `src/server/subdomains/product/application/commands/DeactivateProductWithReplacementCommand.ts`
  - `src/server/subdomains/product/application/commands/SetProductComponentsCommand.ts`
  - `src/server/subdomains/product/application/commands/SetProductRelationsCommand.ts`
  - `CreateProductCommand`（save → insert への置き換えのみ）
- 作業内容:
  - 各 Input 型に `expectedVersion: number` を追加し、`repository.update(product, input.expectedVersion)` へ素通し
  - CreateProductCommand は `insert` に置き換え
- コミットメッセージ: `feat: product 全更新系コマンドに expectedVersion を追加する（ADR-0039）`

### Step 4: クエリ側 DTO に version を追加
- 対象ファイル:
  - `src/server/subdomains/product/application/queries/dto/ProductDTO.ts` とそのマッピング箇所
- 作業内容:
  - `ProductDTO` に `version: number` を追加（一覧は状態変更ボタンを持たないため一覧専用の対応は不要）
- コミットメッセージ: `feat: ProductDTO に version を追加する（ADR-0039）`

### Step 5: プレゼンテーション層 — フォーム・ボタン・ダイアログの version 持ち回り
- 対象ファイル:
  - `src/app/(features)/products/_shared/schema.ts`（または編集用スキーマ）
  - `src/app/(features)/products/[productCd]/edit/`（schema.ts / actions.ts / フォーム）
  - `src/app/(features)/products/[productCd]/components/`（ProductComponentsForm.tsx / actions.ts）
  - `src/app/(features)/products/[productCd]/relations/`（ProductRelationsForm.tsx / actions.ts）
  - `src/app/(features)/products/[productCd]/ProductStatusForms.tsx`
  - `src/app/(features)/products/[productCd]/DeactivateWithReplacementDialog.tsx`
  - `src/app/(features)/products/[productCd]/actions.ts`
- 作業内容:
  - Zod スキーマに `version: z.coerce.number().int()` を追加（employee 踏襲）
  - 編集フォーム・セット構成フォーム・周辺商品フォームに hidden input、actions で `expectedVersion` としてコマンドへ
  - 有効化/無効化ボタン・入れ替えダイアログにも version の hidden input を追加（詳細ページ表示時点の version が編集ウィンドウのトークン。エラーは既存の ActionResult → 赤枠表示で表面化）
- コミットメッセージ: `feat: 商品の各フォーム・状態変更ボタンに version を持ち回す（ADR-0039）`

### Step 6: テスト
- 対象ファイル:
  - `src/server/subdomains/product/infrastructure/prisma/__tests__/PrismaProductRepository.test.ts`
  - `src/server/subdomains/product/application/commands/__tests__/` 配下の6コマンドテスト
- 作業内容:
  - 統合テスト①（employee 踏襲）: stale トークン逐次再現 — update(v1) 成功 → 再度 update(v1) が ConflictError、先行の変更が残存
  - 統合テスト②（細目7）: 商品Xの構成商品にP → `replaceInRelationsAndComponents(P→Q)` → Xの version が増分されている → stale な version でのXの update が ConflictError になり入れ替え結果（Q）が巻き戻らない
  - コマンド単体テスト: 6コマンドで expectedVersion の素通しを検証
- コミットメッセージ: `test: product 楽観ロックの統合テストとコマンド単体テストを追加する（ADR-0039）`
