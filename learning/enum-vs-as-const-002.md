# TypeScriptにおけるenum vs as const とディレクトリ構成

## 疑問・問題

プロジェクト全体で型定数（Role等）を扱う際に、以下の2点を決定する必要がある：

1. **enum vs as const**: どちらのパターンを採用すべきか
2. **ディレクトリ構成**: 定数や型をどこにまとめるべきか（`consts/`と`types/`で分けるべきか）

## 背景・コンテキスト

### 現状の問題

プロジェクト内でRoleの定義が2箇所に存在し、形式も異なる：

**Domain層（手書き）:**
```typescript
// domain/entities/Role.ts
export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}
```

**Prisma生成（自動）:**
```typescript
// generated/prisma/enums.ts
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER'
} as const

export type Role = (typeof Role)[keyof typeof Role]
```

この不一致により：
- Domain層とInfrastructure層で型が異なる（名目的型付けにより互換性がない）
- Single Source of Truthに反する
- 統一感がない

### 発生したエラー

`EmployeeApplicationService.ts`で以下のエラーが発生：
```
型 'Role' の引数を型 'Role | undefined' のパラメーターに割り当てることはできません。
型 '"ADMIN"' を型 'Role | undefined' に割り当てることはできません
```

原因：Application層で`@/generated/prisma/enums`のRoleをimportし、Domain層の`Employee.create()`（`domain/entities/Role`を期待）に渡そうとしたため。

## 調査内容

### enum vs as const の比較

#### TypeScript `enum`

```typescript
export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}
```

**メリット:**
- ✅ 簡潔（1つの宣言で型と値の両方を定義）
- ✅ 名前空間が作られる（`Role.ADMIN`として明示的）
- ✅ 意味論的に「列挙型」を表現できる
- ✅ IDEのサポートが良い（リファクタリング、オートコンプリート）
- ✅ 伝統的なTypeScriptパターン（馴染み深い）

**デメリット:**
- ❌ コンパイル後にJavaScriptコードが残る（ランタイムコスト）
  ```javascript
  var Role;
  (function (Role) {
      Role["ADMIN"] = "ADMIN";
      Role["USER"] = "USER";
  })(Role || (Role = {}));
  ```
- ❌ バンドルサイズが若干増える
- ❌ Prisma生成コードと形式が異なる（統一感がない）

#### `as const` パターン

```typescript
export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER'
} as const

export type Role = (typeof Role)[keyof typeof Role]
```

**メリット:**
- ✅ ランタイムコストゼロ（プレーンなオブジェクト）
- ✅ バンドルサイズが小さい
- ✅ Prisma生成コードと一致（統一感がある）
- ✅ モダンなTypeScriptパターン（最近の主流）
- ✅ JSONと相互変換が楽

**デメリット:**
- ❌ 2行必要（`const`と`type`）で若干冗長
- ❌ enumほど意味論的でない（ただのオブジェクト）
- ❌ `const`と`type`で同じ名前を使うため、初見では混乱しやすい

### Prismaとの統一性

Prismaは**必ず`as const`パターン**を生成する。Domain層で`enum`を使うと：
- 2つの形式が混在する
- Infrastructure層のMapperで変換が必要になる
- 型の互換性がない（今回のエラーの原因）

### ディレクトリ構成の選択肢

#### 選択肢1: `domain/valueObjects/` に配置
```
domain/
├── entities/
│   └── Employee.ts
├── valueObjects/
│   ├── Email.ts
│   ├── EmployeeCd.ts
│   └── Role.ts        ← ここ
```

**理由:**
- DDDでは、Roleは「値オブジェクト」として扱える（不変で、等価性が値で決まる）
- `MailAddress`や`EmployeeCd`と同列の概念
- プロジェクト規模が小さいうちは、値オブジェクトにまとめるのがシンプル

#### 選択肢2: `domain/enums/` を新設
```
domain/
├── entities/
├── valueObjects/
├── enums/
│   └── Role.ts
```

**理由:**
- enumを明示的に分離
- 将来enum（`OrderStatus`、`Priority`など）が増えたときに管理しやすい

#### 選択肢3: `domain/constants/` と `domain/types/` で分離
```
domain/
├── constants/
│   └── Role.ts        ← as const の値定義
├── types/
│   └── Role.ts        ← type定義
```

**理由:**
- 値と型を明確に分離
- ただし、2ファイルに分かれて管理が煩雑

#### 選択肢4: 1ファイルに両方定義、場所は別で決める
```
domain/
├── ???/
│   └── Role.ts        ← const と type を両方定義
```

**理由:**
- 使う側は1つのimportで済む
- 値と型が一緒に管理される

## 解決策

### 決定事項（2025-10-30）

1. **enum vs as const**: ✅ **`as const`パターンに統一**
   - 理由: Prismaと統一、モダンなパターン、バンドルサイズ削減

2. **ディレクトリ構成**: ✅ **`domain/types/` に1ファイルで両方定義**
   - 理由: 使いやすい、管理しやすい、DDD原則に沿う
   - 注: 将来的な配置については issue #3 で継続検討（フロントエンド開発後に再検討）

### 実装

```typescript
// domain/types/Role.ts
export const Role = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
```

### トレードオフ

**この決定により：**
- ✅ Prisma生成コードと形式が統一される（Single Source of Truth的）
- ✅ ランタイムコストゼロ（プレーンなオブジェクト）
- ✅ モダンなTypeScriptパターンを学べる
- ✅ 1ファイルにconst + typeをまとめることで、import文が1つで済む
- ✅ `domain/types/` に配置することで、DDD原則に従う（Domain層がビジネス概念を所有）

**注意点：**
- 将来的に`src/types/`を新設する可能性あり（issue #3で保留中）

## 関連issue

- #2
