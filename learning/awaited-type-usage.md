# TypeScript の Awaited 型の使いどころ

作成日: 2026-01-09

## 概要

TypeScript 4.5 で追加された `Awaited<T>` ユーティリティ型の適切な使用場面について。
自分で型定義できる場合は `Awaited` を使わない方がシンプルで読みやすい。

## 詳細

### Awaited とは

`Awaited<T>` は Promise の中身の型を取り出すユーティリティ型。

```typescript
type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<Promise<number>>>; // number（ネストも解決）
```

### 使わなくてよいケース

**自分で型定義する場合**は、最初から Promise を含まない型を定義した方がシンプル。

```typescript
// ❌ Awaited を使う（冗長）
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
function getStringParam(params: Awaited<SearchParams>, key: string) { ... }

// ✅ Promise を含まない型を定義（シンプル）
type SearchParams = { [key: string]: string | string[] | undefined };
function getStringParam(params: SearchParams, key: string) { ... }

// ページコンポーネントでは Promise でラップ
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) { ... }
```

### Awaited が役立つケース

#### 1. 外部から提供された Promise 型を扱う場合

ライブラリや API が Promise 型を提供していて、自分で型定義を変更できない場合。

```typescript
// 外部ライブラリが提供する型（変更不可）
import type { FetchUserResponse } from "some-external-library";
// FetchUserResponse = Promise<{ id: string; name: string; email: string }>

// 中身の型だけ使いたい場合
type User = Awaited<FetchUserResponse>;
// { id: string; name: string; email: string }

function processUser(user: User) {
  console.log(user.name);
}
```

Next.js の例：

```typescript
// Next.js が提供する型
import type { Metadata, ResolvingMetadata } from "next";

// ResolvingMetadata は Promise<ResolvedMetadata> 型
// 解決後の型を使いたい場合
type ResolvedMeta = Awaited<ResolvingMetadata>;
```

#### 2. ジェネリクスと組み合わせる場合

汎用的なユーティリティ関数を作るとき。

```typescript
// Promise の結果をキャッシュする関数
function createCachedFetcher<T extends Promise<unknown>>(
  fetcher: () => T
): () => Promise<Awaited<T>> {
  let cache: Awaited<T> | null = null;

  return async () => {
    if (cache === null) {
      cache = await fetcher();
    }
    return cache;
  };
}

// 使用例
const fetchUser = () => fetch("/api/user").then((r) => r.json());
const cachedFetchUser = createCachedFetcher(fetchUser);
```

ReturnType と組み合わせる例（実務でよく使う）：

```typescript
async function getData() {
  return { id: 1, name: "test" };
}

type DataResult = Awaited<ReturnType<typeof getData>>;
// { id: number; name: string }

// 複数の非同期関数の結果型を取得
async function fetchUsers() {
  return [{ id: 1, name: "Alice" }];
}
async function fetchPosts() {
  return [{ id: 1, title: "Hello" }];
}

type AllData = {
  users: Awaited<ReturnType<typeof fetchUsers>>;
  posts: Awaited<ReturnType<typeof fetchPosts>>;
};
// { users: { id: number; name: string }[]; posts: { id: number; title: string }[] }
```

#### 3. 複数回ネストした Promise を一度にアンラップする場合

Promise が多重にネストしている場合（稀だが発生する）。

```typescript
// API クライアントが Promise<Promise<T>> を返すような設計の場合
type NestedResponse = Promise<Promise<{ data: string }>>;

// Awaited は再帰的にアンラップする
type Data = Awaited<NestedResponse>;
// { data: string }

// 手動でやると面倒
type ManualUnwrap = Awaited<Awaited<NestedResponse>>; // 不要、Awaited は一発で解決
```

動的インポートの型：

```typescript
const loadModule = () => import("./heavy-module");

// import() は Promise<Module> を返す
// Module.default が async function の場合...
type ModuleType = Awaited<ReturnType<typeof loadModule>>;
type DefaultExport = Awaited<ReturnType<ModuleType["default"]>>;
```

### まとめ

| ケース         | いつ使う                                                     |
| -------------- | ------------------------------------------------------------ |
| 1. 外部型      | ライブラリの Promise 型から中身だけ欲しい時                  |
| 2. ジェネリクス | `ReturnType` と組み合わせて async 関数の戻り値型を取得       |
| 3. ネスト解決  | `Promise<Promise<T>>` を一発で `T` にしたい時                |

特に **`Awaited<ReturnType<typeof asyncFunction>>`** のパターンは実務でよく使う。

## 参考

- [TypeScript Handbook - Awaited](https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype)
- 関連ファイル: `src/app/(features)/employees/page.tsx`
