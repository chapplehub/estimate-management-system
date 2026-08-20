# ADR-0017: E2Eテストのテーブルセル特定にヘッダー名ベースを使用する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-14 |
| 最終更新日 | 2026-04-14 |

## コンテキスト

E2Eテストでテーブルの特定カラムの値を検証する際（例: フィルタ適用後に全行のステータスバッジが「有効」であることを確認）、セルの特定方法が統一されていなかった。

- `products-list.e2e.ts`: `td:nth-child(N)` でカラム位置をハードコード
- `employees-list.e2e.ts`: ヘッダー名からカラム位置を動的に特定

テスト基盤としてどちらを標準パターンとするか判断が必要になった。

## 検討した選択肢

### A. `td:nth-child(N)` による固定位置指定（不採用）

```ts
const statusCells = page.locator("table tbody tr td:nth-child(10) span");
```

シンプルで読みやすいが、列の追加・並び替えなど対象カラムと無関係な変更でテストが壊れる（偽陽性）。

### B. ヘッダー名からカラム位置を動的に特定（採用）

```ts
const headers = await page.locator("table thead th").allTextContents();
const colIndex = headers.indexOf("状態") + 1;
const statusCells = page.locator(`table tbody tr td:nth-child(${colIndex}) span`);
```

ヘッダー名の変更（UIの変更）でのみテストが壊れる。列の追加・並び替えには耐性がある。

### C. `data-column` 属性をプロダクションコードに付与（不採用）

```tsx
// DataTable の td に属性を付与
<td data-column="isActive">...</td>
```

```ts
page.locator('table tbody tr td[data-column="isActive"]')
```

列の追加・並び替え・ヘッダー名変更のすべてに耐性があるが、テストのためだけにプロダクションコードに属性を追加することになる。

## 決定

ヘッダー名からカラム位置を動的に特定する方式（B）を標準パターンとする。

## 根拠

- **偽陽性の排除**: nth-child は対象カラムと無関係な列の追加で壊れる。ヘッダー名ベースなら、そのカラムに関係する変更（ヘッダー名変更）でのみ壊れるため、テスト失敗が常にUIの実際の変更を示す。
- **プロダクションコードへの非侵入**: data-column 方式はテスト都合でプロダクションコードを変更するため不採用。テスト基盤の都合がプロダクションコードに漏れるべきではない。
- **既存パターンとの統一**: employees-list.e2e.ts で既に採用済みのパターンを標準化する。

## 影響

- 今後のE2Eテストで特定カラムの全行検証を行う場合は、ヘッダー名ベースのパターンを使用する
- 既存の `products-list.e2e.ts` の `nth-child` は次回改修時にヘッダー名ベースに移行する
- ヘッダー名が変更された場合はテストも更新が必要（意図された動作）
