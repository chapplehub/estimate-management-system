# Issue #618: 見積の明細追加時に複数商品の選択しても反映されない — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

見積の明細追加で商品を複数選択しても、先頭の1件しか明細に反映されないバグを直す。

**原因**: `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts` の
`handleProductSelect` が `const picked = rows[0]` で先頭1件しか処理していない。
`SelectionModal` 側は複数選択に対応済みで、選択された行を配列で `onConfirm` に渡しているため、
バグはハンドラ側だけに閉じている（Issue の「一番上のものが反映されるみたい」と一致）。

**対応**: 選択された全商品を追加できるようにする。あわせて、複数選択で1件でも有効な販売単価を
解決できない商品が混ざっていた場合は **1件も追加せず原子的に拒否**し、モーダルを閉じずに
エラー文言と原因行のハイライトを表示する（ユーザーは該当商品のチェックを外すだけで再確定できる）。

この拒否経路のため `SelectionModal` の `onConfirm` 契約を拡張する（ADR-20260716-r4d）。
既存 7 箇所の呼び出し元は無改修のまま維持する。

**スコープ外**: 周辺商品サジェスト機能そのものの変更は行わない。サジェストのボタン化は #619 へ分離した。

## 設計判断

### 複数選択時の周辺商品サジェスト
- A. 各本体商品のサジェストを順番にキュー表示する
- B. 単一選択のときだけ従来どおり発火し、複数選択では発火させない
- **決定: B**。理由: `suggestState` は単数 state のため、ループすると後勝ちで上書きされ「最後の1件だけサジェストが出る」不可解な挙動になる。B なら単一追加の既存挙動を完全に温存でき既存テストも壊れない。A は状態管理が増え #618（バグ修正）のスコープを超える。サジェストは #619 でボタン化されるため、この分岐は将来自然に消える

### 一部の商品で販売単価が解決できない場合
- A. 解決できた商品だけ追加し、不能な商品名を列挙して通知する（`confirmSuggestions` と同方針）
- B. 1件でも解決不能なら1件も追加せず原子的に拒否する
- **決定: B**。理由: 拒否時にモーダルへ留まりエラーと原因行を示せば、ユーザーは該当商品のチェックを外すだけで再確定できるため、部分追加より操作コストが低い。部分追加は「何が入って何が入らなかったか」を追加後の明細から読み取らせることになる
- セット商品の原子性（1構成でも不能ならそのセットは展開ごと拒否）は既存挙動のまま

### 確定拒否をモーダルへ伝える方法
- A. 親が `errorMessage` / `invalidIds` を prop で制御する
- B. `onConfirm` が例外を投げ、モーダルが捕捉する
- C. `onConfirm` の戻り値で拒否を表現する（`void | Promise<void | SelectionRejection>`）
- **決定: C**（ADR-20260716-r4d 起票済み）。理由: `void` を返す既存ハンドラは自動的に成功扱いとなり既存 7 箇所を無改修で維持できる／エラー表示状態はモーダル内部に留まり ADR-0015（状態の自己完結）を守れる／「単価未設定の商品が混ざっていた」は失敗ではなく回復可能な正常結果であり、B は ADR-0038 の線引きに反する

### 無効行ハイライトの検証の継ぎ目
- A. `getRowClassName?: (row) => string`（配色クラスのみ）
- B. `getRowAttributes?: (row) => { className?: string; "data-invalid"?: boolean }`
- **決定: B**。理由: A だと単体・E2E とも Tailwind の配色クラスを assert することになり、見た目の変更でテストが割れる。`LineEditTable` が既に `data-active` / `data-kind` を検証の継ぎ目に使っており、その流儀に揃える。「無効」の意味を `DataTable` に持ち込まない原則は維持（属性の中身は `SelectionModal` が決める）

### サーバ往復の粒度
- A. 一括版 Server Action（`getProductLineSnapshots(ids)` 等）を新設する
- B. 既存の単体 Server Action を `Promise.all` で並列呼び出しする
- **決定: B**。理由: 一括選択は現実的に数件〜十数件で並列化すれば体感差が出ない。一括版はクエリファクトリ・アプリ層まで波及し #618（バグ修正）のスコープが膨らむ。既存 `getProductSuggestions` も内部で `Promise.all` の N+1 を許容しており既存水準と整合する
- ただし販売単価解決は `resolveSellingPricesForDisplay` が元々 `productIds: string[]` を受けるため、**全商品＋全セット構成を1往復に集約**する（現状の N 往復より軽くなる）

### 追加した明細の着地
- **決定: モーダルの表示順のまま1ブロックとしてアクティブ行の直下に挿入し、最後の1件をアクティブにする**。理由: `SelectionModal.handleConfirm` は `data.filter(...)` で選択を拾うため配列は検索結果の表示順（クリック順ではない）で決定的。`insertNodesBelow` は既に配列を受けるため1回の `setNodes` で順序を保てる（中間レンダーが起きない）。最後の1件をアクティブにすると、続けて追加したぶんが下へ積まれ「さっき足した続きに足す」操作になる

## ステップ

### Step 1: SelectionModal に確定拒否の経路を作る（ADR-20260716-r4d）
- [ ] **完了**
- 対象ファイル:
  - `src/app/_components/shared/DataTable.tsx`
  - `src/app/_components/shared/SelectionModal.tsx`
  - `src/app/_components/shared/SelectionModal.test.tsx`（新規）
- テスト戦略: TDD
- 作業内容:
  - `DataTable` に `getRowAttributes?: (row: TData) => { className?: string; "data-invalid"?: boolean }` を追加し、`<tr>` へ展開する（既定の `border-b hover:bg-gray-50` は維持）
  - `SelectionModal` に `SelectionRejection = { message: string; invalidIds: string[] }` 型を追加し、`onConfirm` を `(items: TData[]) => void | Promise<void | SelectionRejection>` に拡張
  - `handleConfirm` を async 化: `await onConfirm(items)` の戻り値が `undefined` なら従来どおり `handleClose()`、`SelectionRejection` なら閉じずに `rejection` state へ格納
  - 拒否中は `message` を `role="alert"` で表示し、`invalidIds` に含まれる行へ `data-invalid` と配色クラスを付ける
  - 拒否状態のクリア: 新しい検索の実行時・モーダルを閉じたとき・次の確定試行時。**選択状態（`rowSelection`）は拒否時にリセットしない**（該当商品のチェックだけ外して再確定できることが目的のため）
  - 確定処理中は確定ボタンを非活性にして二重確定を防ぐ
  - テスト: `undefined` 返却で閉じる／`SelectionRejection` 返却で閉じず・文言表示・該当行に `data-invalid`／拒否後も選択状態が保たれる／新しい検索で拒否状態がクリアされる
- コミットメッセージ: `feat: SelectionModal の確定を onConfirm の戻り値で拒否できるようにする (#618)`

### Step 2: 複数商品の一括追加に対応する
- [ ] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.test.ts`
- テスト戦略: TDD（バグ修正・再現手順が特定できている）
- 作業内容:
  - `handleProductSelect` を「二相」に組み替える（原子的拒否には全件の解決完了が前提のため）
    - 相1: 選択行ごとに `Promise.all` で展開/スナップショット取得（`category === "SET"` → `expandSetComponents` / それ以外 → `getProductLineSnapshot`）
    - 相2: 通常商品 + 全セット構成の商品 ID を集約し `resolveSellingPricesForDisplay` を**1往復**で呼ぶ
    - 相3: 検証。1件でも解決不能なら `SelectionRejection` を返して**1ノードも挿入しない**
      - `invalidIds` = 原因となった**選択行の ID**（通常商品はその ID、セットはセット商品の ID）
      - `message` = 原因商品名の列挙。セットは構成商品名を列挙する（構成はモーダルの一覧に現れず行の赤だけでは原因が分からないため）
    - 相4: 全件解決できたらノードを構築し、`insertNodesBelow(prev, activeRowId, nodes)` で**1回の `setNodes`** で挿入。最後のノードをアクティブにする
  - サジェストは `rows.length === 1` かつ通常商品のときだけ従来どおり発火させる（機能自体は不変更）
  - 商品選択パスは `selectionError` を設定しなくなる（エラーはモーダル内に出るため）。`selectionError` state と バナーは `confirmSuggestions`（周辺商品）が引き続き使うため残す。追加成功時の `setSelectionError(null)` は維持し、古い周辺エラーが残らないようにする
  - テスト: 3件選択で3行追加／表示順が保たれる／最後の1件がアクティブ／1件でも解決不能なら1行も追加せず `SelectionRejection` を返す／セット構成が解決不能ならそのセット行 ID を `invalidIds` に含み構成名を message に列挙／複数選択ではサジェストを出さない／単一選択では従来どおり出す
- コミットメッセージ: `fix: 見積の明細追加で複数商品を選択しても先頭1件しか追加されない (#618)`

### Step 3: 販売単価 解決不能の E2E を新しい拒否 UX に合わせる
- [ ] **完了**
- 対象ファイル: `src/app/(features)/estimates/estimates-price-unresolvable.e2e.ts`
- テスト戦略: 実装後テスト（E2E）
- 作業内容:
  - 現状このスペックは「モーダルが閉じてバナーにエラーが出る」前提で書かれている（冒頭コメントに明記）。変更後もエラー文言はモーダル内に出るため**テストは通ってしまうが、検証内容が実態とズレた偽の緑になる**ため直す
  - 検証を新しい UX に合わせる: モーダルが閉じないこと・エラー文言がモーダル内に出ること・原因行に `data-invalid` が立つこと・明細行が追加されないこと
  - 該当商品のチェックを外せば再確定できることまで確認できるとなお良い（原子的拒否の意図そのもののため）
  - 冒頭コメントの「選択エラーバナーを描画する」という記述を実態に合わせて更新する
- コミットメッセージ: `test: 販売単価 解決不能の E2E をモーダル内拒否 UX に合わせる (#618)`

### Step 4: 複数商品の一括追加ハッピーパスを E2E で固定する
- [ ] **完了**
- 対象ファイル: `src/app/(features)/estimates/` 配下の既存見積明細スペック（ADR-0020 に従い新規ファイルは作らず既存 chain に 1 ケース追加）
- テスト戦略: 実装後テスト（E2E）
- 作業内容:
  - 明細追加モーダルで複数商品を選択して確定し、選択した全商品が明細行として現れることを検証する（Issue #618 の受け入れ条件そのものを回帰として固定）
  - 表示順のまま並ぶことも合わせて確認する
  - 配置は ADR-0020 の粒度基準（1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分）に従って決める。`estimates-variation-create.e2e.ts` / `estimates-create.e2e.ts` の既存明細追加動線を確認したうえで適切な chain に載せる
  - ローカルでは変更に関係するスペックのみ実行し、E2E 全体は CI に任せる
- コミットメッセージ: `test: 見積明細の複数商品一括追加を E2E で固定する (#618)`
