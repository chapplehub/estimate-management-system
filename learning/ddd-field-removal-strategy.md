# DDD アーキテクチャにおけるフィールド削除の順序戦略

作成日: 2026-03-18

## 概要

DDD レイヤードアーキテクチャでフィールドを全レイヤーから削除する際、**どの順序で削除するか**によってコンパイル安全性・コミット粒度・履歴の読みやすさが変わる。`Department.displayOrder` 削除（約40ファイル影響）の設計議論を通じて、3つの戦略を比較検討した。

## 背景：DDD の依存方向

```
Presentation → Application → Domain ← Infrastructure
                                ↑
                          (中心・参照先)
```

Domain 層は**参照される側**（callee）であり、Application・Infrastructure は**参照する側**（caller）である。

具体例（`displayOrder` の場合）:

```
CreateDepartmentCommand  →  Department.create(..., displayOrder)   // Application → Domain
UpdateDepartmentCommand  →  department.changeDisplayOrder(...)     // Application → Domain
DepartmentMapper         →  Department.reconstruct(..., displayOrder) // Infrastructure → Domain
DepartmentMapper         →  department.displayOrder（getter）        // Infrastructure → Domain
PrismaDepartmentQueryService → displayOrder を select/toDTO        // Infrastructure 内部
DepartmentCreateForm     →  Server Action → Command               // Presentation → Application
```

## 戦略1: Inside-out（Domain から外側へ）

### 順序

```
Domain → Application → Infrastructure → Presentation → DB
```

### 考え方

DDD の「中心はドメイン」という思想に沿い、まず Domain 層で「displayOrder は存在しない」という新しい真実を定義し、外側に波及させる。

### 問題点

Domain 層は**参照される側**なので、先に削除すると参照元でエラーが発生する：

```typescript
// Step 1 で Department.create() から displayOrder 引数を削除した直後:

// CreateDepartmentCommand.ts — まだ修正していない
Department.create(departmentCd, name, abbreviation, parentId, input.displayOrder ?? 0)
//                                                            ^^^^^^^^^^^^^^^^^^^^^^^^
// Error: Expected 4 arguments, but got 5.

// DepartmentMapper.ts — まだ修正していない
department.displayOrder
//         ^^^^^^^^^^^^
// Error: Property 'displayOrder' does not exist on type 'Department'.
```

### 評価

| 項目 | 評価 |
|------|------|
| コミット粒度 | 1レイヤー = 1コミットで整理が美しい |
| コンパイル安全性 | 中間コミットで `tsc` エラー |
| pre-commit hook 互換性 | `tsc --noEmit` がある場合コミット不可 |
| コミット履歴の読みやすさ | レイヤーごとに追いやすい |

## 戦略2: Outside-in（Presentation から内側へ）

### 順序

```
Presentation → Application → Infrastructure → Domain → DB
```

### 考え方

参照元（caller）から先に削除すれば、参照先（callee）はまだ存在するのでエラーにならない。

### 問題点

一見良さそうだが、**隣接レイヤー間の型制約**で崩れるケースがある：

```typescript
// Step 2 で DepartmentDTO から displayOrder を削除した直後:

// PrismaDepartmentQueryService.ts — まだ修正していない
return {
  id: department.id,
  displayOrder: department.displayOrder,  // ← DTOに存在しないフィールドを返している
  //            ^^^^^^^^^^^^^^^^^^^^^^^^
  // Error: Object literal may only specify known properties
};
```

DTO は Application 層、QueryService は Infrastructure 層。Outside-in の順番だと Application を先に直すが、Infrastructure がまだ古い DTO 型にマッピングしようとしてエラーになる。

### 評価

| 項目 | 評価 |
|------|------|
| コミット粒度 | 1レイヤー = 1コミットだが、一部中間エラー |
| コンパイル安全性 | Inside-out よりマシだが完全ではない |
| pre-commit hook 互換性 | 一部ステップでブロックされる可能性 |

## 戦略3: 依存チェーン単位（推奨）

### 順序

**型の依存関係で繋がっているもの同士を1つのコミットにまとめる。**

```
Step 1: Domain Entity + 直接の caller（Commands, Mapper）
        → create()/reconstruct() のシグネチャ変更と、それを呼ぶコードを同時修正
        → ✅ コンパイル通る

Step 2: DTO + QueryService（DTO型定義とそのマッピング元を同時に修正）
        → ✅ コンパイル通る

Step 3: Presentation 層（UI フォーム、Actions、カラム定義）
        → ✅ コンパイル通る

Step 4: Prisma スキーマ + マイグレーション + Seed
        → ✅ コンパイル通る

Step 5: 他サブドメインのテスト fixture
        → ✅ コンパイル通る
```

### なぜこれが機能するか

「型のつながり」を断面にしているため、各コミットの時点で：
- 削除されたシグネチャを呼ぶコードは同時に修正済み
- 変更された型を使うコードは同時に修正済み

### 評価

| 項目 | 評価 |
|------|------|
| コミット粒度 | 1コミットが複数レイヤーにまたがる |
| コンパイル安全性 | 各コミットで `tsc` が通る |
| pre-commit hook 互換性 | `tsc --noEmit` / `pnpm test` ともに通る |
| コミット履歴の読みやすさ | レイヤー単位ではないが、変更の因果関係は追いやすい |

## 3戦略の比較まとめ

| 戦略 | コンパイル安全性 | コミット粒度 | 履歴の読みやすさ | pre-commit 互換 |
|------|:---:|:---:|:---:|:---:|
| Inside-out | NG | レイヤー単位で美しい | レイヤーで追える | NG |
| Outside-in | 一部 NG | レイヤー単位 | レイヤーで追える | 一部 NG |
| 依存チェーン単位 | OK | 複数レイヤー混在 | 因果関係で追える | OK |
| 全部1コミット | OK | 差分が巨大 | 追いにくい | OK |

## 学び

1. **DDD のレイヤー境界とコンパイル安全なコミット境界は一致しない。** DDD の依存方向（外→内）があるため、どの方向から削除しても隣接レイヤーとの型不整合が発生する。

2. **「型の依存チェーン」がコミットの自然な単位。** レイヤーではなく「シグネチャ変更 + その caller」をセットにすることで、各コミットの型安全性を保てる。

3. **pre-commit hook の制約が設計を決める。** `tsc --noEmit` がなければ Inside-out でも実用上問題ないが、CI/pre-commit に型チェックがある場合は依存チェーン単位が必須になる。

4. **理論上美しい順序と実務上安全な順序は異なることがある。** Inside-out は DDD の思想に忠実だが、実務では「各コミットがグリーンであること」の方が重要。

## 参考

- 関連 Issue: #120（Department.displayOrder 削除）
- 影響ファイル数: 約40ファイル
- プロジェクトの pre-commit hook: `pnpm lint-staged` / `pnpm tsc --noEmit` / `pnpm test`
