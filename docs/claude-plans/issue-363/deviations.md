# Issue #363 実装逸脱記録

## モーダルをボディ部品内ではなく別エクスポート（form 外）に分離

### 元の計画内容
`/grill-me` の合意（fields 型付けの選択肢 A）では、共有ボディ部品 `VariationLineEditor` が
共通領域を**まるごと**描画する想定で、SelectionModal・ProductSuggestDialog（モーダル2つ）も
ボディ部品に含める前提だった。

### 実際の実装内容
ボディ部品ファイルを2エクスポートに分割した。
- `VariationLineEditor`: `<form>` 内に置く内側共通領域（明細テーブル・全体値引・メモ・プレビュー・hidden）
- `VariationLineEditorOverlays`: モーダル2つ。ラッパが `</form>` の**外**で描画する

### 逸脱の理由
`SelectionModal` は内部で `ModalSearchForm` を描画し、`ModalSearchForm` は `<form onSubmit>` と
`type="submit"` ボタンを持つ。モーダルをラッパの `<form>` 内に置くと**ネスト form（不正 HTML）**
になり、外側フォームの送信挙動を壊すリスクがある。元実装はこれを避けてモーダルを `</form>` の外に
配置していた。完了条件「既存挙動が変わらない」を厳守するため、この DOM 構造（モーダルは form 外）を
踏襲し、ボディ部品を form 内（フィールド）と form 外（モーダル）の2エクスポートに分けた。重複は
生じていない。

### 検証
E2E 16件全緑（商品選択モーダル→明細追加、セット群自動展開、周辺商品サジェストを含む）。
`pnpm lint` / `pnpm test`（1193件）/ `npx tsc --noEmit` も緑。
