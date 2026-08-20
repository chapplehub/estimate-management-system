# Issue #262 実装の逸脱記録

## 1. スコープ外ファイル `delivery-locations-list.e2e.ts` の修正

### 元の計画 / Issue 文言

> ## 対象
> - `src/app/(features)/delivery-locations/delivery-locations-crud.e2e.ts`

Issue #262 の対象は crud e2e の 1 ファイルのみ。`delivery-locations-list.e2e.ts`
は対象外。

### 実際の実装

ユーザー追加要望により `delivery-locations-list.e2e.ts` の 1 テストの件数
アサーションを堅牢化:

- `状態「有効」で検索できる`: `expect(count).toBe(6)` →
  `expect(count).toBeGreaterThan(0)`

「全表示行が絞り込み条件に一致する」不変条件のループ検証は維持。他の
`toHaveCount`（名前=山田 / 得意先=山田 / 状態=無効 / 複合）は変更しない。

### 逸脱の理由

Issue #261（PR #270 で merge 済み）が skill §13 に従い独自シード `C901` と
配下 `D901` を共通シードプールへ追加した。`D901` は **active な納品先**のため、
共通シードの有効納品先数が 6 → 7 に増加し、`delivery-locations-list.e2e.ts`
の **シード件数に結合した exact-count アサーション** `expect(count).toBe(6)`
が必然的に破綻した（実際は 7 件）。検索ロジック自体は正常で、破綻したのは
脆い件数アサーションのみ。

ユーザーが当該アサーションを名指しで指摘し（「`expect(count).toBe(6)` という
テストが脆弱」）、PR #270 に倣った修正を明示的に要望した。検索テストが本来
検証すべき不変条件は「絞り込み結果の全行が条件に一致する」ことであり、総件数
はシード基数への偶発的結合にすぎない。直接の前例である products リファクタ
（commit `a415cb0`）/ customers リファクタ（commit `09d09bc` / PR #270）で
`products-list.e2e.ts` / `customers-list.e2e.ts` は既に `toBeGreaterThan(0)`
+ 全行一致パターンへ移行済み。本変更はその確立済みパターンへ
`delivery-locations-list.e2e.ts` を追従させるもので、skill の方向性と一致する。

修正スコープは #261 で実際に破綻した 1 箇所のみに限定した。理由: PR #270 も
`customers-list` で破綻した箇所のみ修正し健全な count アサーションには手を
付けていない前例に従い、最小・原則的スコープを維持するため。他の
`toHaveCount` は `D901`（C901 配下・名前非該当・active）の影響を受けず green。

## 2. §13 独自シードを追加しなかった点（参考・逸脱ではない）

customers（#261）は「納品先がある得意先は削除できない」ドメインエラー
テストのため `C901`/`D901` を追加したが、`delivery-locations-crud.e2e.ts`
にはドメインエラーテストが存在しない（`重複する取引先コード` は §3 簡易
エラー・共通シード `D001`・DB 不変）。よって §13 に基づく `seed-e2e.ts` への
独自シード追加は不要と判断し、`seed-e2e.ts` は無変更（Issue #250 既存構造
不変原則とも整合）。これは計画どおりの判断であり逸脱ではないが、customers
との対比で誤解を招きやすいため記録する。
