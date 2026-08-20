# ADR-0016: 選択モーダルの除外フィルタリングをクライアント側で行う

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-13 |
| 最終更新日 | 2026-04-13 |

## コンテキスト

汎用選択モーダル（`SelectionModal`）で、自分自身や既に追加済みの商品を検索結果から除外する必要がある。除外対象のIDリストは親コンポーネントのクライアント状態（React state）に依存する。一方、非アクティブ商品の除外はビジネスルールとしてサーバー側で行う。

## 検討した選択肢

### A. Server Action 側で除外する（不採用）

```tsx
// Server Action
async function searchProductsForSelection(
  criteria: Record<string, string>,
  excludeIds: string[]  // クライアントから除外IDリストを渡す
) {
  return query.execute({
    ...criteria,
    excludeIds,  // DB クエリの NOT IN 条件
  });
}
```

### B. クライアント側で検索結果から除外する（採用）

```tsx
// SelectionModal 内部
const results = await searchAction(criteria);
const excludeSet = new Set(excludeIds);
const filtered = results.filter(row => !excludeSet.has(getRowId(row)));
setData(filtered);
```

## 決定

`excludeIds` によるフィルタリングはクライアント側で行う（選択肢 B）。非アクティブ商品の除外は Server Action 側で `isActive: true` を強制する。

## 根拠

- **除外リストの性質**: `excludeIds` は「自分自身のID」+「動的に追加された商品のID」で構成され、後者はReact stateに依存する未保存の状態を含む。この状態をServer Actionに渡すのは可能だが、Server Actionのインターフェースが汎用的でなくなる
- **汎用性の維持**: `searchAction` のシグネチャを `(criteria: Record<string, string>) => Promise<TData[]>` に統一することで、除外ロジックを知らない既存のServer Actionをそのまま再利用できる
- **責務の分離**: 「何を検索するか」はサーバー、「何を除外するか」はクライアント（UIの文脈依存）という分離が明確
- **非アクティブ商品はサーバー側**: `isActive: false` の商品は業務ルールとして選択不可であり、これはクライアント状態に依存しないためServer Action内で強制する

### 不採用理由

- **選択肢 A**: `searchAction` に `excludeIds` パラメータを追加すると、Server Actionのインターフェースがモーダル固有のものになり、`SelectionModal` が汎用コンポーネントとして機能しにくくなる。また、除外リストが数十件程度であればクライアント側フィルタリングのコストは無視できる

## 影響

- 除外対象が非常に多い場合（数百件以上）、検索結果の件数と除外後の件数に大きな差が生じ、ページネーションの表示件数がずれる可能性がある。現時点では周辺商品の追加済み件数は少数（〜数十件）のため問題にならない
- `searchAction` のインターフェースがシンプルに保たれるため、他の選択モーダル（従業員選択、部署選択など）でも既存のServer Actionを流用しやすい
- 対象ファイル: `src/app/_components/shared/SelectionModal.tsx`, `src/app/(features)/products/_shared/actions.ts`
