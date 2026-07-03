# Issue #506 自動レビュー＆修正 ラウンド1 修正計画

`/code-review medium` → judge 評価の結果、採用①②（correctness/方針違反）は 0 件（収束）。
採用③（cleanup）1 件のみを本ラウンドで処理する。

## 対象（採用③ cleanup）

### #1 factory 命名の規約統一
- バケツ: ③ cleanup（simplification）／ severity 参考: low
- file:line: `src/server/subdomains/pricing/application/factories/pricingQueryFactory.ts:50, 55`
- 問題: 新規追加の `customerSellingPriceListQueryServiceFactory` / `customerSellingPriceEditQueryServiceFactory` だけ `...QueryServiceFactory` サフィックスで、既存12関数の `...QueryFactory` 命名規約（`commonSellingPriceListQueryFactory`, `costPriceEditQueryFactory` 等、"Service" を含まない）から外れている。
- 修正方針: `customerSellingPriceListQueryFactory` / `customerSellingPriceEditQueryFactory` にリネームして既存規約に揃える。
- 影響範囲: 外部呼び出し元ゼロ（FE は別 Issue で未消費）。定義箇所のみ。JSDoc・戻り値型は変更なし。
- 想定テスト: 既存 `pnpm test` が緑のまま（挙動不変の単純リネーム）。`pnpm lint` で未使用警告が出ないこと。
- 採用根拠: 挙動不変（識別子リネームのみ）／設計判断不要（既存規約に合わせるだけで迷う余地なし）／局所的（呼び出し元ゼロでファイル1枚に閉じる）。③の3ゲート充足。

## 対象外（④残課題・報告のみ）
- reuse: List の WHERE 生成ブロック3ファイル重複（共有モジュール新設＝抽象化判断）
- reuse: Edit の時点状態 CASE 式3ファイル重複（同上）
- efficiency: Edit の customer/product 逐次 await（並列化のトレードオフ判断）
- altitude: 一覧 SQL 骨格の複製（計画が同型ミラーを意図採用・納品先別3層目待ち）
- convention: factory の infra 具象 new（合成ルートの正当パターン・誤検知）
