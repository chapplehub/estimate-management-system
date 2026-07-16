# ADR-20260716-r4d: SelectionModal の確定拒否は onConfirm の戻り値で表現する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-16 |
| 最終更新日 | 2026-07-16 |

## コンテキスト

`SelectionModal` は確定時に `onConfirm(selectedItems)` を呼んだ直後、無条件で自身を閉じる。つまり「親が確定を拒否する」余地が契約上ゼロだった。

見積の明細追加（#618）で複数商品の一括選択に対応するにあたり、「選択した商品のうち1件でも有効な販売単価を解決できなければ、1件も追加せず拒否する」（ADR-0064: 0円明細を作らない、の一括版）という原子的な拒否が必要になった。

このとき、モーダルを閉じてから親の画面上にエラーバナーを出すと、ユーザーは「どの商品が原因か」を確かめるためにモーダルを開き直し、検索し直し、選択し直すことになる。**モーダルに留まったままエラーを示し、原因の行を可視化できれば、ユーザーは該当商品のチェックを外すだけで再確定できる**。

そのためには「親が確定を拒否し、その理由と原因行をモーダルへ伝える」経路が要る。既存の `SelectionModal` は7箇所から利用されているため、その全てを壊さずに拒否経路を足す必要がある。

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
export type SelectionRejection = { message: string; invalidIds: string[] };

onConfirm: (selectedItems: TData[]) => void | Promise<void | SelectionRejection>;
```

- 戻り値なし（`undefined`）＝ 成功 → モーダルを閉じる（従来の挙動）
- `SelectionRejection` を返す ＝ モーダルを閉じず、`message` を表示し `invalidIds` の行をハイライトする

## 決定

`SelectionModal` の `onConfirm` が `SelectionRejection` を返したら閉じずにエラーと該当行ハイライトを表示し、`undefined` を返したら従来どおり閉じる（選択肢 C）。

## 根拠

- **既存呼び出し元の無改修**: `void` を返す既存ハンドラは自動的に成功扱いとなり、7箇所の呼び出し元を1行も変えずに済む。拒否したい呼び出し元だけが戻り値を返せばよい
- **ADR-0015 の維持**: エラー文言・ハイライトの表示状態はモーダル内部の state のままで、親は「判定結果を返すだけ」。選択肢 A は `errorMessage` / `invalidIds` の state を親に持たせるため、ADR-0015（モーダルがデータ・選択状態を自己完結管理する）が掲げたカプセル化と「利用側のコード最小化」を、拒否を使う画面から順に切り崩していく
- **失敗ではなく予測可能な正常結果**: 「単価未設定の商品が選択に混ざっていた」はバグでも異常でもなく、ユーザー操作の予測可能な結果であり、その場で回復可能（チェックを外して再確定）。ADR-0038 の「失敗は例外・予測可能な複数の正常結果は union」の線引きに照らすと、これは例外ではなく戻り値で表す側に属する。選択肢 B は制御フローに例外を使うことになり、この線引きに反する
- **型で経路を強制できる**: 戻り値型が `void | SelectionRejection` であることで、拒否したい親は「何を返せばモーダルが留まるか」を型から辿れる

### 不採用理由

- **選択肢 A**: ADR-0015 のカプセル化を壊す。親が open 状態とエラー状態を二重に管理することになり、「新しい検索を実行したらエラーを消す」等の整合をモーダル外で再実装する必要が出る
- **選択肢 B**: 回復可能なユーザー操作結果に例外を使うことになり ADR-0038 の線引きに反する。また `try/catch` を挟む都合上、親の他の実装バグ（想定外の例外）まで「選択拒否」として握り潰す危険がある

## 影響

- `SelectionModal` は `onConfirm` を `await` する必要があり、確定処理中は二重確定を防ぐ必要がある（確定ボタンの非活性）
- 行ハイライトのため `DataTable` に汎用の `getRowClassName?: (row: TData) => string` を足す。「無効」という意味は `DataTable` は知らず、`SelectionModal` に閉じる（テーブルは表示の汎用部品のまま保つ）
- 拒否状態（エラー文言・ハイライト）は、新しい検索の実行時・モーダルを閉じたとき・次の確定試行時にクリアする。ユーザーが原因行のチェックを外している間は保持し、どれが原因だったかを見失わせない
- 拒否時に選択状態（`rowSelection`）はリセットしない。ユーザーが該当商品のチェックだけを外して再確定できることが、この決定の目的そのものであるため
- 対象ファイル: `src/app/_components/shared/SelectionModal.tsx`, `src/app/_components/shared/DataTable.tsx`
