# Issue #618 ラウンド1 レビュー指摘の修正計画

`/auto-review-fix` ラウンド1（`/code-review medium` → judge 評価）で採用された指摘の修正方針。
ID は PR #621 の生レビュー・judge 評価コメントと対応する。

## R1-1: 無効行の赤ハイライトが hover で消える

- **バケツ**: ① correctness
- **severity（参考）**: Medium
- **file:line**: `src/app/_components/shared/DataTable.tsx:148`

### 問題

`<tr>` が `border-b hover:bg-gray-50` を常に出力し、`getRowAttributes` が返す `bg-red-50` を
**末尾に追記**している。Tailwind v4 の `hover:` は `&:hover`（`:where()` ラップ無し）に展開されるため
詳細度は 0-2-0 となり、素の `.bg-red-50`（0-1-0）に勝つ。クラス文字列の並び順は無関係で、CSS の
詳細度で決まる。

結果、**hover 中は赤が gray-50 に上書きされる**。ユーザーが「原因商品のチェックを外す」ために
当該行へマウスを乗せた瞬間＝ハイライトが最も必要な場面で赤が消える。

これは ADR-20260716-r4d が決定した「原因の行を可視化し、ユーザーがチェックを外すだけで再確定できる」
という目的そのものの未達であり、計画準拠ではない（計画はハイライトすると言っている）。

テストは `data-invalid` を継ぎ目にする方針（ADR 準拠・配色を assert しないのは妥当）のため、
単体・E2E とも緑のまま素通りする。

### 修正方針

`DataTable` の `<tr>` で、**利用側が `className` を返したときは既定の `hover:bg-gray-50` を出力しない**
（置換する）。既定の hover は「利用側が行の配色を指定していないとき」のフォールバックと位置づける。

```tsx
const attributes = getRowAttributes?.(row.original);
// 利用側が配色を指定したら既定の hover 配色は出さない（hover の詳細度が勝ち、指定色を打ち消すため）。
const rowClassName = attributes?.className
  ? `border-b ${attributes.className}`
  : "border-b hover:bg-gray-50";
```

同リポジトリの `LineEditTable.tsx:301`（`isActive ? "bg-blue-50" : "hover:bg-gray-50"`）と
`LineEditTable.tsx:217`（`isActive ? "bg-blue-50" : "bg-amber-50 hover:bg-amber-100"`）が
既に「配色を指定するときは hover 側を置換する」作法を採っており、それに揃える。

`SelectionModal` 側は現状 `{ className: "bg-red-50", "data-invalid": true }` を返しており、
この変更で無効行は hover でも赤を保つ。有効行は `{}` を返すため既定の `hover:bg-gray-50` が
そのまま効き、既存の全呼び出し元（`getRowAttributes` 未指定）も従来どおり。

### 影響範囲

- `src/app/_components/shared/DataTable.tsx` のみ（局所）。
- `getRowAttributes` を渡していない既存 6 呼び出し元は `attributes` が `undefined` になり
  `border-b hover:bg-gray-50` のまま＝**挙動不変**。
- `getRowAttributes` を渡すのは現状 `SelectionModal` だけで、そこでは意図どおり赤が保たれる方向の変化。
- 公開シグネチャ（`getRowAttributes` の型）は変えない。

### 想定テスト

配色クラスを assert しない方針（ADR-20260716-r4d）は維持する。つまり「hover で赤が残ること」を
テストで固定はしない — jsdom は CSS 詳細度を解決せず、E2E で色を assert すると見た目の変更で割れる。

代わりに **`SelectionModal.test.tsx` に「無効行には既定の hover 配色クラスが出力されない」という
構造的な assert を1つ足す**にとどめる（`hover:bg-gray-50` を含まないこと）。これはクラス名への依存だが、
「既定 hover を置換した」という今回の修正意図そのものを固定する最小の継ぎ目であり、赤の色味を
変えても割れない（`bg-red-50` 側は assert しない）。

既存の単体テスト・E2E が緑のままであることも確認する（挙動不変の担保）。
