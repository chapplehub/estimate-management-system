# ADR-20260716-r4d: SelectionModal の確定拒否は onConfirm の戻り値で表現する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-16 |
| 最終更新日 | 2026-07-24 |

## コンテキスト

`SelectionModal` は確定時に `onConfirm(selectedItems)` を呼んだ直後、無条件で自身を閉じる。つまり「親が確定を拒否する」余地が契約上ゼロだった。

見積の明細追加（#618）で複数商品の一括選択に対応するにあたり、「選択した商品のうち1件でも有効な販売単価を解決できなければ、1件も追加せず拒否する」（ADR-0064: 0円明細を作らない、の一括版）という原子的な拒否が必要になった。

このとき、モーダルを閉じてから親の画面上にエラーバナーを出すと、ユーザーは「どの商品が原因か」を確かめるためにモーダルを開き直し、検索し直し、選択し直すことになる。**モーダルに留まったままエラーを示し、原因の行を可視化できれば、ユーザーは該当商品のチェックを外すだけで再確定できる**。

そのためには「親が確定を拒否し、その理由と原因行をモーダルへ伝える」経路が要る。

> 初版（#618）では「既存7箇所の呼び出し元を1行も変えずに済ませる」ことも要件に置いていたが、#635 で撤回した（下記「改訂履歴」）。無改修を成立させていた「戻り値なし＝成功」の性質が、確定成立の明示と書き忘れを区別できなくする原因だったため。

## 検討した選択肢

### A. 親が prop でエラー状態を制御する（不採用）

```tsx
const [error, setError] = useState<string | null>(null);
const [invalidIds, setInvalidIds] = useState<string[]>([]);

<SelectionModal
  isOpen={open}
  errorMessage={error}
  invalidIds={invalidIds}
  onConfirm={async (items) => {
    const result = await validate(items);
    if (!result.ok) { setError(result.message); setInvalidIds(result.ids); return; }
    setOpen(false);
  }}
/>
```

### B. onConfirm が例外を投げ、モーダルが捕捉する（不採用）

```tsx
onConfirm={async (items) => {
  const result = await validate(items);
  if (!result.ok) throw new SelectionRejectedError(result.message, result.ids);
}}
```

### C. onConfirm の戻り値で拒否を表現する（採用）

```ts
export type SelectionRejection = { kind: "rejected"; message: string; invalidIds: string[] };

export type SelectionOutcome =
  | { kind: "confirmed" }   // 閉じる
  | SelectionRejection      // 閉じない・理由と原因行を表示
  | { kind: "aborted" };    // 閉じない・理由なし（通知は callReadAction の toast）

onConfirm: (selectedItems: TData[]) => SelectionOutcome | Promise<SelectionOutcome>;
```

判別可能ユニオンのメンバーは**モーダルの振る舞い**で切る（原因では切らない）。モーダルが取りうる振る舞いは「閉じる」「留まって理由を出す」「留まって黙る」の3つで打ち止めであり、原因の分類を union に持ち込むと振る舞いは3つのままで枝だけが増える。原因の違いは `message`（データ）で表す。

## 決定

`SelectionModal` の `onConfirm` は確定結果 `SelectionOutcome` を**必ず返す**契約とし、モーダルはその `kind` で分岐する（選択肢 C）。`confirmed` なら閉じ、`rejected` なら閉じずにエラーと該当行ハイライトを表示し、`aborted` なら閉じず理由も出さずに画面 state を凍結する。

## 根拠

- **書き忘れが型で露見する**: 戻り値を必須にしたことで、素の `return;` や末尾到達がコンパイルエラー（TS2366）になる。「値の不在に意味を割り当てない」という横断ルール（ADR-20260723-h7r 決定4）の具体適用であり、#634 で踏んだ「早期 return の `undefined` が確定成功に化ける」バグクラスを構造的に消す
- **ADR-0015 の維持**: エラー文言・ハイライトの表示状態はモーダル内部の state のままで、親は「判定結果を返すだけ」。選択肢 A は `errorMessage` / `invalidIds` の state を親に持たせるため、ADR-0015（モーダルがデータ・選択状態を自己完結管理する）が掲げたカプセル化と「利用側のコード最小化」を、拒否を使う画面から順に切り崩していく
- **失敗ではなく予測可能な正常結果**: 「単価未設定の商品が選択に混ざっていた」はバグでも異常でもなく、ユーザー操作の予測可能な結果であり、その場で回復可能（チェックを外して再確定）。ADR-0038 の「失敗は例外・予測可能な複数の正常結果は union」の線引きに照らすと、これは例外ではなく戻り値で表す側に属する。選択肢 B は制御フローに例外を使うことになり、この線引きに反する
- **型で経路を強制できる**: 戻り値型が `SelectionOutcome` であることで、親は「何を返せばモーダルが留まるか」を型から辿れる。モーダル側の `switch (outcome.kind)` も、将来メンバーを足したときに網羅漏れが露見する

### 不採用理由

- **選択肢 A**: ADR-0015 のカプセル化を壊す。親が open 状態とエラー状態を二重に管理することになり、「新しい検索を実行したらエラーを消す」等の整合をモーダル外で再実装する必要が出る
- **選択肢 B**: 回復可能なユーザー操作結果に例外を使うことになり ADR-0038 の線引きに反する。また `try/catch` を挟む都合上、親の他の実装バグ（想定外の例外）まで「選択拒否」として握り潰す危険がある

## 影響

- `SelectionModal` は `onConfirm` を `await` する必要があり、確定処理中は二重確定を防ぐ必要がある（確定ボタンの非活性）
- 行ハイライトのため `DataTable` に汎用の行属性フック `getRowAttributes?: (row: TData) => { className?: string; "data-invalid"?: boolean }` を足す。「無効」という意味は `DataTable` は知らず、何を返すかを決める `SelectionModal` に閉じる（テーブルは表示の汎用部品のまま保つ）
- ハイライトは配色クラスと併せて `data-invalid` を立てる。テスト（単体・E2E）は `data-invalid` を検証の継ぎ目にし、配色クラスを assert しない（`LineEditTable` の `data-active` / `data-kind` と同じ流儀）。これにより見た目の変更でテストが割れない
- 拒否状態（エラー文言・ハイライト）は、新しい検索の実行時・モーダルを閉じたとき・次の確定試行時にクリアする。ユーザーが原因行のチェックを外している間は保持し、どれが原因だったかを見失わせない
- 拒否時に選択状態（`rowSelection`）はリセットしない。ユーザーが該当商品のチェックだけを外して再確定できることが、この決定の目的そのものであるため
- `aborted`（非業務例外で確定に必要なデータを取得できなかった中断）はモーダル内に理由を出さない。通知は `callReadAction` の toast 1枚に集約する方針（ADR-20260723-h7r 決定3）があり、モーダル内バナーと二重表示になるため。検索結果・選択状態を凍結し、ユーザーが同じ選択のまま再確定でリトライできるようにする
- **拒否（`rejected`）と中断（`aborted`）は別の枝**として区別する。拒否は「業務上追加できない」という予測可能な正常結果、中断は「取得そのものに失敗した」であり意味が異なる。両方の材料が揃った場合は**中断が優先**する（取得できていない＝判断材料が欠けている状態で原因を断定すると誤情報になるため）
- 3値は名前付きシングルトンを export せず、リテラルを返して構造で判別する。シングルトンは同一性比較（`===`）を可能にしてしまい、別の場所でインラインに組み立てた値が「型は通るのに一致しない」罠を残す
- `onConfirm` に渡る `selectedItems` は**必ず1件以上**（確定ボタンが `selectedCount === 0` で disabled）。この不変条件はモーダルが作り、`handleConfirm` 冒頭の1行で自己確認する。呼び出し元が各自で `rows[0]` の存在を再確認するのは、他人が守っている不変条件の再確認＝過剰防御にあたるため置かない
- 対象ファイル: `src/app/_components/shared/SelectionModal.tsx`, `src/app/_components/shared/DataTable.tsx`

## 改訂履歴

| 日付 | 契機 | 変更内容 |
|---|---|---|
| 2026-07-16 | 初版（#618） | 拒否を `onConfirm` の戻り値で表現すると決定。`undefined` = 成功で閉じる / `SelectionRejection` = 閉じずに理由と原因行を表示の2状態 |
| 2026-07-23 | #633 | 非業務例外での中断を表す第3の戻り値 `SELECTION_ABORTED`（Symbol sentinel）を**加算的に**追加（ADR-20260723-h7r） |
| 2026-07-24 | #635 | 3状態を `kind` 判別可能ユニオン `SelectionOutcome` へ統合し、戻り値を必須化。`SELECTION_ABORTED` は廃止。根拠のひとつ「既存呼び出し元の無改修」を撤回 |

**決定そのもの（拒否を prop / 例外 / 戻り値のどれで表すか）は初版から変わっていない**ため supersede せず、本文を書き換えて現在の契約だけが読める状態を保つ。#635 の改訂で撤回した根拠は「既存呼び出し元の無改修」——`void` を返す既存ハンドラが自動的に成功扱いになる性質を当初は利点として挙げていたが、それこそが #634 で「早期 return したつもりがモーダルは確定成功と解釈して閉じる」バグを生んだ。呼び出し元10箇所の1行改修より型安全を優先する。
