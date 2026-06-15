# Issue #330: 見積詳細画面 S2 閲覧画面（read・トレーサーバレット） — 実装計画

## 概要

見積詳細画面の読み取り側を一本通すトレーサーバレット。`GetEstimateDetail`(Q1) クエリと表示 DTO を新設し、`/estimates/[estimateNumber]` に読み取り専用の見積詳細画面（全 9 領域）を実装する。read-before-write の起点で、S2 完了でデモ可能な閲覧画面が立つ。

クエリ層は product の queries を参照パターン（専用 CQRS read model）にし、プレゼンは既存 customers/products の shadcn/ui + Tailwind + RSC パターンを踏襲する（書き込み経路は持たない）。設計方針は `docs/design/estimate-detail/analysis/02_差分一覧と本実装方針.md` §4(S2)、グロッサリは CONTEXT.md、セット明細モデルは ADR-0047、商品由来属性の凍結方針は ADR-0048（本セッションで起票）に準拠する。

依存: S1（セット明細 基盤・完了済み）。後続 S3/S4/S6/S7 が本スライスに依存。

## 設計判断

`/grill-with-docs` セッションで合意済み（Q1〜Q10）。

### Q1. 読み取りの実装方式
- A. 専用 CQRS read model（`PrismaEstimateQueryService` が Prisma 直読み → DTO。product 同型）
- B. 集約再構築（repository で `Estimate` 復元 → DTO マップ）
- **採用: A**。理由: issue が「product の queries を参照」と明言、集計値は永続化済み（ADR-0033）で再構築の利得が無い、write 集約を read のために重くしない。

### Q2. セット群導出ロジックの置き場（read 側）
- A. ドメイン `SetGroupDerivationPolicy` を read 側でも再利用（構成明細を `{finalAmount, sortOrder}` 射影に変換して呼ぶ）
- B. read 側で `sum`/`min` を素の数値で再実装
- **採用: A**。理由: ADR-0047 の主題（金額・位置は導出・単一ソース）に従い、write 側 `deriveSetGroup` と導出ルールを 1 か所に保つ。Money 変換コストは些末、infra→domain 依存は Mapper の前例どおり許容。

### Q3. 明細行 DTO の形
- A. 入れ子（variation が `lines: (LineDTO | SetGroupDTO)[]`、`SetGroupDTO` が `components: LineDTO[]` と導出 `amount`/`sortOrder` を内包）
- B. フラット＋kind（`rows[]` に `kind` 判別子＋`setGroupId` 参照）
- **採用: A**。理由: 導出を DTO で 1 回確定しレンダラを dumb に保てる、構成明細の連続配置・群位置の不変条件を型で表現、ADR-0047 が斥けた「kind＋parentItemId」形を DTO で復活させない。フラット化は presentation の責務として 1 回行う。

### Q4 / ADR-0048. 商品由来属性（code/category）のスナップショット方針
- A. 作成時スナップショット（不採用: 編集中にマスタ更新が反映されない）
- B. 恒久 read-through（不採用: 確定後にマスタ変更で過去見積の表示が変わる）
- C. 編集中マスタ read-through ＋ 確定時スナップショット凍結（採用）
- **採用: C（原則のみ）。機構は申請スライスへ先送り**。凍結トリガー（申請/承認）が未実装のため、S2 は read-through（現在マスタ join）のみ実装。`itemName`/`unit` は作成時凍結のまま（性質が異なる非対称を意図的に許容）。→ **ADR-0048 起票済み・INDEX 追記済み**。

### Q5. ルートと参照キー
- `/estimates/[estimateNumber]`（自然キー）＋ query `findByEstimateNumber`。codebase 慣行（products/customers/employees の自然キー URL）に揃う。`EstimateNumber` は `[NRA]\d{7}` で URL 安全。一覧画面は S2 スコープ外。

### Q6. server/client 分割と対話性の範囲
- `page.tsx`（RSC・薄い）が ②③ を静的描画 → `VariationPanel`（client island）が ④〜⑨ を `useState`（`activeVariationIndex`/`activeRowId`）で制御。タブ切替で activeRow リセット。
- 横スクロール・左右 sticky は純 CSS。行アクティブ化はハイライトのみ（直下挿入・編集は S4）。
- **書き込み経路ゼロ**（actions.ts なし）。編集ボタンは disabled/省略、承認バッジは placeholder（D9）。

### Q7. バリエーション状態の表示意味論
- 既定タブ＝最小番号の ACTIVE バリ（全 INACTIVE なら最小番号）。
- 金額サマリー ⑨ ＝ 選択中バリの永続集計（バリは代替・合算しない）。
- 全無効警告は presentation 導出（`variations.every(v => !v.isActive)`、DTO に専用フラグは足さない）。
- 無効バリ: タブ グレーアウト＋取消線、操作行に ●有効/○無効。

### Q8. 見積 seed の方式
- A. ドメイン集約＋リポジトリ経由（採用）
- B. 生 Prisma 手書き（不採用: 金額・導出の二重実装＋ドリフト、誤値でも read はエラーにならない）
- **採用: A**。`EstimateFactory`＋集約操作＋`PrismaEstimateRepository.save()` で整合データを作る。

### Q9. テスト戦略
- query 結合テスト（実 DB・`estimateAggregateBuilder` 再利用・予約番号は repository テストと別レンジ）＋ E2E 閲覧テスト（非 serial・ADR-0017/0020）。
- presentation コンポーネント単体（RTL）は S2 では省く（E2E で担保・island を薄く保つ）。

### Q10. 残る表示スコープ（②③⑤）と DTO 完全性
- ③ 基本情報は ADR-0013 準拠で customer/deliveryLocation/department/creator を JOIN し名前・コードを DTO に含める。
- ③ 修理情報は `repairDetail`/`afterRepairDetail` を DTO に載せ REPAIR/AFTER_REPAIR のみ表示。
- ② 見積区分バッジ表示、承認バッジは placeholder、編集ボタンは disabled/省略。
- ⑤ 提出区分バッジ（per-variation・編集不可）＋状態インジケータ。**系譜ラベル（改訂元/複製元）は S6 へ先送り**。
- DTO に **`version` を前倒しで含める**（ADR-0039・S3 編集で DTO を変えずに使える）。

## ステップ

### Step 1: 表示 DTO 型を定義
- 対象ファイル: `src/server/subdomains/estimate/application/queries/dto/EstimateDetailDTO.ts`
- 作業内容:
  - 入れ子 DTO（Q3）: `EstimateDetailDTO`（見積単位＋`variations`）/ `VariationDTO`（`lines: (LineDTO | SetGroupDTO)[]`）/ `LineDTO`（通常・構成共用）/ `SetGroupDTO`（`components`＋導出 `amount`/`sortOrder`）/ 修理情報サブ型。
  - 見積単位に customer/deliveryLocation/department/creator の名前・コード（ADR-0013）、`repairDetail`/`afterRepairDetail`、`version`（Q10）を含める。
  - `LineDTO` に `productCode`/`productCategory`（read-through・ADR-0048）、`revisedDeliveryPrice: number | null`。
- コミットメッセージ: `feat: 見積詳細 表示DTO（入れ子・セット群導出・改訂価格・修理情報）を定義する（#330）`

### Step 2: EstimateQueryService インターフェースと GetEstimateDetailQuery
- 対象ファイル: `src/server/subdomains/estimate/application/queries/EstimateQueryService.ts`、`src/server/subdomains/estimate/application/queries/GetEstimateDetailQuery.ts`、`src/server/subdomains/estimate/application/factories/`（query factory 追加）
- 作業内容:
  - `EstimateQueryService` に `findByEstimateNumber(estimateNumber): Promise<EstimateDetailDTO | null>`。
  - `GetEstimateDetailQuery`（product の `GetProductByCodeQuery` 同型・薄い委譲）と factory を追加。
- コミットメッセージ: `feat: GetEstimateDetail(Q1) クエリとサービスIFを追加する（#330）`

### Step 3: PrismaEstimateQueryService（読み取り組み立て）
- 対象ファイル: `src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts`
- 作業内容:
  - estimate を number で取得し variations / items（product・revisedDetail join）/ set_groups（product join）/ set_components を include。
  - items を set_components で normal/構成に分離。各セット群の `components` を sortOrder 昇順で組み、`SetGroupDerivationPolicy`（Q2）で `amount`/`sortOrder` を導出。
  - top-level `lines` を normal の sortOrder と群導出 sortOrder でマージソート（連続配置不変条件で非交錯・ADR-0047）。
  - 永続集計はそのまま読む（ADR-0033）。product code/category は現在マスタ join（read-through・ADR-0048）。ADR-0013 で header の名前解決。
- コミットメッセージ: `feat: PrismaEstimateQueryService で見積詳細の読み取りDTOを組み立てる（#330）`

### Step 4: query 結合テスト
- 対象ファイル: `src/server/subdomains/estimate/application/queries/__tests__/GetEstimateDetailQuery.test.ts`
- 作業内容:
  - `GetProductByIdQuery.test.ts` の型＋`estimateAggregateBuilder`＋`PrismaEstimateRepository.save()` で集約を永続化（予約番号は repository テストと別レンジ）。
  - 検証: セット群導出（amount＝Σ・position＝min）、`revisedDeliveryPrice`（あり/null）、複数バリの表示順・status・submissionType、全 INACTIVE、code/category の join 正規化（D10）、入れ子 DTO の形。
- コミットメッセージ: `test: GetEstimateDetail の読み取りDTOを実DBで検証する（#330）`

### Step 5: 読み取り専用詳細画面（RSC ＋ client island）
- 対象ファイル: `src/app/(features)/estimates/[estimateNumber]/page.tsx`、`src/app/(features)/estimates/[estimateNumber]/VariationPanel.tsx`、補助コンポーネント（明細テーブル・行・サマリー等）、`src/app/(features)/estimates/_shared/labels.ts`
- 作業内容:
  - `page.tsx`（RSC・薄い）: DTO fetch、②タイトル行（見積区分バッジ・承認 placeholder・編集 disabled）と ③ヘッダーカード（基本情報＋修理情報の条件表示）を静的描画、④〜⑨ を `VariationPanel` へ委譲。
  - `VariationPanel`（client）: `activeVariationIndex`/`activeRowId` を管理。タブ（グレーアウト・取消線・全無効警告）、操作行（提出区分バッジ・状態インジケータ）、明細テーブル（1行表示・横スクロール・左右 sticky・行アクティブ化・セット群ヘッダ＋構成行・改訂薄字）、全体値引、メモ、金額サマリー（選択中バリ）。
  - 書き込み経路は作らない。系譜ラベルは出さない（S6）。
- コミットメッセージ: `feat: 見積詳細の読み取り専用画面（全9領域・閲覧モード）を実装する（#330）`

### Step 6: seed にセット・改訂を含める
- 対象ファイル: `prisma/seed.ts`、`prisma/seed-e2e.ts`
- 作業内容:
  - ドメイン経由（Q8）で全部入り見積（バリ複数・提出区分両方・セット群＋構成明細・改訂バリ＋`revisedDeliveryPrice`・INACTIVE バリ）と、全 INACTIVE 見積を追加。
  - `seed-e2e.ts` には E2E が参照する決定的データを同等に追加。
- コミットメッセージ: `feat: seed に見積（セット群・改訂・無効バリ）を追加する（#330）`

### Step 7: E2E 閲覧テスト
- 対象ファイル: `src/app/(features)/estimates/estimates-detail.e2e.ts`
- 作業内容:
  - `create-e2e-test` スキル準拠・非 serial。`seed-e2e.ts` データに対しタブ切替・セット群導出金額・改訂薄字・提出区分バッジ・無効グレー・全無効警告を検証。セレクタは ADR-0017（ヘッダ名ベース）。
- コミットメッセージ: `test: 見積詳細 閲覧画面のE2Eを追加する（#330）`

> 補足: ADR-0048（商品由来属性の read-through／確定時凍結・機構先送り）は本セッションで起票・INDEX 追記済み。
