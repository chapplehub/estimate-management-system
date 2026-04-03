# Server Component slot パターンと動的フィルタリングの使い分け

作成日: 2026-04-03

## 概要

Next.js App Router で Server Component と Client Component を組み合わせる際、select フィールドの選択肢をどう供給するかには2つのアプローチがある。選択肢が固定か、他の入力に連動して変わるかで使い分ける。

## 詳細

### 1. Server Component slot パターン（選択肢が固定の場合）

Server Component で DB からデータを取得し、ReactNode として Client Component の props に渡す。

```tsx
// Server Component (page.tsx)
<DepartmentCreateForm
  parentDepartmentSelectSlot={
    <DepartmentSelectField name="parentId" />  // Server Component
  }
/>

// DepartmentSelectField (Server Component)
export async function DepartmentSelectField(props) {
  const departments = await queryService.findActive();  // DB アクセス
  return <SelectField options={...} />;  // Client Component を返す
}

// Client Component (DepartmentCreateForm.tsx)
type Props = { parentDepartmentSelectSlot: React.ReactNode };
// JSX 内で {parentDepartmentSelectSlot} と描画するだけ
```

**利点**: Client Component は DB アクセスの詳細を知らない。バンドルサイズに影響しない。
**制約**: slot の中身はサーバーレンダリング時に1回だけ確定する。クライアント側から差し替えられない。

### 2. データ props + クライアントサイドフィルタリング（選択肢が連動する場合）

Server Component で全データを取得し、プレーンなオブジェクト配列として Client Component に渡す。Client Component 内で `useState` + `useMemo` を使い、ユーザー操作に応じて選択肢をフィルタする。

```tsx
// Server Component (page.tsx)
const positions = await getAllPositionsQueryFactory().execute();
const allRoles = await getAllRolesQueryFactory().execute({});
<RoleCreateForm
  positions={positions.map(p => ({ id: p.id, name: p.name, superiorPositionId: p.superiorPositionId }))}
  allRoles={allRoles.map(r => ({ id: r.id, name: r.name, positionId: r.positionId }))}
/>

// Client Component (RoleCreateForm.tsx)
const [selectedPositionId, setSelectedPositionId] = useState("");

const superiorPositionId = useMemo(
  () => positions.find(p => p.id === selectedPositionId)?.superiorPositionId ?? null,
  [positions, selectedPositionId]
);

const superiorRoleOptions = useMemo(
  () => superiorPositionId ? allRoles.filter(r => r.positionId === superiorPositionId) : [],
  [allRoles, superiorPositionId]
);
```

**利点**: ユーザー操作にリアルタイムで反応できる。
**注意**: DTO の Date オブジェクトはシリアライズできないため、必要なフィールドだけ抽出した軽量オブジェクトに変換して渡す。

### 3. 非制御コンポーネントのリセットに useRef を使う

連動する select で、親の値が変わったとき子の選択値をクリアする必要がある。Conform は FormData からバリデーションするため、select は非制御コンポーネント（`defaultValue`）で動作させるのが自然。非制御コンポーネントの値をプログラムからリセットするには `useRef` で DOM を直接操作する。

```tsx
const superiorRoleSelectRef = useRef<HTMLSelectElement>(null);

const handlePositionChange = (e) => {
  setSelectedPositionId(e.target.value);
  if (superiorRoleSelectRef.current) {
    superiorRoleSelectRef.current.value = "";  // DOM 直接リセット
  }
};
```

`useState` で制御コンポーネントにすると、Conform の FormData ベースのバリデーションと二重管理になり複雑になる。

### 使い分けの判断基準

| 条件 | パターン |
|------|---------|
| 選択肢が固定（ページ表示時に確定） | Server Component slot |
| 他の入力に連動して選択肢が変わる | データ props + クライアントフィルタ |

## 参考

- slot パターンの実例: `src/app/_components/form/DepartmentSelectField.tsx`
- 動的フィルタリングの実例: `src/app/(features)/roles/new/RoleCreateForm.tsx`
- slot を使う側: `src/app/(features)/departments/new/page.tsx`
- データ props を使う側: `src/app/(features)/roles/new/page.tsx`
