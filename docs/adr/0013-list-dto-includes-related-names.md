# ADR-0013: 一覧画面の DTO にリレーション先の名前を含める

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-04-10 |
| 最終更新日 | 2026-04-10 |

## コンテキスト

従業員一覧画面（`/employees`）に部署名カラムを追加する際、リレーション先（部署）の名前をどこで解決するかを決める必要がある。

現在のシステムには2つのパターンが混在している:

1. **RoleDTO パターン**: `positionName`, `superiorRoleName` を DTO に含め、`PrismaRoleQueryService` が JOIN して名前を解決する
2. **departments/page.tsx パターン**: `DepartmentDTO` は `parentId` のみ持ち、ページの Server Component で全部署を取得して Map で名前変換する

一覧テーブルに表示するデータの名前解決方針を統一する必要がある。

## 検討した選択肢

### A. DTO にリレーション先の名前を含める（採用）

QueryService が Prisma の `select` でリレーション先の名前を取得し、`toDTO()` で名前フィールドにマッピングする。

```typescript
// EmployeeDTO
export type EmployeeDTO = {
  // ...
  departmentId: string;
  departmentName: string;  // QueryService が JOIN して解決
};
```

### B. ページの Server Component で全件取得して Map 変換する（不採用）

```typescript
// page.tsx
const allDepartments = await getAllDepartmentsQuery.execute({});
const nameMap = new Map(allDepartments.map(d => [d.id, d.name]));
const rows = employees.map(e => ({
  ...e,
  departmentName: nameMap.get(e.departmentId) ?? "-",
}));
```

### C. マスタデータをログイン時にグローバルキャッシュする（不採用）

ログイン時に全マスタデータを取得し、Context/Store で保持。各ページで参照する。

## 決定

一覧画面の DTO にリレーション先の名前を含める（選択肢 A）。

## 根拠

### CQRS の Read Model として自然

QueryService の責務は「表示に最適化されたデータを返す」ことである。一覧テーブルが部署名を必要とするなら、DTO がそれを提供するのが CQRS の原則に合致する。データの加工・結合はインフラストラクチャ層の QueryService で行い、ページ（プレゼンテーション層）は受け取ったデータをそのまま表示すべきである。

### 既存の成功パターンとの一貫性

RoleDTO が既に `positionName`, `superiorRoleName` をこの方式で解決しており、roles/page.tsx にはデータ加工ロジックがない。この実績あるパターンに統一する。

### 不採用理由

- **選択肢 B**: ページの Server Component にデータ結合ロジックが入り、プレゼンテーション層の責務を超える。マスタデータの別途取得で2クエリになり、N+1 ではないが非効率。departments/page.tsx は自己参照（親部署）という特殊ケースのワークアラウンドとして許容する
- **選択肢 C**: Next.js App Router の RSC アーキテクチャでは Server Component が毎回サーバーで実行されるため、クライアント側キャッシュの恩恵を受けにくい。キャッシュ無効化の問題も発生し、導入コストに対して得られる効果が限定的

## 影響

- 今後、一覧画面で新たにリレーション先の名前を表示する場合は、DTO に名前フィールドを追加し QueryService で解決するパターンに従う
- departments/page.tsx の `parentDepartmentName` 解決方式は既存実装として許容するが、新規実装では本 ADR のパターンに従う
- DTO のフィールドが増えることで QueryService の `getSelectFields()` と `toDTO()` の変更が必要になるが、変更箇所が QueryService に局所化されるため保守性は高い
