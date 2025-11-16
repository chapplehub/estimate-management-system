# Server Actionsのファイル配置：コロケーション vs 集約

## 概要

Server Actionsをどこに配置すべきか？という疑問から、Next.js公式の推奨とコミュニティのベストプラクティスを調査し、コロケーションパターンを採用することに決定した経緯をまとめる。

---

## 問題提起

現在の構成では、全てのServer Actionsを `app/employees/_lib/actions.ts` に集約している。

```
app/employees/
└─ _lib/
   └─ actions.ts  # ← createEmployee, updateEmployee, deleteEmployee 全てここ
```

**問題点:**
- actionが増えると肥大化する
- どのactionがどのページで使われているか分かりにくい
- フレームワークの標準的な考え方に沿っているか不明

---

## Next.js公式ドキュメントの調査結果

### 公式が示している方法

Next.js公式ドキュメント（最新版）: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations

**2つの定義方法:**

1. **別ファイルに定義**
   - ファイルの先頭に `'use server'` を記述
   - 例：`app/lib/actions.ts`
   - 複数のServer Actionsがある場合に推奨

2. **Server Component内にインライン定義**
   - 個別の関数内に `'use server'` を記述

**重要な制約:**
- Client Componentでは定義できない
- `'use server'` が先頭にあるファイルからimportする必要がある

### 公式の例

```typescript
// app/lib/actions.ts
'use server'

export async function createUser(data) {
  // ...
}
```

### 公式は「どう整理すべきか」を明示していない

公式ドキュメントは：
- ✅ 「別ファイルに定義すること」は推奨
- ✅ 例として `app/lib/actions.ts` を使用
- ❌ **複数のactionをどう整理すべきか**についての明確な推奨は**ない**

---

## コミュニティの調査結果

### 検索結果

「Next.js Server Actions file structure best practices 2024 2025」で調査：

**共通パターン:**
- `lib/actions.js` に Server Actions を配置
- `lib/` は utilities, database operations, auth などと一緒に配置

**GitHubディスカッション:**
- https://github.com/vercel/next.js/discussions/55908
- コミュニティでも「どう整理すべきか」は議論中
- Next.jsチームからの明示的な推奨はない

**結論:**
- 統一見解はない
- `lib/actions.ts` に集約するパターンが多い
- 機能ごとに分割するパターンも存在

---

## Vercel公式プロジェクトの実例

### Vercel Commerce（本番プロダクト）

**URL:** https://github.com/vercel/commerce/blob/main/components/cart/actions.ts

**構成:**
```
components/
└─ cart/
   ├─ index.tsx
   ├─ add-to-cart.tsx
   ├─ edit-item-quantity-button.tsx
   └─ actions.ts              # ← カート関連のactionをコロケーション
```

**ポイント:**
- ✅ **コロケーション**を採用（使う場所の近くに配置）
- ✅ 機能単位でactionを分離
- ✅ Vercel自身が本番環境で採用

### Next.js Examples

**URL:** https://github.com/vercel/next.js/blob/617ead5753f58ce1d948927512fe3ff39a12b5b6/examples/with-reflux/actions/actions.js

様々なパターンが存在するが、コロケーションを採用している例も多数存在。

---

## 議論の経緯

### 初期の誤解

Claudeは「コンポーネントツリーのどこにでも配置できる = コロケーション推奨」と解釈したが、これは**公式ドキュメントの拡大解釈**だった。

**訂正:**
- 公式ドキュメントは「どこにでも配置できる」とは言っているが、「コロケーションを推奨」とは明示していない
- 例として `app/lib/actions.ts` を使用している

### 実際の判断基準

公式の明確な推奨がない中で、以下を基準に判断：

**Vercel Commerceの実例:**
- Vercel自身が本番プロダクトでコロケーションを採用
- `components/cart/actions.ts` という配置

**DXの観点:**
- ✅ 関連ファイルが近くにある
- ✅ どのactionがどのページで使われているか明確
- ✅ ファイルを開いたときに関連するactionがすぐわかる

**スケーラビリティ:**
- ✅ actionが増えても分散される
- ✅ 1ファイルが肥大化しない

---

## 検討した3つのパターン

### パターン1: 現状維持（集約）

```
app/employees/
└─ _lib/
   └─ actions.ts  # ← 全てのactionをここに集約
```

**メリット:**
- シンプル
- 公式の例（`app/lib/actions.ts`）に近い

**デメリット:**
- actionが増えると肥大化する
- どのactionがどのページで使われているか分かりにくい

**評価:** ⭐⭐⭐

---

### パターン2: 機能ごとに分割（`_lib` 内）

```
app/employees/
└─ _lib/
   ├─ create-employee-action.ts
   ├─ update-employee-action.ts
   └─ delete-employee-action.ts
```

**メリット:**
- 責任が明確（1ファイル1責務）
- スケールしやすい
- `_lib/` でactionをグルーピング

**デメリット:**
- コロケーションの観点では弱い（使う場所から離れている）
- ファイル数が増える

**評価:** ⭐⭐⭐⭐

---

### パターン3: コロケーション（使う場所の近く）

```
app/employees/
├─ new/
│  ├─ page.tsx
│  ├─ EmployeeCreateForm.tsx
│  └─ actions.ts              # ← createEmployee のみ
├─ [employeeCd]/
│  ├─ page.tsx
│  ├─ EmployeeUpdateForm.tsx
│  ├─ EmployeeDeleteForm.tsx
│  └─ actions.ts              # ← updateEmployee, deleteEmployee
├─ _lib/
│  └─ error-handler.ts        # ← 共通ユーティリティ
└─ page.tsx
```

**メリット:**
- ✅ **Vercel Commerceが採用**している実績
- ✅ コロケーション原則に従う（使う場所の近くに置く）
- ✅ スケールしやすい（actionが増えても分散される）
- ✅ ファイルを開いたときに関連するactionがすぐわかる
- ✅ DXが高い

**デメリット:**
- 公式の例（`app/lib/actions.ts`）とは異なる
- ファイル数が増える（ただし、これは良い設計）

**評価:** ⭐⭐⭐⭐⭐

---

## 決定：コロケーションパターンを採用

### 理由

1. **Vercel自身が採用している実績**
   - Vercel Commerceという本番プロダクトで使用されている
   - Next.jsを作っているVercelが採用しているパターン

2. **DXの向上**
   - 関連ファイルが近くにある
   - どのactionがどのページで使われているか一目瞭然
   - 開発速度が上がる

3. **スケーラビリティ**
   - actionが増えても肥大化しない
   - 機能ごとに分散される

4. **コロケーション原則**
   - 「一緒に使うものは一緒のところに置く」という原則
   - 環境変数との議論で理解した原則と一貫性がある

### 注意点

- 公式ドキュメントの例とは異なる
- コミュニティで統一見解があるわけではない
- **方向転換する可能性もある**（後で変更しやすい設計にする）

---

## 移行計画

### 目標の構成

```
app/employees/
├─ new/
│  ├─ page.tsx
│  ├─ EmployeeCreateForm.tsx
│  └─ actions.ts              # ← createEmployee
├─ [employeeCd]/
│  ├─ page.tsx
│  ├─ EmployeeUpdateForm.tsx
│  ├─ EmployeeDeleteForm.tsx
│  └─ actions.ts              # ← updateEmployee, deleteEmployee
├─ _lib/
│  └─ error-handler.ts        # ← 共通エラーハンドラ（複数箇所で使うため残す）
└─ page.tsx
```

### 手順

1. `app/employees/new/actions.ts` を作成
   - `createEmployee` を移動

2. `app/employees/[employeeCd]/actions.ts` を作成
   - `updateEmployee`, `deleteEmployee` を移動

3. 各フォームのimportパスを修正
   - `from "../_lib/actions"` → `from "./actions"`

4. `app/employees/_lib/actions.ts` を削除

5. `error-handler.ts` は `_lib/` に残す（複数箇所で使うため）

---

## 参考

- [Next.js公式: Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Vercel Commerce](https://github.com/vercel/commerce/blob/main/components/cart/actions.ts)
- [Next.js GitHub Discussion #55908](https://github.com/vercel/next.js/discussions/55908)
- [環境変数とコロケーションの使い分け](./environment-variables-vs-colocation.md)

---

## 今後の検討事項

- 他のfeature（見積管理、顧客管理など）でも同じパターンを適用するか
- `_lib/` に共通ユーティリティをどこまで置くか
- 本当にこのパターンがスケールするか、運用してみて判断
