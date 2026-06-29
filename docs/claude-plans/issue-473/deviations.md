# 実装計画からの逸脱記録（#473）

## 逸脱1: Step 5（FE 詳細読み）・Step 6（FE actions 書き）・Step 7（モック撤去）を1コミットに統合

- **元の計画**: Step 5（詳細ページ＋パネルを実BE直結）／Step 6（actions を実コマンド直結）／
  Step 7（mock-store・types・queries 削除、period-rules を authorityFor に縮約）を別コミットにする。
- **実際の実装**: 詳細画面まわりの読み・書き・撤去を1コミットにまとめた。
- **逸脱の理由**: `PeriodForm`/`PeriodDeleteConfirm` は Server Action を `.bind()` して `useServerForm` に
  渡す。宛先キーを `productCd` 1個から `productId`＋`productCode` の2個へ増やす変更は、
  - フォーム側の `.bind(null, productId, productCode)` と
  - action 側のシグネチャ `(productId, productCode, prevState, formData)`
  を同時に変えないと bind の引数とアクションの先頭引数の型がズレてコンパイルが通らない（中間状態が
  作れない）。したがって Step 5 と Step 6 は原子的に結合している。
  さらに `authorityFor` の引数型を FE 独自の `PeriodState`（current/future/lapsed）から BE status
  （active/future/expired）へ変えると、旧 `PeriodState` で `authorityFor` を呼ぶ `mock-store.ts` と
  `period-rules.test.ts` が即座に型エラーになる。これらは Step 7 で削除/縮約する対象であり、変換層を
  挟まず（#473 方針）コンパイルを通すには Step 7 の撤去を同コミットで行うのが最も素直だった。
  各コミットが必ずビルド・型チェックを通る状態を保つことを優先した。
