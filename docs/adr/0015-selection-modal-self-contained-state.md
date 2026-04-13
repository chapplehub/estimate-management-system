# ADR-0015: SelectionModalが内部でデータ・選択状態を一括管理する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-13 |
| 最終更新日 | 2026-04-13 |

## コンテキスト

汎用選択モーダル（`SelectionModal`）のデータフェッチ・ローディング・行選択の状態をどのレイヤーで管理するかを決める必要がある。このモーダルは商品選択だけでなく、従業員・部署など複数の一覧で再利用することを想定している。

## 検討した選択肢

### A. 親コンポーネントが管理し、モーダルは表示のみ（不採用）

```tsx
// 親コンポーネント
const [data, setData] = useState([]);
const [isLoading, setIsLoading] = useState(false);
const [rowSelection, setRowSelection] = useState({});

const handleSearch = async (criteria) => {
  setIsLoading(true);
  const results = await searchAction(criteria);
  setData(results.filter(r => !excludeIds.includes(r.id)));
  setIsLoading(false);
};

<SelectionModal
  data={data}
  isLoading={isLoading}
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  onSearch={handleSearch}
  ...
/>
```

### B. SelectionModal が内部で一括管理する（採用）

```tsx
// 親コンポーネント
<SelectionModal
  searchAction={searchProductsForSelection}
  excludeIds={excludeIds}
  onConfirm={(selected) => setRelations(prev => [...prev, ...selected])}
  ...
/>
```

## 決定

SelectionModal が `data`, `isLoading`, `rowSelection`, `hasSearched` の状態を内部で一括管理し、`searchAction` を prop として受け取る（選択肢 B）。

## 根拠

- **利用側のコード最小化**: 親コンポーネントは `searchAction`, `excludeIds`, `onConfirm` を渡すだけでよく、モーダルの内部状態を意識する必要がない。複数画面で再利用する際のボイラープレートが大幅に減る
- **状態の一貫性**: データフェッチ・フィルタリング・選択状態・ローディングは密結合しており（例: 新しい検索実行時に選択をリセットする）、これらを一箇所で管理する方がバグを防ぎやすい
- **カプセル化**: モーダルのopen/close時のクリーンアップ（data, selection, hasSearchedのリセット）もモーダル内部で完結する

### 不採用理由

- **選択肢 A**: 利用側ごとに同じ状態管理パターン（fetch → filter → setData, search時のselectionリセット, close時のクリーンアップ）を書く必要があり、DRY原則に反する

## 影響

- `SelectionModal` は `searchAction: (criteria) => Promise<TData[]>` を受け取るインターフェースとなるため、Server Action をそのまま渡せる
- モーダルの表示ロジックをカスタマイズしたい場合（例: 検索結果のグルーピング）は、`SelectionModal` の拡張か別コンポーネントの作成が必要になる
- 対象ファイル: `src/app/_components/shared/SelectionModal.tsx`
