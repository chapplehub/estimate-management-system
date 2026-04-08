# Implementation Deviations: issue-204 商品マスタバックエンド実装

## 逸脱1: ProductReplacementDomainService のメソッドシグネチャ変更

**計画:** `validate(replacement, referencingProducts)` — 引数2つ
**実際:** `validateReplacement(targetId, replacement, referencingProducts)` — 引数3つ
**理由:** 入れ替え先が対象商品自身でないことを検証する必要があり、`targetId` パラメータを追加した。メソッド名も `validate` → `validateReplacement` に変更し、責務を明確化した。

## 逸脱2: テストケースの増減

### 増加（計画に記載のないテストを追加）

| ステップ | ファイル | 追加テスト | 理由 |
|----------|----------|------------|------|
| Step 7 | UpdateProductCommand.test.ts | +2件（nullクリア、自身除外確認） | description/noteのnull更新パス、excludeIdによる自己除外の正常系を検証するため |
| Step 8 | DeactivateProductWithReplacementCommand.test.ts | +2件（存在しない商品、存在しないコード） | 入れ替え対象・入れ替え先の存在チェックエラーパスを網羅するため |
| Step 9 | SetProductRelationsCommand.test.ts | +1件（空配列クリア） | 周辺商品の全解除が正しく動作することを検証するため |

### 減少（計画に記載のテストを省略）

| ステップ | ファイル | 省略テスト | 理由 |
|----------|----------|------------|------|
| Step 7 | DeleteProductCommand.test.ts | -1件（B008: 見積使用中エラー） | Estimateモデルが未実装のためスタブが常にfalseを返す。`it.todo` で記録済み |
