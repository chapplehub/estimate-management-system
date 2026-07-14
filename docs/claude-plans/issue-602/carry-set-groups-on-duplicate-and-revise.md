# Issue #602: 得意先改訂・見積複製でセット群（setGroups）が引き継がれず構成明細がバラの通常明細になる — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

得意先改訂（`Estimate.reviseForCustomer`）と見積複製（`EstimateDuplicationService.toCopiedDescriptor`）が、改訂元／複製元バリエーションのセット群を引き継いでいない。

**原因は設計意図ではなく取りこぼし。** `EstimateVariation._items` は ADR-0047 により通常明細と構成明細を **1 配列に同居**させているのに対し、生成側の記述子（`EstimateVariationDescriptor`）は `items`（通常明細）と `setGroups[].components`（構成明細）に**分離した入れ子形**を要求する。複製・改訂はこの「平坦 → 入れ子」の組み直しを行わず `source.items` を丸ごと `items` へ流し込んでいたため、構成明細がバラの通常明細として並び、群が消えていた。

修正方針は、平坦 ⇔ 入れ子の変換点を `EstimateVariation` に読み取り API（`lineStructure`）として一本化し、複製・改訂はそれを起点に**既存の変換規則をそのまま構成明細にも適用する**こと。

判断の根拠は ADR-20260714-k2m（起票済み）にまとめた。CONTEXT.md の「見積複製」「改訂先」「セット群」にも引き継ぎ規則を追記済み。

## 設計判断

### セット群の構成を何から作るか
- A. 元（改訂元／複製元）から群ごとスナップショット複写する
- B. セット商品マスタ（`SetProductComponent`）の現在値から再展開する
- **採用: A**。改訂先は行構成固定（ADR-0046）・数量固定（ADR-0060）で改訂元と明細 1:1 でなければ粗利スナップショット `deliveryPrice`（§8.4）が成立せず、B は原理的に不可。複製だけ B にすると、通常明細が `itemName`・数量までスナップショット複写している（マスタ追従しない）のと非対称になり、さらに Product 集約への依存を C6/C7 に新たに持ち込む。→ ADR-20260714-k2m

### 構成明細の単価・掛率・固定値引の扱い
- 構成明細も「価格付き末端行」であり通常明細と列構成が完全一致する（ADR-0047）ため、**通常明細と同一の変換規則**を適用する（単価は再解決／掛率は継承／固定値引はクリア／改訂では `deliveryPrice` スナップショットを付与）。既存 ADR（0064・pv8）の演繹であり新たな判断ではない。
- 単価解決はアプリ層が `variation.items`（＝通常明細＋構成明細）を舐めて構築済みのため、**追加対応不要**。セット群自身は価格を持たない（→価格保守対象商品ではない）ので、群の `productId` を解決対象に入れない点も現状のまま正しい。

### セット群自身のメモの扱い
- A. 複写する
- B. 固定値引と同じくクリアする
- **採用: A**。pv8 が固定値引をクリアできた根拠は「改訂先で入れ直せる＝入れ忘れは安全側の失敗」だったが、群メモにはこの前提が成立しない。群メモを更新できるのは C4 `UpdateVariation`（`replaceContent` 全置換）だけで、改訂先は行構成固定によりその経路が塞がれている（`UpdateVariationMemosCommand` はバリ単位メモと明細単位メモしか扱わず、`EstimateSetGroup` に memo の setter は存在しない）。クリアすれば改訂先の群メモは永久に空になり復旧不能。

### 平坦 → 入れ子の組み直しをどこに置くか
- A. `EstimateVariation` に読み取り API（`lineStructure`）を 1 つ追加し、複製・改訂はそれを map する
- B. 複製・改訂それぞれで `memberItemIds` の Set を作って `items` を自前フィルタする
- **採用: A**。`_items`（実体）と `_setGroups`（所属 id）の両方を持つのは `EstimateVariation` だけで、外に出すと id → 実体の再解決コードが 2 箇所に複製される。3 箇所目で同じ取りこぼしが再発する。
- **変換関数そのものは統合しない**（できない）。複製はドメインサービス（集約外）なので記述子を作り、改訂は集約内なので `EstimateItem` / `EstimateSetGroup` を直接 `create` する。加えて `EstimateFactory` が `Estimate` を import しているため `Estimate` 側から `EstimateFactory` を呼ぶ道は循環参照で塞がっている。**共通化の上限は「仕分け」**。

### 既存データの修復マイグレーション
- **やらない（スコープ外）**。セット群は金額計算に関与せず（`computeTotals` は `_items` のみ集計）、構成明細の行自体は正しく複写されているため、被害は表示のグルーピングと群見出しに限られ、合計金額・税額・粗利スナップショットは正しい。加えて複製先は生成後に自由編集可能（行の追加・削除・並べ替え）なので、複製系譜から元の群構成を機械的に当てはめると編集後の行と食い違って壊しかねない。壊れたバリエーションは再改訂・再複製で健全な状態を得る。

### 型で取りこぼしを防ぐ別イシュー（Issue 本文の未決事項 4）
- **立てない**。`EstimateVariationDescriptor.setGroups` を必須化しても `items: source.items, setGroups: []` と書けば型は通り同じ症状になる。真因は「渡し忘れ」ではなく「組み直し忘れ」であり、同型の要素（通常明細・構成明細）が 1 配列に同居する以上、型は「どちらか」を語れない。防御は `lineStructure` という唯一の変換点で入れる。

### 表示順序
- **追加対応不要**。永続化・画面ともに `sortOrder` 昇順で復元・マージソートしており（`EstimateMapper` / `PrismaEstimateQueryService`）、メモリ上の `items` 配列の並び（通常明細 → 構成明細の順に連結）は表示に影響しない。`sortOrder` を複写すれば群の表示位置（＝構成明細の最小 `sortOrder`）も連続配置も復元される。

## ステップ

### Step 1: `EstimateVariation.lineStructure` を追加する（平坦 ⇔ 入れ子の唯一の変換点）
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateVariation.ts`
  - `src/server/subdomains/estimate/domain/entities/__tests__/EstimateVariation.test.ts`
- テスト戦略: TDD（Domain 層 Entity → 単体・インメモリ）
- 作業内容:
  - `_items` を `_setGroups[].memberItemIds` で仕分け、`{ normalItems, setGroups: [{ group, components }] }` を返す読み取り getter を追加する
  - 要素は既存の `get items` と同じく `Readonly<T>` でラップする（集約境界規約）
  - 構成明細は `memberItemIds` の順（＝正準順序＝`sortOrder` 順）で返す
  - テスト観点: 群なし（全件 `normalItems`）／群 1 件（通常明細と構成明細の仕分け）／群 2 件／構成明細が `memberItemIds` の順で返る
- コミットメッセージ: `feat: EstimateVariation に lineStructure を追加しセット群の平坦⇔入れ子変換を一本化`

### Step 2: 得意先改訂でセット群を引き継ぐ
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`（`reviseForCustomer`）
  - `src/server/subdomains/estimate/domain/entities/__tests__/Estimate.test.ts`
- テスト戦略: TDD（バグ修正・再現手順が特定済み。対象は Domain 層 Entity → 単体）
- 作業内容:
  - `source.lineStructure` を起点に、通常明細と構成明細へ**同一の変換関数**（単価再解決／掛率継承／固定値引クリア／`deliveryPrice` スナップショット付与）を適用する
  - 構成明細を先に `EstimateItem.create` して id を確定させてから `EstimateSetGroup.create` の `memberItemIds` へ配線する（`EstimateFactory.buildSetGroups` と同じ手順）
  - 群の `productId` / `itemName` / `unit` / 顧客メモ / 社内メモを改訂元から複写する
  - `EstimateVariation.create` に `items: [...通常明細, ...構成明細]` と `setGroups` を渡す
  - テスト観点: 改訂先に群が元と同数存在する／**群の `memberItemIds` が新しく生成された構成明細の id を指す**（改訂元の item id ではない）／群のスナップショット属性とメモが複写される／構成明細の単価が再解決値・`itemDiscount` が 0・掛率は継承・`deliveryPrice` が付く／通常明細と構成明細が混在しても通常明細が群に吸い込まれない
- コミットメッセージ: `fix: 得意先改訂でセット群が引き継がれず構成明細がバラの通常明細になる`

### Step 3: 見積複製でセット群を引き継ぐ
- [x] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`（`toCopiedDescriptor`）
  - `src/server/subdomains/estimate/domain/services/__tests__/EstimateDuplicationService.test.ts`
- テスト戦略: TDD（バグ修正・再現手順が特定済み。対象は集約外のドメインサービスだが DB に触れない純粋変換のため単体・インメモリ）
- 作業内容:
  - `source.lineStructure` を起点に、通常明細と構成明細へ**同一の変換関数**（単価再解決／掛率継承／固定値引クリア）を適用する
  - `EstimateSetGroupDescriptor` を組み立て、`CopiedVariationDescriptor.setGroups` に積む（構成明細は群の `components` に入れ子で持たせる。id 配線は `EstimateFactory.buildSetGroups` が行う）
  - 群の `productId` / `itemName` / `unit` / 顧客メモ / 社内メモを複製元から複写する
  - テスト観点: Step 2 と対称（`deliveryPrice` を除く）。単価マップのキーが `提出区分:商品ID` である点も検証する
- コミットメッセージ: `fix: 見積複製でセット群が引き継がれず構成明細がバラの通常明細になる`

### Step 4: 既存見積へのセット群付きバリエーション追加を永続化できることを回帰テストで固定する
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/prisma/__tests__/PrismaEstimateRepository.test.ts`
- テスト戦略: TDD（`.claude/references/test-strategy.md` の表では Infrastructure 層は「テスト不要」だが、改訂は `insert` ではなく `update` の差分 upsert 経路を通り、既存見積に対して群衛星＋交差表が**新規 INSERT** される経路は型で守れない。会話で合意した回帰ガードとして 1 本だけ追加する）
- 作業内容:
  - 既存見積（セット群なし）に、セット群付きの新バリエーションを追加して `update` するケースを追加する
  - 群衛星（`estimate_set_groups`）と交差表（`estimate_set_components`）が新規 INSERT されること、既存バリエーションの群が `deleteMany(notIn)` に巻き込まれないことを検証する
- コミットメッセージ: `test: 既存見積へのセット群付きバリエーション追加の差分upsertを回帰テストで固定`

### Step 5: 実装の逸脱記録
- [ ] **完了**
- 対象ファイル: `docs/claude-plans/issue-602/deviations.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 実装中に本計画と異なる対応をした場合、{元の計画内容}・{実際の実装内容}・{逸脱の理由} を記録する
  - 逸脱がなければこの Step 自体をスキップし、チェックのみ付ける
- コミットメッセージ: `docs: issue-602 の実装計画からの逸脱を記録`
