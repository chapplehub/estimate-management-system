# Issue #635: SelectionModal の onConfirm 戻り値を判別可能ユニオンに統合する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`SelectionModal` の `onConfirm` の戻り値契約を、`undefined`（成功）／`SelectionRejection`（拒否）／`SELECTION_ABORTED`（Symbol・中断）の 3 表現から、`kind` 判別可能ユニオン `SelectionOutcome` へ統合する。戻り値を必須にすることで素の `return;` をコンパイルエラーにし、#634 で踏んだ「`undefined` が確定成功に化ける」バグクラスを構造的に消す。

```ts
export type SelectionRejection = { kind: "rejected"; message: string; invalidIds: string[] };

export type SelectionOutcome =
  | { kind: "confirmed" }   // 閉じる
  | SelectionRejection      // 閉じない・理由と原因行を表示
  | { kind: "aborted" };    // 閉じない・理由なし（通知は callReadAction の toast）

onConfirm: (selectedItems: TData[]) => SelectionOutcome | Promise<SelectionOutcome>;
```

あわせて、`useVariationLineEditor.handleProductSelect` が並行削除（`getProductLineSnapshot` / `expandSetComponents` の `null`）を無言 no-op（閉じて何も追加しない）にしていた挙動を `rejected` へ変更する。これは `docs/claude-plans/issue-618/deviations.md` の「2. スナップショット/展開が取得できない商品が混ざった場合の扱い」で「計画に無い設計判断を足さない規約のため既存挙動を温存した」と明記された**先送りの回収**にあたる。

## 設計判断

### 1. union のメンバーは「モーダルの振る舞い」で切る（原因では切らない）

- A. `confirmed` / `rejected` / `aborted` の 3 メンバー（採用）
- B. 原因ごとにメンバーを増やす（`not_selected` / `deleted` / `unresolvable` …）
- 採用理由: モーダルが取りうる振る舞いは「閉じる」「留まって理由を出す」「留まって黙る」の 3 つで打ち止め。原因の分類を union に持ち込むと振る舞いは 3 つのまま枝だけが増える。原因の違いは `message`（データ）で表す。

### 2. 「0 件選択」は union に載せず、入力側で扱う

- A. `onConfirm` の引数を `TData[]` のまま維持し、不変条件は JSDoc に記述（採用）
- B. 引数を非空タプル `[TData, ...TData[]]` にして署名で表現
- 採用理由: `noUncheckedIndexedAccess` が off のため `rows[0]` は今も B でも同じく `TData` 型で、**呼び出し元から見た型は変わらない**。B の強制力はモーダル側の narrowing にしか働かず、タプル型の読解コストに見合わないと判断した。
- 帰結: 「0 件では呼ばれない」不変条件は `SelectionModal.handleConfirm` の `if (selectedItems.length === 0) return;` 1 行に集約し、呼び出し元 9 箇所の防御ガードは削除する。呼び出し元のガードは「他人が守っている不変条件を各自で再確認する過剰防御」だが、モーダル側の 1 行は「自分が作った不変条件を自分で確認するアサーション」であり性質が異なる。

### 3. 判別子は `kind`、メンバー名は `confirmed` / `rejected` / `aborted`

- コードベース調査の結果、`kind` が唯一の判別子慣習（`kind: "line"` 22 / `kind: "setGroup"` 14 / `kind: "taxRateMismatch"` 8 ほか）。`outcome` / `tag` を判別子に使った前例はゼロ。
- 承認ドメインの `ApplicationStatus.REJECTED`（日本語ラベル「差戻」）と英語表記が同音になるが、`SelectionModal` は `src/app/_components/shared/` のドメイン非依存な汎用 UI 部品であり語彙圏が異なるため許容する。日本語側は「差戻」と「拒否」で衝突していない。ADR スラッグ由来の `vetoed` / `SelectionVeto` へ寄せる案は、定着済みの `SelectionRejection` と「拒否」に対して 3 つ目の英単語を増やすため不採用。

### 4. 3 値は定数ではなくリテラルで返す

- A. リテラル `return { kind: "confirmed" };`（採用）
- B. `export const SELECTION_CONFIRMED = { kind: "confirmed" } as const;` などの名前付きシングルトン
- 採用理由: B は同一性比較（`outcome === SELECTION_ABORTED`）を可能にしてしまい、廃止する Symbol sentinel の思考様式が残る。別の場所で `{ kind: "aborted" }` をインラインで組み立てた瞬間に「型は通るのに false」になる。判別可能ユニオンの正しい意味論は構造比較。
- 帰結: `SELECTION_ABORTED`（値）と `SelectionAborted`（型）を廃止する。型は union に `SelectionOutcome` という名前が付くため個別メンバー型を参照する必要がない。テストの `expect(outcome).toBe(SELECTION_ABORTED)`（`useVariationLineEditor.test.ts` 5 箇所）は構造比較へ書き換える。

### 5. 並行削除（`null`）は `confirmed` ではなく `rejected` にする（挙動変更）

- A. `{ kind: "rejected" }`（採用）
- B. `{ kind: "confirmed" }`（現状維持＝閉じて何も追加しない）
- 採用理由: 現状は「10 件選んで 1 件が削除済みなら、黙って 0 件追加して閉じる」であり、ユーザーは「追加できた」と「何も起きなかった」を区別できない。#634 と同じクラスの無言失敗。`prepared` は `rows` とインデックス整合しているため、どの行が消えていたかを既に特定できており `invalidIds` の材料は揃っている。直後の「単価解決不能」を `rejected` にしているのと同型の事象を、原因の違いだけで閉じる／留まるに割るのは一貫しない。

### 6. 並行削除と単価解決不能は 1 回の `rejected` に合流させる

- A. 相 1 の `null` で早期 return せず `invalidIds` / 原因の種として積み、相 3 の検証結果とまとめて 1 回返す（採用）
- B. 早期 return のまま別々に報告する
- 採用理由: ADR-20260716-r4d が拒否経路を作った目的は「原因を見せて、その行のチェックだけ外させて 1 回で再確定させる」こと。原因を小出しにすると拒否が 2 往復になり、目的と衝突する。

### 7. `aborted` は `rejected` に優先する

- A. 取得失敗（`undefined`）が 1 件でもあれば拒否材料を捨てて `{ kind: "aborted" }`（採用）
- B. 判明している拒否材料があれば `rejected` を返す
- C. 削除済みを検出したら相 2 をスキップして即 `rejected`
- 採用理由: `aborted` は「取得できていない＝判断材料が欠けている」状態であり、欠けた材料で原因を断定すると誤情報になる（取得失敗した行こそが唯一の問題だったかもしれない）。B は `callReadAction` の toast とモーダル内バナーが二重表示になり ADR-20260723-h7r 決定 3 に反する。C は無駄な往復を省ける利点があるが、判断 6 で潰したはずの「拒否 2 往復」が削除済みのケースで復活する。
- なお合流（判断 6）により相 1 で削除を検出しても相 2 へ進むため、「削除済みを検出済み + 価格取得失敗」という組み合わせが**新たに発生しうる**ようになる。この規則はその衝突を裁くためのもの。

### 8. 拒否メッセージは原因でグループ化する

- A. 原因でグループ化（採用）
  > 次の商品は追加できません（チェックを外して再度お試しください）。有効な販売単価が無い: 「商品B」、セット「S」の構成商品（構成X、構成Y）。すでに削除されている: 「商品A」
- B. 項目ごとに原因を後置
- 採用理由: 原因は共有されるのが常態（単価未設定の商品を複数選ぶ）。B では「は有効な販売単価が無い」が項目数だけ繰り返される。A なら単一原因のとき実質的に現行文言のまま 1 文に畳まれ、両原因が混ざった稀なときだけ 2 文になる。
- 既存テストの assertion は商品名の `toContain` のみ（`useVariationLineEditor.test.ts` 128/281/342-344/364-366 行）で接頭辞・全文を assert していないため、書式変更でテストは割れない。E2E にも文言の assertion は無い。

### 9. ADR-20260716-r4d は本文書き換えで改訂する（supersede しない）

- A. 本文を書き換え、「改訂履歴」節を新設して変遷を残す（採用）
- B. 新規 ADR を起票し r4d を「差替」にする
- 採用理由: r4d の**決定そのものは覆っていない**（拒否を prop / 例外 / 戻り値のどれで表すかの答えは今も「戻り値」）。変わるのは戻り値の表現方法と、根拠のひとつ「既存呼び出し元の無改修」の撤回。決定の骨格が生きているため supersede は過剰。一方 #633 の追記（82 行目）にさらに追記を重ねると、読者が 3 層を突き合わせて現在の契約を再構成することになり、しかも 3 層目が 2 層目を全否定する（Symbol 廃止）ため追記の積み増しも不適。

### 10. ADR-20260723-h7r 決定 4 の細目は横断ルールへ格上げする

- 現行の細目は「`SelectionModal` の `onConfirm` では `SELECTION_ABORTED` を返す」という一事例の対処法。`SELECTION_ABORTED` の廃止で事実として古くなるため、参照の最小更新に留めず一般化する。
- 一般化する理由: この罠は `callReadAction` 固有でも `SelectionModal` 固有でもない。`ProductSuggestDialog.confirmSuggestions` は現在「戻り値で閉じない」設計のため無事だが、await と早期 return が入れば同じ形になる。細目が事例に閉じているとレビューで指す先が無い。
- 過剰規約を防ぐため**対象外を明記**する。判定基準は「呼び出し先がその戻り値を見て分岐するか」で、通知型コールバック（`onClose` / `onChange` / `onRowSelectionChange` 等）は対象外。

### 11. CONTEXT.md は変更しない

- 今回決めたのはドメイン非依存の汎用 UI 部品の語彙（`confirmed` / `rejected` / `aborted`）であり、CONTEXT.md は業務の用語集。業務側の「拒否」は既に「解決不能」の項に「書き込み契機では操作の拒否として現れ」と記載済み。並行削除は業務概念ではなく同時実行の事故。

### 12. 判断 5（並行削除→`rejected`）は ADR にしない

- ADR-0000 の記録基準（複数コンポーネントに波及／理由が一言で言えない／2 案以上検討）のうち前 2 つを満たさない。影響は `handleProductSelect` 1 箇所、理由は「無言失敗を避ける」で一言。
- 記録先はコミットボディと本計画ファイル。#618 の逸脱記録が残した空白の回収である旨を明記する。

## ステップ

### Step 1: `onConfirm` の戻り値契約を `SelectionOutcome` に差し替える

- [x] **完了**
- 対象ファイル:
  - `src/app/_components/shared/SelectionModal.tsx`
  - `src/app/(features)/estimates/new/CreateEstimateForm.tsx`
  - `src/app/(features)/estimates/[estimateNumber]/EstimateHeaderForm.tsx`
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
  - `src/app/(features)/customer-selling-prices/_components/CustomerSelector.tsx`
  - `src/app/(features)/delivery-location-selling-prices/_components/DeliveryLocationSelector.tsx`
  - `src/app/(features)/products/[productCd]/relations/ProductRelationsForm.tsx`
  - `src/app/_components/shared/SelectionModal.test.tsx`
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.test.ts`
- テスト戦略: 実装後テスト（既存テストを新契約へ型・比較方式ともに追随させる。振る舞いを変える新規ケースは Step 2 で足す）
- 作業内容:
  - `SelectionOutcome` を新設し、`SelectionRejection` に `kind: "rejected"` を追加する
  - `SELECTION_ABORTED`（値）と `SelectionAborted`（型）を削除する
  - `onConfirm` の型を `(selectedItems: TData[]) => SelectionOutcome | Promise<SelectionOutcome>` にする。JSDoc に「0 件では呼ばれない（確定ボタンが `selectedCount === 0` で disabled）」不変条件を記述する
  - `handleConfirm` を `switch (outcome.kind)` の 3 分岐に書き換える。冒頭に `if (selectedItems.length === 0) return;` を追加する
  - 呼び出し元 10 ハンドラすべてに明示的な戻り値を追加する
  - 防御ガード 9 箇所を削除する: `if (!picked) return;` ×6（`CreateEstimateForm` 124/132/138、`EstimateHeaderForm` 129/137/143）、`if (picked) { ... }` ブロック ×2（`CustomerSelector` 27、`DeliveryLocationSelector` 30）、`if (rows.length === 0) return;` ×1（`useVariationLineEditor` 152）
  - `SelectionModal.test.tsx:35` の手写し型を `SelectionModalProps<Row>["onConfirm"]` 参照へ寄せる（`SelectionModalProps` の export が必要）
  - `useVariationLineEditor.test.ts` の `expect(outcome).toBe(SELECTION_ABORTED)` 5 箇所を構造比較へ、`expectRejection(actual: void | SelectionRejection | SelectionAborted)` を `SelectionOutcome` へ畳む
- コミットメッセージ: `refactor: SelectionModal の onConfirm 戻り値を判別可能ユニオンに統合する`
  - ボディに記載する設計判断: 判断 1・2・3・4（union の切り方 / 引数型を据え置き防御をモーダル 1 箇所へ集約 / 判別子と語彙の選定 / リテラル返却）

### Step 2: 並行削除を `rejected` へ合流させる

- [x] **完了**
- 対象ファイル:
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.ts`
  - `src/app/(features)/estimates/[estimateNumber]/useVariationLineEditor.test.ts`
- テスト戦略: TDD（期待する振る舞いを実装前に言い切れる。既存挙動の変更にあたるため RED の確認に意味がある）
- 作業内容:
  - 先に書くテスト:
    - 並行削除（`null`）が混ざったら `{ kind: "rejected" }` を返し、`message` に該当商品名と「すでに削除されている」が含まれ、`invalidIds` に該当行 ID が載る
    - 並行削除と単価解決不能が同時に成立するとき、1 回の `rejected` に両方の原因と `invalidIds` が載る
    - 相 1 の取得失敗が混ざれば、並行削除の材料があっても `{ kind: "aborted" }` を返す
    - 相 2 の価格取得失敗時も同様に `aborted` が優先する
    - 単一原因（単価解決不能のみ）のメッセージが 1 文に畳まれている
  - 実装:
    - 相 1 の `if (prepared.some((item) => item === null)) return;` を削除し、`rows` とのインデックス整合を使って削除済み行の ID と名前を種として積む
    - 相 2・相 3 は非 `null` の要素だけで走らせる
    - 相 3 の検証結果と相 1 の種を合流させ、原因でグループ化したメッセージを組み立てる（判断 8 の書式）
    - `aborted` 優先の順序を保つ（判断 7）
- コミットメッセージ: `fix: 商品の並行削除を無言 no-op から確定拒否に変える`
  - ボディに記載する設計判断: 判断 5・6・7・8。`docs/claude-plans/issue-618/deviations.md` §2 で先送りされた設計判断の回収である旨を明記する

### Step 3: 実機確認（`/verify-frontend`）

- [ ] **完了**
- 対象ファイル: なし（検証のみ）
- テスト戦略: テスト不要（実機検証。`.claude/skills/verify-frontend/SKILL.md` の手順に従う）
- 検証の狙い: **tsc と vitest が構造的に守れない箇所だけ**を見る。網羅は目的にしない。
  - tsc が保証するのは「`SelectionOutcome` を返すこと」までで、「**正しいメンバー**を返すこと」は保証しない
  - `SelectionModal.test.tsx` はモックの `onConfirm` を使うためモーダル側しか検証しておらず、`useVariationLineEditor` 以外の **8 ハンドラには単体テストが 1 本も無い**
  - とくに `if (picked) { ... }` ブロック形式の 2 箇所は、tsc が移行漏れを検出できない唯一の形（ブロックを抜けた後に `return { kind: "confirmed" }` が 1 つあれば通るため）
- 作業内容:
  1. **`confirmed` の基本経路（単一選択ハンドラ）** — 見積新規作成（`/estimates/new`）で得意先・納品先・対象商品の 3 モーダルを開いて確定し、いずれもモーダルが閉じて値が入ること。得意先を変更したとき納品先がクリアされる副作用が生きていること（ガード削除の巻き添えが無いことの確認）
  2. **tsc の死角（ブロック形式ガードを消した 2 画面）** — 得意先別販売単価（`/customer-selling-prices`）と納品先別販売単価（`/delivery-location-selling-prices`）の選択モーダルで確定し、モーダルが閉じて詳細画面へ遷移すること
  3. **`confirmed` の複数選択経路** — 見積詳細の明細編集で商品を複数選択して確定し、モーダルが閉じて行がまとめて挿入されること
  4. **`aborted` の退行ガード（#634 の再現経路）** — `learning/server-action-wire-protocol-and-fetch-stubbing.md` の fetch 差し替えを使い、明細追加の確定時に Server Action を落として **モーダルが閉じないこと**・toast が 1 枚であること・検索結果と選択チェックが維持されること・fetch 復旧後にそのまま再確定で成功することを確認する
  - 余力があれば: 有効な販売単価を持たない商品が dev DB に実在すれば、`rejected` のバナー文言（原因グループ化・判断 8）と行ハイライト（`data-invalid`）を目視する。実在データが作れなければ Step 2 の単体テストに委ねてスキップしてよい
- 検証しないと決めたもの:
  - 並行削除（`null`）→ `rejected`：検索と確定の間に商品を実削除する必要があり実機再現コストが高い。Step 2 の TDD で担保する
  - `EstimateHeaderForm`（見積編集画面）の 3 ハンドラ：`CreateEstimateForm` と構造が同一のため代表 1 画面で足りると判断
  - `ProductRelationsForm`：元々ガードを持たず `return { kind: "confirmed" }` の追加のみで、変更が加算的
- 後片付け: `browser_close` と、自分が起動した dev server のポートのみ停止する
- コミットメッセージ: なし（検証のみ。退行が見つかった場合は該当 Step の修正としてコミットする）

### Step 4: ADR 2 件を改訂する

- [ ] **完了**
- 対象ファイル:
  - `docs/adr/20260716-r4d-selection-modal-confirm-veto-by-return-value.md`
  - `docs/adr/20260723-h7r-read-action-raw-return-client-wrapper-over-result-envelope.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - r4d: 選択肢 C のコードを新 union へ差し替え／根拠「既存呼び出し元の無改修」を「#634 でそれがバグを生んだため型安全を優先して撤回」と書き換え／#633 追記（82 行目）を本文へ吸収し `SELECTION_ABORTED` の記述を削除／「改訂履歴」節を新設し初版・#633・#635 の 3 変遷を 1 行ずつ残す／最終更新日を更新
  - h7r: 決定 4 の細目を横断ルールへ格上げ（「呼び出し先の振る舞いを戻り値で制御するコールバック契約は、値の不在に意味を割り当ててはならない。判別可能ユニオンで戻り値を必須にする」）／対象外（通知型コールバック）と判定基準（呼び出し先が戻り値を見て分岐するか）を明記／最終更新日を更新
  - `docs/adr/INDEX.md` は既存エントリの改訂のため追記不要（タイトル変更が無いことを確認する）
- コミットメッセージ: `docs: SelectionModal の確定結果契約の改訂を ADR に反映する`

### Step 5: 逸脱記録を残す

- [ ] **完了**
- 対象ファイル: `docs/claude-plans/issue-635/deviations.md`
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 実装中に本計画と異なる対応をした場合のみ作成し、{元の計画内容}・{実際の実装内容}・{逸脱の理由} を記録する
  - 逸脱が無ければ本ステップはスキップし、チェックのみ入れる
- コミットメッセージ: `docs: issue-635 の実装計画からの逸脱を記録する`
